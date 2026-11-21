// 2D curve maths: intersections, parameters and splitting for lines, arcs, circles and polylines.
// Curves: {kind:'line',a,b} | {kind:'arc',c,r,a0,a1} (CCW, a1>a0) | {kind:'circle',c,r} | {kind:'poly',pts}
// Parameter t ∈ [0,1] along the curve (circles: angle/2π).
export const TAU = Math.PI * 2;
const EPS = 1e-9;

export function pointAt(c, t) {
  if (c.kind === "line") return [c.a[0] + (c.b[0] - c.a[0]) * t, c.a[1] + (c.b[1] - c.a[1]) * t];
  if (c.kind === "arc") { const a = c.a0 + (c.a1 - c.a0) * t; return [c.c[0] + c.r * Math.cos(a), c.c[1] + c.r * Math.sin(a)]; }
  if (c.kind === "circle") { const a = t * TAU; return [c.c[0] + c.r * Math.cos(a), c.c[1] + c.r * Math.sin(a)]; }
  if (c.kind === "poly") {
    const L = polyLengths(c);
    const target = t * L.total;
    for (let i = 0; i < c.pts.length - 1; i++) {
      if (target <= L.cum[i + 1] || i === c.pts.length - 2) {
        const seg = L.cum[i + 1] - L.cum[i] || 1;
        const u = (target - L.cum[i]) / seg;
        return [c.pts[i][0] + (c.pts[i + 1][0] - c.pts[i][0]) * u, c.pts[i][1] + (c.pts[i + 1][1] - c.pts[i][1]) * u];
      }
    }
  }
  return [0, 0];
}

function polyLengths(c) {
  if (c._L) return c._L;
  const cum = [0];
  for (let i = 1; i < c.pts.length; i++) cum.push(cum[i - 1] + Math.hypot(c.pts[i][0] - c.pts[i - 1][0], c.pts[i][1] - c.pts[i - 1][1]));
  c._L = { cum, total: cum[cum.length - 1] || 1 };
  return c._L;
}

function normAng(a) { return ((a % TAU) + TAU) % TAU; }

