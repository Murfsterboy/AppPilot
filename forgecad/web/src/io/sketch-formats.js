// DXF and SVG import into sketches, and export of sketches to DXF / SVG.
import { uid } from "../core/doc.js";
import { pointMap, sampleEntity, arcAngles } from "../sketch/profiles.js";

export class SketchBuilder {
  constructor(tol = 1e-4) { this.points = []; this.entities = []; this.constraints = []; this.tol = tol; this.grid = new Map(); }
  pt(x, y) {
    const k = `${Math.round(x / this.tol)},${Math.round(y / this.tol)}`;
    if (this.grid.has(k)) return this.grid.get(k);
    // check neighbours to merge near-coincident points
    for (const p of this.points.slice(-200)) if (Math.hypot(p.x - x, p.y - y) < this.tol * 2) { this.grid.set(k, p.id); return p.id; }
    const id = uid("p");
    this.points.push({ id, x, y });
    this.grid.set(k, id);
    return id;
  }
  line(x1, y1, x2, y2) { if (Math.hypot(x2 - x1, y2 - y1) < this.tol) return; this.entities.push({ id: uid("e"), type: "line", p1: this.pt(x1, y1), p2: this.pt(x2, y2) }); }
  circle(cx, cy, r) { this.entities.push({ id: uid("e"), type: "circle", c: this.pt(cx, cy), r }); }
  // CCW arc by centre and angles (degrees)
  arc(cx, cy, r, a1, a2) {
    const A1 = (a1 * Math.PI) / 180, A2 = (a2 * Math.PI) / 180;
    const c = { id: uid("p"), x: cx, y: cy };
    this.points.push(c);
    this.entities.push({ id: uid("e"), type: "arc", c: c.id, p1: this.pt(cx + r * Math.cos(A1), cy + r * Math.sin(A1)), p2: this.pt(cx + r * Math.cos(A2), cy + r * Math.sin(A2)) });
  }
  spline(pts, closed = false) {
    if (pts.length < 2) return;
    const ids = pts.map(([x, y]) => this.pt(x, y));
    this.entities.push({ id: uid("e"), type: "spline", pts: closed ? ids.slice(0, -1) : ids, closed });
  }
  polyline(pts, closed) {
    for (let i = 0; i + 1 < pts.length; i++) this.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (closed && pts.length > 2) this.line(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1]);
  }
  bulge(x1, y1, x2, y2, b) {
    if (Math.abs(b) < 1e-9) return this.line(x1, y1, x2, y2);
    const ang = 4 * Math.atan(b);
    const d = Math.hypot(x2 - x1, y2 - y1);
    const r = d / (2 * Math.sin(ang / 2));
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const h = Math.sqrt(Math.max(0, r * r - (d / 2) ** 2)) * Math.sign(b) * (Math.abs(ang) > Math.PI ? -1 : 1);
    const nx = -(y2 - y1) / d, ny = (x2 - x1) / d;
    const cx = mx + nx * h, cy = my + ny * h;
    const R = Math.abs(r);
    let a1 = (Math.atan2(y1 - cy, x1 - cx) * 180) / Math.PI, a2 = (Math.atan2(y2 - cy, x2 - cx) * 180) / Math.PI;
    if (b > 0) this.arc(cx, cy, R, a1, a2); else this.arc(cx, cy, R, a2, a1);
  }
  result() { return { points: this.points, entities: this.entities, constraints: this.constraints }; }
}

