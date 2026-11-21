// Sketch geometry helpers shared by the UI and the geometry worker:
// sampling curves, finding closed profiles (regions with holes) and chaining paths.

import { intersect, splitCurve, pointAt as gPointAt, paramOf as gParamOf, distanceTo as gDistanceTo, leaveDirection, leaveCurvature, curveLength as gCurveLength } from "./geom2d.js";

export const TAU = Math.PI * 2;

export function pointMap(sk) {
  const m = new Map();
  for (const p of sk.points) m.set(p.id, p);
  return m;
}

export function arcAngles(c, p1, p2) {
  const a1 = Math.atan2(p1.y - c.y, p1.x - c.x);
  let a2 = Math.atan2(p2.y - c.y, p2.x - c.x);
  while (a2 <= a1 + 1e-12) a2 += TAU;
  return [a1, a2, Math.hypot(p1.x - c.x, p1.y - c.y)];
}

// uniform Catmull-Rom → cubic Bézier control points for each span
export function splineBeziers(P, closed = false) {
  const n = P.length;
  const out = [];
  const get = (i) => {
    if (closed) return P[((i % n) + n) % n];
    if (i < 0) return { x: 2 * P[0].x - P[1].x, y: 2 * P[0].y - P[1].y };
    if (i >= n) return { x: 2 * P[n - 1].x - P[n - 2].x, y: 2 * P[n - 1].y - P[n - 2].y };
    return P[i];
  };
  const spans = closed ? n : n - 1;
  for (let i = 0; i < spans; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    out.push({
      a: [p1.x, p1.y], b: [p2.x, p2.y],
      c1: [p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6],
      c2: [p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6],
    });
  }
  return out;
}

export function bezierPoint(s, t) {
  const u = 1 - t;
  const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
  return [w0 * s.a[0] + w1 * s.c1[0] + w2 * s.c2[0] + w3 * s.b[0], w0 * s.a[1] + w1 * s.c1[1] + w2 * s.c2[1] + w3 * s.b[1]];
}

// Sample a sketch entity into a polyline [[x,y],...]
export function sampleEntity(e, pts, segs = 48) {
  if (e.type === "line") {
    const a = pts.get(e.p1), b = pts.get(e.p2);
    return [[a.x, a.y], [b.x, b.y]];
  }
  if (e.type === "circle") {
    const c = pts.get(e.c);
    const out = [];
    const n = Math.max(24, Math.min(160, Math.round(e.r * 2 + 32)));
    for (let i = 0; i <= n; i++) { const a = (i / n) * TAU; out.push([c.x + e.r * Math.cos(a), c.y + e.r * Math.sin(a)]); }
    return out;
  }
  if (e.type === "arc") {
    const c = pts.get(e.c), p1 = pts.get(e.p1), p2 = pts.get(e.p2);
    const [a1, a2, r] = arcAngles(c, p1, p2);
    const n = Math.max(8, Math.round(((a2 - a1) / TAU) * Math.max(24, Math.min(160, r * 2 + 32))));
    const out = [];
    for (let i = 0; i <= n; i++) { const a = a1 + ((a2 - a1) * i) / n; out.push([c.x + r * Math.cos(a), c.y + r * Math.sin(a)]); }
    out[0] = [p1.x, p1.y]; out[n] = [p2.x, p2.y];
    return out;
  }
  if (e.type === "spline") {
    const P = e.pts.map((id) => pts.get(id));
    if (P.length < 2) return [];
    const out = [];
    const bz = splineBeziers(P, e.closed);
    bz.forEach((s, i) => {
      const k = 16;
      for (let j = i === 0 ? 0 : 1; j <= k; j++) out.push(bezierPoint(s, j / k));
    });
    return out;
  }
  if (e.type === "point") {
    const p = pts.get(e.p);
    return [[p.x, p.y]];
  }
  return [];
}

