// Editing operations on sketch data: trim, extend, 2D fillet, offset, mirror, delete.
import { uid } from "../core/doc.js";
import { pointMap, entityCurve, arcAngles, TAU } from "./profiles.js";
import { intersect, paramOf, pointAt, distanceTo } from "./geom2d.js";

export function addPoint(sk, x, y, tol = 1e-6) {
  const ex = sk.points.find((p) => Math.abs(p.x - x) < tol && Math.abs(p.y - y) < tol);
  if (ex) return ex.id;
  const id = uid("p");
  sk.points.push({ id, x, y });
  return id;
}

export function entityPointIds(e) {
  if (e.type === "line" || e.type === "arc") return e.type === "arc" ? [e.p1, e.p2, e.c] : [e.p1, e.p2];
  if (e.type === "circle") return [e.c];
  if (e.type === "spline") return e.pts.slice();
  if (e.type === "point") return [e.p];
  return [];
}

// constraint refs (points or entities)
function refsOf(c) { return [c.a, c.b, c.line].filter(Boolean); }

export function removeEntities(sk, ids) {
  const set = new Set(ids);
  sk.entities = sk.entities.filter((e) => !set.has(e.id));
  sk.constraints = sk.constraints.filter((c) => !refsOf(c).some((r) => set.has(r)));
  cleanupPoints(sk);
}

export function cleanupPoints(sk) {
  const used = new Set();
  for (const e of sk.entities) for (const p of entityPointIds(e)) used.add(p);
  const removed = new Set(sk.points.filter((p) => !used.has(p.id) && !p.keep).map((p) => p.id));
  sk.points = sk.points.filter((p) => !removed.has(p.id));
  sk.constraints = sk.constraints.filter((c) => !refsOf(c).some((r) => removed.has(r)));
}

function cutParams(sk, e, pts) {
  const c = entityCurve(e, pts);
  const ts = [];
  for (const o of sk.entities) {
    if (o.id === e.id || o.type === "point") continue;
    const oc = entityCurve(o, pts);
    if (!oc) continue;
    for (const x of intersect(c, oc)) ts.push({ t: x.t1, p: x.p, other: o });
  }
  // points lying on the entity (e.g. other curves' endpoints)
  for (const p of sk.points) {
    if (entityPointIds(e).includes(p.id)) continue;
    if (distanceTo(c, [p.x, p.y]) < 1e-6) { const t = paramOf(c, [p.x, p.y]); if (t !== null) ts.push({ t, p: [p.x, p.y], pointId: p.id }); }
  }
  return { c, ts };
}

// Trim the portion of entity `eid` nearest to point (x,y) between its neighbouring intersections.
export function trimAt(sk, eid, x, y) {
  const pts = pointMap(sk);
  const e = sk.entities.find((q) => q.id === eid);
  if (!e || e.type === "point") return false;
  if (e.type === "spline") { removeEntities(sk, [eid]); return true; }
  const { c, ts } = cutParams(sk, e, pts);
  const t = paramOf(c, [x, y]) ?? 0;
  const closed = c.kind === "circle";
  const inner = ts.filter((q) => closed || (q.t > 1e-7 && q.t < 1 - 1e-7));
  if (!inner.length || (closed && inner.length < 2)) { removeEntities(sk, [eid]); return true; }
  inner.sort((a, b) => a.t - b.t);
  let lo = null, hi = null;
  for (const q of inner) { if (q.t <= t) lo = q; if (q.t > t && !hi) hi = q; }
  const ptAt = (q) => {
    if (q.pointId) return q.pointId;
    const id = addPoint(sk, q.p[0], q.p[1]);
    // keep the new end attached to the cutting curve
    if (q.other) {
      if (q.other.type === "line") sk.constraints.push({ id: uid("k"), type: "pointOnLine", a: id, b: q.other.id });
      else if (q.other.type === "circle" || q.other.type === "arc") sk.constraints.push({ id: uid("k"), type: "pointOnCircle", a: id, b: q.other.id });
    }
    return id;
  };
  const dropDims = (id) => { sk.constraints = sk.constraints.filter((k) => !((k.type === "length" || k.type === "equal") && refsOf(k).includes(id))); };
  if (closed) {
    // circle → arc from the end of the removed gap to its start (CCW)
    if (!lo) lo = inner[inner.length - 1];
    if (!hi) hi = inner[0];
    const p1 = ptAt(hi), p2 = ptAt(lo);
    const arc = { id: uid("e"), type: "arc", c: e.c, p1, p2, construction: e.construction };
    sk.entities = sk.entities.map((q) => (q.id === eid ? arc : q));
    sk.constraints = sk.constraints.filter((k) => !refsOf(k).includes(eid) || ["concentric", "tangent", "equal", "radius", "diameter"].includes(k.type)).map((k) => ({ ...k, a: k.a === eid ? arc.id : k.a, b: k.b === eid ? arc.id : k.b }));
    cleanupPoints(sk);
    return true;
  }
  dropDims(eid);
  if (!lo && hi) {
    // remove start..hi
    const id = ptAt(hi);
    e.p1 = id;
  } else if (lo && !hi) {
    const id = ptAt(lo);
    e.p2 = id;
  } else if (lo && hi) {
    const idLo = ptAt(lo), idHi = ptAt(hi);
    const second = { ...e, id: uid("e"), p1: idHi };
    e.p2 = idLo;
    sk.entities.push(second);
    if (e.type === "line") {
      for (const k of sk.constraints.filter((k) => refsOf(k).includes(e.id) && (k.type === "horizontal" || k.type === "vertical"))) sk.constraints.push({ ...k, id: uid("k"), a: second.id });
      sk.constraints.push({ id: uid("k"), type: "collinear", a: e.id, b: second.id });
    } else if (e.type === "arc") {
      sk.constraints.push({ id: uid("k"), type: "equal", a: e.id, b: second.id });
    }
  }
  cleanupPoints(sk);
  return true;
}