export function parseDXF(text) {
  const lines = text.split(/\r?\n/);
  const pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([parseInt(lines[i].trim(), 10), lines[i + 1].trim()]);
  const b = new SketchBuilder();
  let i = 0;
  let inEntities = false;
  // scale by $INSUNITS if present (1 = inch, 4 = mm, 5 = cm, 6 = m)
  let scale = 1;
  for (let k = 0; k < pairs.length - 2; k++) {
    if (pairs[k][0] === 9 && pairs[k][1] === "$INSUNITS") { const u = parseInt(pairs[k + 1][1], 10); scale = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000 }[u] || 1; }
  }
  const readEntity = () => {
    const type = pairs[i][1];
    const data = [];
    i++;
    while (i < pairs.length && pairs[i][0] !== 0) { data.push(pairs[i]); i++; }
    return { type, data };
  };
  const g = (d, code, def = 0) => { const p = d.find((x) => x[0] === code); return p ? parseFloat(p[1]) : def; };
  const all = (d, code) => d.filter((x) => x[0] === code).map((x) => parseFloat(x[1]));
  let polyVerts = null, polyClosed = false;
  while (i < pairs.length) {
    const [c, v] = pairs[i];
    if (c === 0 && v === "SECTION") { i++; if (pairs[i] && pairs[i][1] === "ENTITIES") inEntities = true; else if (pairs[i] && pairs[i][1] === "BLOCKS") inEntities = false; i++; continue; }
    if (c === 0 && v === "ENDSEC") { inEntities = false; i++; continue; }
    if (!inEntities || c !== 0) { i++; continue; }
    const e = readEntity();
    const d = e.data;
    const S = scale;
    switch (e.type) {
      case "LINE": b.line(g(d, 10) * S, g(d, 20) * S, g(d, 11) * S, g(d, 21) * S); break;
      case "CIRCLE": b.circle(g(d, 10) * S, g(d, 20) * S, g(d, 40) * S); break;
      case "ARC": b.arc(g(d, 10) * S, g(d, 20) * S, g(d, 40) * S, g(d, 50), g(d, 51)); break;
      case "LWPOLYLINE": {
        const xs = all(d, 10), ys = all(d, 20);
        const closed = (g(d, 70) & 1) === 1;
        // bulges are listed after each vertex
        const bul = [];
        let vi = -1;
        for (const [code, val] of d) { if (code === 10) { vi++; bul[vi] = 0; } if (code === 42) bul[vi] = parseFloat(val); }
        const n = xs.length;
        for (let k = 0; k < n - (closed ? 0 : 1); k++) {
          const k2 = (k + 1) % n;
          b.bulge(xs[k] * S, ys[k] * S, xs[k2] * S, ys[k2] * S, bul[k] || 0);
        }
        break;
      }
      case "POLYLINE": polyVerts = []; polyClosed = (g(d, 70) & 1) === 1; break;
      case "VERTEX": if (polyVerts) polyVerts.push([g(d, 10) * S, g(d, 20) * S, g(d, 42)]); break;
      case "SEQEND":
        if (polyVerts) {
          const n = polyVerts.length;
          for (let k = 0; k < n - (polyClosed ? 0 : 1); k++) { const a = polyVerts[k], c2 = polyVerts[(k + 1) % n]; b.bulge(a[0], a[1], c2[0], c2[1], a[2] || 0); }
          polyVerts = null;
        }
        break;
      case "SPLINE": {
        let xs = all(d, 11), ys = all(d, 21);
        if (!xs.length) { xs = all(d, 10); ys = all(d, 20); }
        const pts = xs.map((x, k) => [x * S, ys[k] * S]);
        const closed = (g(d, 70) & 1) === 1;
        if (pts.length >= 2) b.spline(pts, closed);
        break;
      }
      case "ELLIPSE": {
        const cx = g(d, 10) * S, cy = g(d, 20) * S, mx = g(d, 11) * S, my = g(d, 21) * S, ratio = g(d, 40, 1);
        const t0 = g(d, 41, 0), t1 = g(d, 42, Math.PI * 2);
        const a = Math.hypot(mx, my), rot = Math.atan2(my, mx);
        const pts = [];
        const n = 48;
        for (let k = 0; k <= n; k++) { const t = t0 + ((t1 - t0) * k) / n; const x = a * Math.cos(t), y = a * ratio * Math.sin(t); pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); }
        const closed = Math.abs(t1 - t0 - Math.PI * 2) < 1e-6;
        b.spline(closed ? pts : pts, closed);
        break;
      }
      case "POINT": break;
    }
  }
  const r = b.result();
  if (!r.entities.length) throw new Error("No supported geometry found in the DXF (lines, arcs, circles, polylines, splines)");
  return r;
}