export function polyArea(poly) {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function endIds(e) {
  if (e.type === "line" || e.type === "arc") return [e.p1, e.p2];
  if (e.type === "spline" && !e.closed) return [e.pts[0], e.pts[e.pts.length - 1]];
  return null;
}

// Convert a half-edge (entity, forward?) into kernel segments
function segmentsOf(e, pts, fwd) {
  const P = (id) => { const p = pts.get(id); return [p.x, p.y]; };
  if (e.type === "line") return [{ type: "line", a: P(fwd ? e.p1 : e.p2), b: P(fwd ? e.p2 : e.p1) }];
  if (e.type === "arc") {
    const c = pts.get(e.c), p1 = pts.get(e.p1), p2 = pts.get(e.p2);
    const [a1, a2, r] = arcAngles(c, p1, p2);
    const am = (a1 + a2) / 2;
    const mid = [c.x + r * Math.cos(am), c.y + r * Math.sin(am)];
    return [{ type: "arc", a: P(fwd ? e.p1 : e.p2), b: P(fwd ? e.p2 : e.p1), mid }];
  }
  if (e.type === "spline") {
    const bz = splineBeziers(e.pts.map((id) => pts.get(id)), e.closed).map((s) => ({ type: "bezier", ...s }));
    if (fwd) return bz;
    return bz.reverse().map((s) => ({ type: "bezier", a: s.b, b: s.a, c1: s.c2, c2: s.c1 }));
  }
  return [];
}

function sampleSegments(segs) {
  const out = [];
  for (const s of segs) {
    if (s.type === "line") { if (!out.length) out.push(s.a); out.push(s.b); }
    else if (s.type === "arc") {
      // circle through a, mid, b
      const c = circumcenter(s.a, s.mid, s.b);
      if (!c) { if (!out.length) out.push(s.a); out.push(s.b); continue; }
      const r = Math.hypot(s.a[0] - c[0], s.a[1] - c[1]);
      let a1 = Math.atan2(s.a[1] - c[1], s.a[0] - c[0]);
      let am = Math.atan2(s.mid[1] - c[1], s.mid[0] - c[0]);
      let a2 = Math.atan2(s.b[1] - c[1], s.b[0] - c[0]);
      // decide direction: CCW if going a1->am->a2 increasing
      const norm = (x) => ((x % TAU) + TAU) % TAU;
      const ccw = norm(am - a1) < norm(a2 - a1);
      let sweep = ccw ? norm(a2 - a1) : -norm(a1 - a2);
      const n = Math.max(6, Math.round((Math.abs(sweep) / TAU) * 64));
      if (!out.length) out.push(s.a);
      for (let i = 1; i <= n; i++) { const a = a1 + (sweep * i) / n; out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
    } else if (s.type === "bezier") {
      if (!out.length) out.push(s.a);
      for (let i = 1; i <= 12; i++) out.push(bezierPoint(s, i / 12));
    }
  }
  if (out.length > 1) {
    const f = out[0], l = out[out.length - 1];
    if (Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-9) out.pop();
  }
  return out;
}

export function circumcenter(a, b, c) {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-12) return null;
  const a2 = a[0] * a[0] + a[1] * a[1], b2 = b[0] * b[0] + b[1] * b[1], c2 = c[0] * c[0] + c[1] * c[1];
  return [(a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d, (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d];
}

// Convert an entity to a geom2d curve
export function entityCurve(e, pts) {
  if (e.type === "line") { const a = pts.get(e.p1), b = pts.get(e.p2); return { kind: "line", a: [a.x, a.y], b: [b.x, b.y] }; }
  if (e.type === "circle") { const c = pts.get(e.c); return { kind: "circle", c: [c.x, c.y], r: e.r }; }
  if (e.type === "arc") {
    const c = pts.get(e.c);
    const [a0, a1, r] = arcAngles(c, pts.get(e.p1), pts.get(e.p2));
    return { kind: "arc", c: [c.x, c.y], r, a0, a1 };
  }
  if (e.type === "spline") {
    const s = sampleEntity(e, pts);
    if (e.closed && s.length) s.push(s[0]);
    return { kind: "poly", pts: s };
  }
  return null;
}

function pieceSegments(piece, fwd) {
  const c = piece.curve;
  if (piece.bez) {
    if (fwd) return piece.bez;
    return [...piece.bez].reverse().map((s) => ({ type: "bezier", a: s.b, b: s.a, c1: s.c2, c2: s.c1 }));
  }
  if (c.kind === "line") return [{ type: "line", a: fwd ? c.a : c.b, b: fwd ? c.b : c.a }];
  if (c.kind === "arc") {
    const a = gPointAt(c, 0), b = gPointAt(c, 1), mid = gPointAt(c, 0.5);
    return [{ type: "arc", a: fwd ? a : b, b: fwd ? b : a, mid }];
  }
  if (c.kind === "poly") {
    const P = fwd ? c.pts : [...c.pts].reverse();
    const out = [];
    for (let i = 0; i + 1 < P.length; i++) if (Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]) > 1e-9) out.push({ type: "line", a: P[i], b: P[i + 1] });
    return out;
  }
  return [];
}

// Find all bounded faces formed by the (non-construction) sketch curves. Curves that cross or touch
// are split at the intersections first, so overlapping shapes still give closed regions.
export function findLoops(sk) {
  const pts = pointMap(sk);
  const loops = [];
  const ents = sk.entities.filter((e) => !e.construction && (e.type === "line" || e.type === "arc" || e.type === "spline" || e.type === "circle"));
  const items = [];
  for (const e of ents) {
    const c = entityCurve(e, pts);
    if (!c) continue;
    if (c.kind === "circle" && c.r < 1e-9) continue;
    if (c.kind === "line" && Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]) < 1e-9) continue;
    items.push({ e, c, ts: [] });
  }
  // intersections (and touching endpoints)
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    for (const x of intersect(items[i].c, items[j].c)) { items[i].ts.push(x.t1); items[j].ts.push(x.t2); }
    // endpoint lying on the other curve (T-junctions with tangency)
    for (const [A, B] of [[items[i], items[j]], [items[j], items[i]]]) {
      if (A.c.kind === "circle") continue;
      for (const p of [gPointAt(A.c, 0), gPointAt(A.c, 1)]) {
        if (gDistanceTo(B.c, p) < 1e-6) { const t = gParamOf(B.c, p); if (t !== null) B.ts.push(t); }
      }
    }
  }
  const pieces = [];
  for (const it of items) {
    const inner = it.ts.filter((t) => it.c.kind === "circle" || (t > 1e-7 && t < 1 - 1e-7));
    if (it.e.type === "spline" && !inner.length) {
      const P = it.e.pts.map((id) => pts.get(id));
      if (P.length < 2) continue;
      const bez = splineBeziers(P, it.e.closed).map((s) => ({ type: "bezier", ...s }));
      if (it.e.closed) {
        let poly = sampleSegments(bez);
        if (polyArea(poly) < 0) loops.push({ segments: [...bez].reverse().map((s) => ({ type: "bezier", a: s.b, b: s.a, c1: s.c2, c2: s.c1 })), poly: poly.reverse(), ents: [it.e.id] });
        else loops.push({ segments: bez, poly, ents: [it.e.id] });
        continue;
      }
      pieces.push({ curve: it.c, bez, ent: it.e.id });
      continue;
    }
    if (it.c.kind === "circle" && !inner.length) {
      loops.push({ circle: { c: it.c.c, r: it.c.r }, poly: sampleEntity(it.e, pts), ents: [it.e.id] });
      continue;
    }
    if (it.e.type === "spline" && it.e.closed && inner.length < 2) {
      // closed spline touched once: still a standalone loop
      const poly = it.c.pts.slice(0, -1);
      const ccw = polyArea(poly) > 0;
      const P = ccw ? poly : poly.reverse();
      loops.push({ segments: P.map((p, k) => ({ type: "line", a: p, b: P[(k + 1) % P.length] })), poly: P, ents: [it.e.id] });
      continue;
    }
    for (const c of splitCurve(it.c, inner)) pieces.push({ curve: c, ent: it.e.id });
  }
  // nodes: merge endpoints that coincide
  const nodes = [];
  const nodeOf = (p) => {
    for (let i = 0; i < nodes.length; i++) if (Math.abs(nodes[i][0] - p[0]) < 1e-6 && Math.abs(nodes[i][1] - p[1]) < 1e-6) return i;
    nodes.push(p);
    return nodes.length - 1;
  };
  let edges = [];
  for (const pc of pieces) {
    const a = nodeOf(gPointAt(pc.curve, 0)), b = nodeOf(gPointAt(pc.curve, 1));
    if (a === b && gCurveLength(pc.curve) < 1e-6) continue;
    edges.push({ pc, a, b });
  }
  for (;;) {
    const deg = new Map();
    for (const e of edges) { deg.set(e.a, (deg.get(e.a) || 0) + 1); deg.set(e.b, (deg.get(e.b) || 0) + 1); }
    const keep = edges.filter((e) => deg.get(e.a) >= 2 && deg.get(e.b) >= 2);
    if (keep.length === edges.length) break;
    edges = keep;
  }
  const out = new Map();
  const half = [];
  for (const e of edges) {
    const h1 = { e, fwd: true, from: e.a, to: e.b, dir: leaveDirection(e.pc.curve, true), k: leaveCurvature(e.pc.curve, true) };
    const h2 = { e, fwd: false, from: e.b, to: e.a, dir: leaveDirection(e.pc.curve, false), k: leaveCurvature(e.pc.curve, false) };
    if (e.pc.bez) {
      const sb = sampleSegments(e.pc.bez);
      const d1 = [sb[1][0] - sb[0][0], sb[1][1] - sb[0][1]], n = sb.length;
      const d2 = [sb[n - 2][0] - sb[n - 1][0], sb[n - 2][1] - sb[n - 1][1]];
      h1.dir = d1; h2.dir = d2;
    }
    h1.twin = h2; h2.twin = h1;
    half.push(h1, h2);
    for (const h of [h1, h2]) { if (!out.has(h.from)) out.set(h.from, []); out.get(h.from).push(h); }
  }
  for (const list of out.values()) {
    for (const h of list) h.ang = Math.atan2(h.dir[1], h.dir[0]);
    list.sort((p, q) => (Math.abs(p.ang - q.ang) > 1e-9 ? p.ang - q.ang : p.k - q.k));
  }
  const used = new Set();
  for (const h0 of half) {
    if (used.has(h0)) continue;
    const cyc = [];
    let h = h0, guard = 0;
    while (h && !used.has(h) && guard++ < 20000) {
      used.add(h);
      cyc.push(h);
      const list = out.get(h.to);
      const i = list.indexOf(h.twin);
      h = list[(i - 1 + list.length) % list.length];
    }
    if (h !== h0) continue;
    const segs = cyc.flatMap((x) => pieceSegments(x.e.pc, x.fwd));
    if (!segs.length) continue;
    const poly = sampleSegments(segs);
    if (polyArea(poly) > 1e-9) loops.push({ segments: segs, poly, ents: [...new Set(cyc.map((x) => x.e.pc.ent))] });
  }
  return loops;
}