// parameter of point p (assumed on/near curve); null if outside an arc's range
export function paramOf(c, p) {
  if (c.kind === "line") {
    const dx = c.b[0] - c.a[0], dy = c.b[1] - c.a[1];
    const l2 = dx * dx + dy * dy || 1;
    return ((p[0] - c.a[0]) * dx + (p[1] - c.a[1]) * dy) / l2;
  }
  if (c.kind === "arc") {
    const ang = Math.atan2(p[1] - c.c[1], p[0] - c.c[0]);
    const d = normAng(ang - c.a0);
    const span = c.a1 - c.a0;
    if (d <= span + 1e-9) return d / span;
    // just before start?
    if (TAU - d < 1e-9) return 0;
    return null;
  }
  if (c.kind === "circle") return normAng(Math.atan2(p[1] - c.c[1], p[0] - c.c[0])) / TAU;
  if (c.kind === "poly") {
    const L = polyLengths(c);
    let best = { d: Infinity, t: 0 };
    for (let i = 0; i < c.pts.length - 1; i++) {
      const a = c.pts[i], b = c.pts[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const l2 = dx * dx + dy * dy || 1;
      const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
      const d = Math.hypot(a[0] + dx * u - p[0], a[1] + dy * u - p[1]);
      if (d < best.d) best = { d, t: (L.cum[i] + u * Math.sqrt(l2)) / L.total };
    }
    return best.t;
  }
  return 0;
}

export function distanceTo(c, p) {
  if (c.kind === "line") {
    const t = Math.max(0, Math.min(1, paramOf(c, p)));
    const q = pointAt(c, t);
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  if (c.kind === "circle") return Math.abs(Math.hypot(p[0] - c.c[0], p[1] - c.c[1]) - c.r);
  if (c.kind === "arc") {
    const t = paramOf(c, p);
    if (t !== null) return Math.abs(Math.hypot(p[0] - c.c[0], p[1] - c.c[1]) - c.r);
    const s = pointAt(c, 0), e = pointAt(c, 1);
    return Math.min(Math.hypot(s[0] - p[0], s[1] - p[1]), Math.hypot(e[0] - p[0], e[1] - p[1]));
  }
  if (c.kind === "poly") { const q = pointAt(c, paramOf(c, p)); return Math.hypot(q[0] - p[0], q[1] - p[1]); }
  return Infinity;
}

// raw intersections of the underlying infinite primitives
function lineLine(a1, b1, a2, b2) {
  const d1 = [b1[0] - a1[0], b1[1] - a1[1]], d2 = [b2[0] - a2[0], b2[1] - a2[1]];
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(den) < 1e-12) return [];
  const t = ((a2[0] - a1[0]) * d2[1] - (a2[1] - a1[1]) * d2[0]) / den;
  return [[a1[0] + d1[0] * t, a1[1] + d1[1] * t]];
}
function lineCircle(a, b, c, r) {
  const d = [b[0] - a[0], b[1] - a[1]];
  const f = [a[0] - c[0], a[1] - c[1]];
  const A = d[0] * d[0] + d[1] * d[1], B = 2 * (f[0] * d[0] + f[1] * d[1]), C = f[0] * f[0] + f[1] * f[1] - r * r;
  let disc = B * B - 4 * A * C;
  if (disc < -1e-9 * A || A < 1e-18) return [];
  disc = Math.max(0, disc);
  const s = Math.sqrt(disc);
  const ts = s < 1e-12 ? [-B / (2 * A)] : [(-B - s) / (2 * A), (-B + s) / (2 * A)];
  return ts.map((t) => [a[0] + d[0] * t, a[1] + d[1] * t]);
}
function circleCircle(c1, r1, c2, r2) {
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1];
  const d = Math.hypot(dx, dy);
  if (d < 1e-12 || d > r1 + r2 + 1e-9 || d < Math.abs(r1 - r2) - 1e-9) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const mx = c1[0] + (a * dx) / d, my = c1[1] + (a * dy) / d;
  if (h < 1e-12) return [[mx, my]];
  return [[mx + (h * -dy) / d, my + (h * dx) / d], [mx - (h * -dy) / d, my - (h * dx) / d]];
}

function segments(c) {
  // decompose into primitive pieces: lines and circles(with arc filter)
  if (c.kind === "line") return [{ k: "l", a: c.a, b: c.b }];
  if (c.kind === "poly") { const out = []; for (let i = 0; i < c.pts.length - 1; i++) out.push({ k: "l", a: c.pts[i], b: c.pts[i + 1] }); return out; }
  return [{ k: "c", c: c.c, r: c.r }];
}

function onCurve(c, p, tol) {
  const t = paramOf(c, p);
  if (t === null) return null;
  if (c.kind === "line" || c.kind === "poly") { if (t < -tol || t > 1 + tol) return null; return Math.max(0, Math.min(1, t)); }
  if (c.kind === "arc") return Math.max(0, Math.min(1, t));
  return t;
}

// intersections between two curves → [{p, t1, t2}]
export function intersect(c1, c2) {
  const out = [];
  for (const s1 of segments(c1)) for (const s2 of segments(c2)) {
    let pts;
    if (s1.k === "l" && s2.k === "l") pts = lineLine(s1.a, s1.b, s2.a, s2.b);
    else if (s1.k === "l") pts = lineCircle(s1.a, s1.b, s2.c, s2.r);
    else if (s2.k === "l") pts = lineCircle(s2.a, s2.b, s1.c, s1.r);
    else pts = circleCircle(s1.c, s1.r, s2.c, s2.r);
    for (const p of pts) {
      // must lie within both finite pieces
      if (s1.k === "l" && !withinSeg(s1, p)) continue;
      if (s2.k === "l" && !withinSeg(s2, p)) continue;
      const t1 = onCurve(c1, p, 1e-9), t2 = onCurve(c2, p, 1e-9);
      if (t1 === null || t2 === null) continue;
      if (!out.some((q) => Math.hypot(q.p[0] - p[0], q.p[1] - p[1]) < 1e-7)) out.push({ p, t1, t2 });
    }
  }
  return out;
}