export function sketchToDXF(sk) {
  const pts = pointMap(sk);
  const out = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"];
  const f = (n) => (Math.abs(n) < 1e-12 ? 0 : n).toFixed(6);
  for (const e of sk.entities) {
    const layer = e.construction ? "CONSTRUCTION" : "0";
    if (e.type === "line") {
      const a = pts.get(e.p1), b = pts.get(e.p2);
      out.push("0", "LINE", "8", layer, "10", f(a.x), "20", f(a.y), "30", "0", "11", f(b.x), "21", f(b.y), "31", "0");
    } else if (e.type === "circle") {
      const c = pts.get(e.c);
      out.push("0", "CIRCLE", "8", layer, "10", f(c.x), "20", f(c.y), "30", "0", "40", f(e.r));
    } else if (e.type === "arc") {
      const c = pts.get(e.c);
      const [a1, a2, r] = arcAngles(c, pts.get(e.p1), pts.get(e.p2));
      out.push("0", "ARC", "8", layer, "10", f(c.x), "20", f(c.y), "30", "0", "40", f(r), "50", f((a1 * 180) / Math.PI), "51", f((a2 * 180) / Math.PI));
    } else if (e.type === "spline") {
      const s = sampleEntity(e, pts);
      out.push("0", "LWPOLYLINE", "8", layer, "90", String(s.length), "70", e.closed ? "1" : "0");
      for (const p of s) out.push("10", f(p[0]), "20", f(p[1]));
    }
  }
  out.push("0", "ENDSEC", "0", "EOF");
  return out.join("\n") + "\n";
}

export function sketchToSVG(sk) {
  const pts = pointMap(sk);
  const paths = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of sk.entities) {
    if (e.construction || e.type === "point") continue;
    const s = sampleEntity(e, pts, 96);
    for (const [x, y] of s) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    if (e.type === "circle") { const c = pts.get(e.c); paths.push(`<circle cx="${c.x.toFixed(4)}" cy="${(-c.y).toFixed(4)}" r="${e.r.toFixed(4)}"/>`); continue; }
    paths.push(`<path d="M${s.map(([x, y]) => `${x.toFixed(4)},${(-y).toFixed(4)}`).join(" L")}${e.closed ? " Z" : ""}"/>`);
  }
  if (!paths.length) { minX = minY = 0; maxX = maxY = 10; }
  const pad = 2;
  const w = maxX - minX + 2 * pad, h = maxY - minY + 2 * pad;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(3)}mm" height="${h.toFixed(3)}mm" viewBox="${(minX - pad).toFixed(3)} ${(-maxY - pad).toFixed(3)} ${w.toFixed(3)} ${h.toFixed(3)}">\n<g fill="none" stroke="black" stroke-width="0.2">\n${paths.join("\n")}\n</g>\n</svg>\n`;
}

// SVG → sketch using three's SVGLoader (paths, rects, circles, polygons...).
export async function parseSVG(text) {
  const { SVGLoader } = await import("three/examples/jsm/loaders/SVGLoader.js");
  const data = new SVGLoader().parse(text);
  // size: honour width in mm if given, else assume 96 dpi
  let scale = 25.4 / 96;
  const m = text.match(/<svg[^>]*\swidth="([\d.]+)(mm|cm|in|px)?"[^>]*>/);
  const vb = text.match(/viewBox="([-\d.\s,eE]+)"/);
  if (m && vb) {
    const vbw = parseFloat(vb[1].trim().split(/[\s,]+/)[2]);
    const w = parseFloat(m[1]);
    const unit = m[2] || "px";
    const mm = unit === "mm" ? w : unit === "cm" ? w * 10 : unit === "in" ? w * 25.4 : w * (25.4 / 96);
    if (vbw > 0) scale = mm / vbw;
  }
  const b = new SketchBuilder(1e-3);
  for (const path of data.paths) {
    for (const sp of path.subPaths) {
      const pts = sp.getPoints(24).map((p) => [p.x * scale, -p.y * scale]);
      if (pts.length < 2) continue;
      const closed = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-3;
      // keep straight runs as lines, curves as polylines (robust for profiles)
      b.polyline(closed ? pts.slice(0, -1) : pts, closed);
    }
  }
  const r = b.result();
  if (!r.entities.length) throw new Error("No shapes found in the SVG");
  return r;
}