// Extend the end of a line (nearest to x,y) to the next curve it would hit.
export function extendAt(sk, eid, x, y) {
  const pts = pointMap(sk);
  const e = sk.entities.find((q) => q.id === eid);
  if (!e || e.type !== "line") return false;
  const a = pts.get(e.p1), b = pts.get(e.p2);
  const nearEnd = Math.hypot(x - b.x, y - b.y) < Math.hypot(x - a.x, y - a.y);
  const from = nearEnd ? a : b, to = nearEnd ? b : a;
  const dx = to.x - from.x, dy = to.y - from.y;
  const L = Math.hypot(dx, dy);
  if (L < 1e-9) return false;
  const far = { kind: "line", a: [to.x, to.y], b: [to.x + (dx / L) * 1e5, to.y + (dy / L) * 1e5] };
  let best = null;
  for (const o of sk.entities) {
    if (o.id === eid || o.type === "point") continue;
    const oc = entityCurve(o, pts);
    for (const xx of intersect(far, oc)) {
      const d = Math.hypot(xx.p[0] - to.x, xx.p[1] - to.y);
      if (d > 1e-6 && (!best || d < best.d)) best = { d, p: xx.p, other: o };
    }
  }
  if (!best) return false;
  const id = addPoint(sk, best.p[0], best.p[1]);
  if (nearEnd) e.p2 = id; else e.p1 = id;
  if (best.other.type === "line") sk.constraints.push({ id: uid("k"), type: "pointOnLine", a: id, b: best.other.id });
  else if (best.other.type === "circle" || best.other.type === "arc") sk.constraints.push({ id: uid("k"), type: "pointOnCircle", a: id, b: best.other.id });
  sk.constraints = sk.constraints.filter((k) => !(k.type === "length" && k.a === eid));
  cleanupPoints(sk);
  return true;
}