function interiorPoint(outer, holes) {
  const ys = outer.map((p) => p[1]);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  let best = null;
  for (const f of [0.5, 0.37, 0.63, 0.21, 0.79, 0.11, 0.89]) {
    const y = y0 + (y1 - y0) * f;
    const xs = [];
    for (const poly of [outer, ...holes]) {
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y)) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const w = xs[i + 1] - xs[i];
      if (!best || w > best.w) best = { w, p: [(xs[i] + xs[i + 1]) / 2, y] };
    }
    if (best && best.w > (y1 - y0) * 0.05) break;
  }
  return best ? best.p : outer[0];
}

// Regions: each bounded face minus the faces nested directly inside it.
export function findRegions(sk) {
  const loops = findLoops(sk);
  const n = loops.length;
  const areas = loops.map((l) => Math.abs(polyArea(l.poly)));
  const contains = (i, j) => {
    if (areas[i] <= areas[j] + 1e-9) return false;
    // all sample points of j inside i (allow shared boundary points)
    const P = loops[j].poly;
    let inside = 0, tested = 0;
    for (let k = 0; k < P.length; k += Math.max(1, Math.floor(P.length / 12))) {
      tested++;
      if (pointInPoly(P[k][0], P[k][1], loops[i].poly)) inside++;
    }
    const ip = interiorPoint(P, []);
    return inside >= tested * 0.6 && pointInPoly(ip[0], ip[1], loops[i].poly);
  };
  const parents = loops.map(() => []);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && contains(i, j)) parents[j].push(i);
  // faces of the same connected network never contain each other; drop such pairs
  const entSets = loops.map((l) => new Set(l.ents));
  const sharesEntity = (i, j) => [...entSets[i]].some((x) => entSets[j].has(x));
  for (let j = 0; j < n; j++) parents[j] = parents[j].filter((i) => !sharesEntity(i, j));
  const depth = parents.map((p) => p.length);
  const regions = [];
  for (let i = 0; i < n; i++) {
    const kids = [];
    for (let j = 0; j < n; j++) if (parents[j].includes(i) && depth[j] === depth[i] + 1) kids.push(j);
    const holes = kids.map((k) => loops[k]);
    const holePolys = holes.map((h) => h.poly);
    const area = areas[i] - holePolys.reduce((s, p) => s + Math.abs(polyArea(p)), 0);
    regions.push({
      index: i, outer: loops[i], holes, depth: depth[i], area,
      sample: interiorPoint(loops[i].poly, holePolys),
    });
  }
  return regions;
}