function withinSeg(s, p) {
  const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-18) return false;
  const t = ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) / l2;
  return t >= -1e-9 && t <= 1 + 1e-9;
}

// Split a curve at parameters → array of sub-curves (in order).
export function splitCurve(c, ts) {
  const sorted = [...new Set(ts.map((t) => +t.toFixed(12)))].sort((a, b) => a - b);
  if (c.kind === "circle") {
    if (!sorted.length) return [c];
    const out = [];
    for (let i = 0; i < sorted.length; i++) {
      const t0 = sorted[i], t1 = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + 1;
      if (t1 - t0 < 1e-9) continue;
      out.push({ kind: "arc", c: c.c, r: c.r, a0: t0 * TAU, a1: t1 * TAU });
    }
    return out.length ? out : [c];
  }
  const cuts = [0, ...sorted.filter((t) => t > 1e-9 && t < 1 - 1e-9), 1];
  const out = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const t0 = cuts[i], t1 = cuts[i + 1];
    if (t1 - t0 < 1e-9) continue;
    if (c.kind === "line") out.push({ kind: "line", a: pointAt(c, t0), b: pointAt(c, t1) });
    else if (c.kind === "arc") out.push({ kind: "arc", c: c.c, r: c.r, a0: c.a0 + (c.a1 - c.a0) * t0, a1: c.a0 + (c.a1 - c.a0) * t1 });
    else if (c.kind === "poly") {
      const pts = [pointAt(c, t0)];
      const L = polyLengths(c);
      for (let k = 1; k < c.pts.length - 1; k++) { const tk = L.cum[k] / L.total; if (tk > t0 && tk < t1) pts.push(c.pts[k]); }
      pts.push(pointAt(c, t1));
      out.push({ kind: "poly", pts });
    }
  }
  return out;
}

export function startPoint(c) { return c.kind === "circle" ? null : pointAt(c, 0); }
export function endPoint(c) { return c.kind === "circle" ? null : pointAt(c, 1); }

// unit tangent leaving the start (fwd) or leaving the end backwards
export function leaveDirection(c, fwd) {
  if (c.kind === "line") {
    const d = fwd ? [c.b[0] - c.a[0], c.b[1] - c.a[1]] : [c.a[0] - c.b[0], c.a[1] - c.b[1]];
    const l = Math.hypot(...d) || 1;
    return [d[0] / l, d[1] / l];
  }
  if (c.kind === "arc") {
    const a = fwd ? c.a0 : c.a1;
    return fwd ? [-Math.sin(a), Math.cos(a)] : [Math.sin(a), -Math.cos(a)];
  }
  if (c.kind === "poly") {
    const P = c.pts;
    let a, b;
    if (fwd) { a = P[0]; b = P.find((q) => Math.hypot(q[0] - a[0], q[1] - a[1]) > 1e-9) || P[1]; }
    else { a = P[P.length - 1]; b = [...P].reverse().find((q) => Math.hypot(q[0] - a[0], q[1] - a[1]) > 1e-9) || P[P.length - 2]; }
    const d = [b[0] - a[0], b[1] - a[1]];
    const l = Math.hypot(...d) || 1;
    return [d[0] / l, d[1] / l];
  }
  return [1, 0];
}

// curvature sign helper to break ties between tangent curves leaving the same node
export function leaveCurvature(c, fwd) {
  if (c.kind === "arc") return fwd ? 1 / c.r : -1 / c.r;
  return 0;
}

export function curveLength(c) {
  if (c.kind === "line") return Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]);
  if (c.kind === "arc") return c.r * (c.a1 - c.a0);
  if (c.kind === "circle") return TAU * c.r;
  if (c.kind === "poly") return polyLengths(c).total;
  return 0;
}