// Round the corner at point `pid` shared by two lines.
export function filletCorner(sk, pid, r) {
  const pts = pointMap(sk);
  const lines = sk.entities.filter((e) => e.type === "line" && (e.p1 === pid || e.p2 === pid));
  if (lines.length !== 2) return "Pick a corner where exactly two lines meet";
  const P = pts.get(pid);
  const other = (l) => pts.get(l.p1 === pid ? l.p2 : l.p1);
  const A = other(lines[0]), B = other(lines[1]);
  const u = norm([A.x - P.x, A.y - P.y]), v = norm([B.x - P.x, B.y - P.y]);
  const cosT = u[0] * v[0] + u[1] * v[1];
  const theta = Math.acos(Math.max(-1, Math.min(1, cosT)));
  if (theta < 1e-3 || Math.PI - theta < 1e-3) return "The lines are parallel";
  const d = r / Math.tan(theta / 2);
  const la = Math.hypot(A.x - P.x, A.y - P.y), lb = Math.hypot(B.x - P.x, B.y - P.y);
  if (d >= la - 1e-6 || d >= lb - 1e-6) return "Radius is too big for these lines";
  const ta = [P.x + u[0] * d, P.y + u[1] * d], tb = [P.x + v[0] * d, P.y + v[1] * d];
  const bis = norm([u[0] + v[0], u[1] + v[1]]);
  const cd = r / Math.sin(theta / 2);
  const C = [P.x + bis[0] * cd, P.y + bis[1] * cd];
  const ida = addPoint(sk, ta[0], ta[1]), idb = addPoint(sk, tb[0], tb[1]);
  const idc = uid("p");
  sk.points.push({ id: idc, x: C[0], y: C[1] });
  for (const [l, id] of [[lines[0], ida], [lines[1], idb]]) { if (l.p1 === pid) l.p1 = id; else l.p2 = id; }
  // arc goes CCW: decide order
  const cross = (ta[0] - C[0]) * (tb[1] - C[1]) - (ta[1] - C[1]) * (tb[0] - C[0]);
  const arc = { id: uid("e"), type: "arc", c: idc, p1: cross > 0 ? ida : idb, p2: cross > 0 ? idb : ida };
  sk.entities.push(arc);
  sk.constraints = sk.constraints.filter((k) => !(k.type === "length" && (k.a === lines[0].id || k.a === lines[1].id)));
  sk.constraints.push({ id: uid("k"), type: "tangent", a: arc.id, b: lines[0].id }, { id: uid("k"), type: "tangent", a: arc.id, b: lines[1].id }, { id: uid("k"), type: "radius", a: arc.id, value: r, expr: String(r) });
  // the two lines' endpoints must also lie on the arc's ends: they share the points, so done
  cleanupPoints(sk);
  return null;
}

function norm(v) { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }

// Offset a set of entities by distance d (positive = left of travel direction / outward for circles)
export function offsetEntities(sk, ids, d) {
  const pts = pointMap(sk);
  const ents = sk.entities.filter((e) => ids.includes(e.id));
  const created = [];
  const newPt = new Map(); // original point id -> list of offset positions
  const lineOff = [];
  for (const e of ents) {
    if (e.type === "circle") {
      const r = e.r + d;
      if (r <= 1e-6) continue;
      const ne = { id: uid("e"), type: "circle", c: e.c, r };
      sk.entities.push(ne); created.push(ne.id);
    } else if (e.type === "line") {
      const a = pts.get(e.p1), b = pts.get(e.p2);
      const n = norm([-(b.y - a.y), b.x - a.x]);
      lineOff.push({ e, a: [a.x + n[0] * d, a.y + n[1] * d], b: [b.x + n[0] * d, b.y + n[1] * d] });
    } else if (e.type === "arc") {
      const c = pts.get(e.c);
      const [a1, a2, r0] = arcAngles(c, pts.get(e.p1), pts.get(e.p2));
      const r = r0 + d;
      if (r <= 1e-6) continue;
      lineOff.push({ e, arc: true, c, r, a: [c.x + r * Math.cos(a1), c.y + r * Math.sin(a1)], b: [c.x + r * Math.cos(a2), c.y + r * Math.sin(a2)] });
    }
  }
  // join consecutive offset lines that shared an endpoint by intersecting them
  const endKey = new Map();
  for (const o of lineOff) {
    for (const [end, pid] of [["a", o.e.p1], ["b", o.e.p2]]) {
      if (!endKey.has(pid)) endKey.set(pid, []);
      endKey.get(pid).push({ o, end });
    }
  }
  for (const [pid, list] of endKey) {
    if (list.length !== 2) continue;
    const [x, y] = list;
    if (x.o.arc || y.o.arc) {
      const m = [(x.o[x.end][0] + y.o[y.end][0]) / 2, (x.o[x.end][1] + y.o[y.end][1]) / 2];
      x.o[x.end] = m; y.o[y.end] = m;
      continue;
    }
    const L1 = { kind: "line", a: x.o.a, b: x.o.b }, L2 = { kind: "line", a: y.o.a, b: y.o.b };
    const d1 = [L1.b[0] - L1.a[0], L1.b[1] - L1.a[1]], d2 = [L2.b[0] - L2.a[0], L2.b[1] - L2.a[1]];
    const den = d1[0] * d2[1] - d1[1] * d2[0];
    if (Math.abs(den) < 1e-12) continue;
    const t = ((L2.a[0] - L1.a[0]) * d2[1] - (L2.a[1] - L1.a[1]) * d2[0]) / den;
    const p = [L1.a[0] + d1[0] * t, L1.a[1] + d1[1] * t];
    x.o[x.end] = p; y.o[y.end] = p;
  }
  for (const o of lineOff) {
    const p1 = addPoint(sk, o.a[0], o.a[1], 1e-7), p2 = addPoint(sk, o.b[0], o.b[1], 1e-7);
    let ne;
    if (o.arc) ne = { id: uid("e"), type: "arc", c: o.e.c, p1, p2 };
    else ne = { id: uid("e"), type: "line", p1, p2 };
    sk.entities.push(ne);
    created.push(ne.id);
    if (!o.arc) sk.constraints.push({ id: uid("k"), type: "parallel", a: o.e.id, b: ne.id });
  }
  return created;
}