export function regionContains(region, x, y) {
  if (!pointInPoly(x, y, region.outer.poly)) return false;
  for (const h of region.holes) if (pointInPoly(x, y, h.poly)) return false;
  return true;
}

// Pick regions from stored sample points; "auto" (or empty) → every even-depth region.
export function selectRegions(regions, sel) {
  if (!sel || sel === "auto" || !sel.length) return regions.filter((r) => r.depth % 2 === 0);
  const chosen = [];
  for (const [x, y] of sel) {
    let best = null;
    for (const r of regions) if (regionContains(r, x, y) && (!best || r.area < best.area)) best = r;
    if (best && !chosen.includes(best)) chosen.push(best);
  }
  return chosen;
}

// Chain all non-construction open curves into one path (for sweeps). Returns {segments, closed}.
export function chainPath(sk) {
  const pts = pointMap(sk);
  const curves = sk.entities.filter((e) => !e.construction && (e.type === "line" || e.type === "arc" || e.type === "spline"));
  if (!curves.length) {
    const circ = sk.entities.find((e) => !e.construction && e.type === "circle");
    if (circ) return { circle: { c: [pts.get(circ.c).x, pts.get(circ.c).y], r: circ.r }, closed: true, segments: [] };
    return null;
  }
  const remaining = curves.slice();
  const deg = new Map();
  for (const e of curves) { const ids = endIds(e); if (ids) for (const id of ids) deg.set(id, (deg.get(id) || 0) + 1); }
  // start at an end of degree 1 if any
  let start = remaining.find((e) => endIds(e) && endIds(e).some((id) => deg.get(id) === 1)) || remaining[0];
  let ids = endIds(start);
  let fwd = !ids || deg.get(ids[0]) === 1 || deg.get(ids[1]) !== 1;
  const segs = [...segmentsOf(start, pts, fwd)];
  remaining.splice(remaining.indexOf(start), 1);
  let tip = ids ? (fwd ? ids[1] : ids[0]) : null;
  const first = ids ? (fwd ? ids[0] : ids[1]) : null;
  while (tip && remaining.length) {
    const nxt = remaining.find((e) => endIds(e) && endIds(e).includes(tip));
    if (!nxt) break;
    const ni = endIds(nxt);
    const f = ni[0] === tip;
    segs.push(...segmentsOf(nxt, pts, f));
    tip = f ? ni[1] : ni[0];
    remaining.splice(remaining.indexOf(nxt), 1);
  }
  return { segments: segs, closed: tip === first, poly: sampleSegments(segs) };
}

export { sampleSegments };