// Mirror entities across a line; adds symmetric constraints so they stay mirrored.
export function mirrorEntities(sk, ids, lineId) {
  const pts = pointMap(sk);
  const L = sk.entities.find((e) => e.id === lineId);
  if (!L || L.type !== "line") return "Pick a line as the mirror axis";
  const a = pts.get(L.p1), b = pts.get(L.p2);
  const d = norm([b.x - a.x, b.y - a.y]);
  const map = new Map();
  const onAxis = (p) => Math.abs((p.x - a.x) * d[1] - (p.y - a.y) * d[0]) < 1e-6;
  const mp = (pid) => {
    if (map.has(pid)) return map.get(pid);
    const p = pts.get(pid);
    if (pid === L.p1 || pid === L.p2 || onAxis(p)) { map.set(pid, pid); return pid; }
    const t = (p.x - a.x) * d[0] + (p.y - a.y) * d[1];
    const f = [a.x + d[0] * t, a.y + d[1] * t];
    const id = uid("p");
    sk.points.push({ id, x: 2 * f[0] - p.x, y: 2 * f[1] - p.y });
    sk.constraints.push({ id: uid("k"), type: "symmetric", a: pid, b: id, line: lineId });
    map.set(pid, id);
    return id;
  };
  const created = [];
  for (const e of sk.entities.filter((q) => ids.includes(q.id) && q.id !== lineId)) {
    let ne;
    if (e.type === "line") ne = { id: uid("e"), type: "line", p1: mp(e.p1), p2: mp(e.p2) };
    else if (e.type === "circle") { ne = { id: uid("e"), type: "circle", c: mp(e.c), r: e.r }; sk.constraints.push({ id: uid("k"), type: "equal", a: e.id, b: ne.id }); }
    else if (e.type === "arc") ne = { id: uid("e"), type: "arc", c: mp(e.c), p1: mp(e.p2), p2: mp(e.p1) }; // reflection flips orientation
    else if (e.type === "spline") ne = { id: uid("e"), type: "spline", pts: e.pts.map(mp), closed: e.closed };
    else if (e.type === "point") ne = { id: uid("e"), type: "point", p: mp(e.p) };
    if (ne) { ne.construction = e.construction; sk.entities.push(ne); created.push(ne.id); }
  }
  return created;
}

// Merge point b into a (coincident constraint by shared point)
export function mergePoints(sk, keep, drop) {
  if (keep === drop) return;
  for (const e of sk.entities) {
    for (const k of ["p1", "p2", "c", "p"]) if (e[k] === drop) e[k] = keep;
    if (e.pts) e.pts = e.pts.map((p) => (p === drop ? keep : p));
  }
  for (const c of sk.constraints) for (const k of ["a", "b"]) if (c[k] === drop) c[k] = keep;
  sk.constraints = sk.constraints.filter((c) => !(c.type === "coincident" && c.a === c.b));
  sk.points = sk.points.filter((p) => p.id !== drop);
  // drop degenerate lines
  sk.entities = sk.entities.filter((e) => !(e.type === "line" && e.p1 === e.p2));
}

export { TAU, pointAt };
