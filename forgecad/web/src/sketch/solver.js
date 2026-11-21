// Geometric constraint solver for 2D sketches.
// Unknowns: x/y of every point and the radius of every circle. Each constraint contributes one or
// more residual equations; we minimise the sum of squares with Levenberg–Marquardt.

export const CONSTRAINT_INFO = {
  coincident: { label: "Coincident", icon: "⦿" },
  horizontal: { label: "Horizontal", icon: "⟷" },
  vertical: { label: "Vertical", icon: "↕" },
  parallel: { label: "Parallel", icon: "∥" },
  perpendicular: { label: "Perpendicular", icon: "⊥" },
  equal: { label: "Equal", icon: "=" },
  tangent: { label: "Tangent", icon: "◠" },
  pointOnLine: { label: "On line", icon: "⋯" },
  pointOnCircle: { label: "On circle", icon: "◌" },
  midpoint: { label: "Midpoint", icon: "◇" },
  concentric: { label: "Concentric", icon: "◎" },
  fix: { label: "Fix", icon: "🔒" },
  collinear: { label: "Collinear", icon: "⫽" },
  symmetric: { label: "Symmetric", icon: "⇋" },
  distance: { label: "Distance", icon: "↔", dim: true },
  hdistance: { label: "Horizontal distance", icon: "⇿", dim: true },
  vdistance: { label: "Vertical distance", icon: "⇳", dim: true },
  pointLineDistance: { label: "Distance", icon: "↔", dim: true },
  length: { label: "Length", icon: "↔", dim: true },
  radius: { label: "Radius", icon: "R", dim: true },
  diameter: { label: "Diameter", icon: "⌀", dim: true },
  angle: { label: "Angle", icon: "∠", dim: true },
};

const hyp = Math.hypot;

export class SketchSystem {
  constructor(sketch) {
    this.sketch = sketch;
    this.build();
  }

  build() {
    const s = this.sketch;
    this.vars = [];
    this.pIndex = new Map();
    this.rIndex = new Map();
    for (const p of s.points) {
      this.pIndex.set(p.id, this.vars.length);
      this.vars.push(p.x, p.y);
    }
    for (const e of s.entities) {
      if (e.type === "circle") {
        this.rIndex.set(e.id, this.vars.length);
        this.vars.push(e.r);
      }
    }
    this.ent = new Map(s.entities.map((e) => [e.id, e]));
    this.eqs = [];
    // implicit: arcs keep both ends on the same radius
    for (const e of s.entities) {
      if (e.type === "arc") this.eqs.push({ src: null, f: (v) => this.dist(v, e.c, e.p1) - this.dist(v, e.c, e.p2) });
    }
    for (const c of s.constraints) {
      if (c.driving === false) continue;
      for (const f of this.residuals(c)) this.eqs.push({ src: c.id, f });
    }
  }

  px(v, id) { return v[this.pIndex.get(id)]; }
  py(v, id) { return v[this.pIndex.get(id) + 1]; }
  dist(v, a, b) { return hyp(this.px(v, a) - this.px(v, b), this.py(v, a) - this.py(v, b)); }
  rad(v, eid) {
    const e = this.ent.get(eid);
    if (e.type === "circle") return v[this.rIndex.get(eid)];
    if (e.type === "arc") return this.dist(v, e.c, e.p1);
    return 0;
  }
  center(e) { return e.c; }
  lineDir(v, e) { return [this.px(v, e.p2) - this.px(v, e.p1), this.py(v, e.p2) - this.py(v, e.p1)]; }
  lineLen(v, e) { const d = this.lineDir(v, e); return hyp(d[0], d[1]); }
  // signed distance of point (x,y) to infinite line e
  ptLine(v, x, y, e) {
    const x1 = this.px(v, e.p1), y1 = this.py(v, e.p1);
    const [dx, dy] = this.lineDir(v, e);
    const L = hyp(dx, dy) || 1e-9;
    return ((x - x1) * dy - (y - y1) * dx) / L;
  }

  residuals(c) {
    const E = (id) => this.ent.get(id);
    const out = [];
    const a = c.a, b = c.b;
    switch (c.type) {
      case "coincident":
        out.push((v) => this.px(v, a) - this.px(v, b), (v) => this.py(v, a) - this.py(v, b));
        break;
      case "horizontal": {
        const e = E(a);
        if (e && e.type === "line") out.push((v) => this.py(v, e.p1) - this.py(v, e.p2));
        else out.push((v) => this.py(v, a) - this.py(v, b));
        break;
      }
      case "vertical": {
        const e = E(a);
        if (e && e.type === "line") out.push((v) => this.px(v, e.p1) - this.px(v, e.p2));
        else out.push((v) => this.px(v, a) - this.px(v, b));
        break;
      }
      case "parallel": {
        const e1 = E(a), e2 = E(b);
        out.push((v) => {
          const d1 = this.lineDir(v, e1), d2 = this.lineDir(v, e2);
          return (d1[0] * d2[1] - d1[1] * d2[0]) / ((hyp(...d1) * hyp(...d2)) || 1e-9);
        });
        break;
      }
      case "perpendicular": {
        const e1 = E(a), e2 = E(b);
        out.push((v) => {
          const d1 = this.lineDir(v, e1), d2 = this.lineDir(v, e2);
          return (d1[0] * d2[0] + d1[1] * d2[1]) / ((hyp(...d1) * hyp(...d2)) || 1e-9);
        });
        break;
      }
      case "collinear": {
        const e1 = E(a), e2 = E(b);
        out.push((v) => this.ptLine(v, this.px(v, e2.p1), this.py(v, e2.p1), e1));
        out.push((v) => this.ptLine(v, this.px(v, e2.p2), this.py(v, e2.p2), e1));
        break;
      }
      case "equal": {
        const e1 = E(a), e2 = E(b);
        if (e1.type === "line" && e2.type === "line") out.push((v) => this.lineLen(v, e1) - this.lineLen(v, e2));
        else out.push((v) => this.rad(v, a) - this.rad(v, b));
        break;
      }
      case "tangent": {
        const e1 = E(a), e2 = E(b);
        if (e1.type === "line" || e2.type === "line") {
          const L = e1.type === "line" ? e1 : e2;
          const C = e1.type === "line" ? e2 : e1;
          out.push((v) => Math.abs(this.ptLine(v, this.px(v, C.c), this.py(v, C.c), L)) - this.rad(v, C.id));
        } else {
          const inner = !!c.inner;
          out.push((v) => {
            const d = this.dist(v, e1.c, e2.c);
            return inner ? d - Math.abs(this.rad(v, a) - this.rad(v, b)) : d - (this.rad(v, a) + this.rad(v, b));
          });
        }
        break;
      }
      case "pointOnLine": {
        const e = E(b);
        out.push((v) => this.ptLine(v, this.px(v, a), this.py(v, a), e));
        break;
      }
      case "pointOnCircle": {
        const e = E(b);
        out.push((v) => hyp(this.px(v, a) - this.px(v, e.c), this.py(v, a) - this.py(v, e.c)) - this.rad(v, b));
        break;
      }
      case "midpoint": {
        const e = E(b);
        out.push((v) => this.px(v, a) - (this.px(v, e.p1) + this.px(v, e.p2)) / 2);
        out.push((v) => this.py(v, a) - (this.py(v, e.p1) + this.py(v, e.p2)) / 2);
        break;
      }
      case "concentric": {
        const e1 = E(a), e2 = E(b);
        out.push((v) => this.px(v, e1.c) - this.px(v, e2.c), (v) => this.py(v, e1.c) - this.py(v, e2.c));
        break;
      }
      case "fix": {
        const fx = c.x, fy = c.y;
        out.push((v) => this.px(v, a) - fx, (v) => this.py(v, a) - fy);
        break;
      }
      case "symmetric": {
        const e = E(c.line);
        out.push((v) => this.ptLine(v, (this.px(v, a) + this.px(v, b)) / 2, (this.py(v, a) + this.py(v, b)) / 2, e));
        out.push((v) => {
          const d = this.lineDir(v, e);
          return ((this.px(v, b) - this.px(v, a)) * d[0] + (this.py(v, b) - this.py(v, a)) * d[1]) / (hyp(...d) || 1e-9);
        });
        break;
      }
      case "distance":
        out.push((v) => this.dist(v, a, b) - c.value);
        break;
      case "hdistance":
        out.push((v) => Math.abs(this.px(v, b) - this.px(v, a)) - c.value);
        break;
      case "vdistance":
        out.push((v) => Math.abs(this.py(v, b) - this.py(v, a)) - c.value);
        break;
      case "pointLineDistance": {
        const e = E(b);
        out.push((v) => Math.abs(this.ptLine(v, this.px(v, a), this.py(v, a), e)) - c.value);
        break;
      }
      case "length": {
        const e = E(a);
        out.push((v) => this.lineLen(v, e) - c.value);
        break;
      }
      case "radius":
        out.push((v) => this.rad(v, a) - c.value);
        break;
      case "diameter":
        out.push((v) => 2 * this.rad(v, a) - c.value);
        break;
      case "angle": {
        const e1 = E(a), e2 = E(b);
        const target = (c.value * Math.PI) / 180;
        out.push((v) => {
          const d1 = this.lineDir(v, e1), d2 = this.lineDir(v, e2);
          let ang = Math.atan2(d1[0] * d2[1] - d1[1] * d2[0], d1[0] * d2[0] + d1[1] * d2[1]);
          let diff = Math.abs(ang) - target;
          return diff * 10; // scale so it weighs like a few mm
        });
        break;
      }
    }
    return out;
  }

  evalAll(v, extra) {
    const r = new Float64Array(this.eqs.length + (extra ? extra.length : 0));
    for (let i = 0; i < this.eqs.length; i++) r[i] = this.eqs[i].f(v);
    if (extra) for (let i = 0; i < extra.length; i++) r[this.eqs.length + i] = extra[i](v);
    return r;
  }

  jacobian(v, r0, extra) {
    const n = v.length, m = r0.length;
    const J = new Array(m);
    for (let i = 0; i < m; i++) J[i] = new Float64Array(n);
    const all = extra ? [...this.eqs.map((e) => e.f), ...extra] : this.eqs.map((e) => e.f);
    for (let j = 0; j < n; j++) {
      const h = 1e-7 * Math.max(1, Math.abs(v[j]));
      const old = v[j];
      v[j] = old + h;
      for (let i = 0; i < m; i++) J[i][j] = (all[i](v) - r0[i]) / h;
      v[j] = old;
    }
    return J;
  }

  // Levenberg–Marquardt. `drag` = {id, x, y} adds a weak pull of a point (or circle rim) towards the cursor.
  solve({ drag = null, maxIter = 60 } = {}) {
    if (drag) {
      // phase 1: pull towards the cursor while respecting constraints as well as possible,
      // phase 2: polish so every constraint is exactly satisfied again.
      const first = this.lm(this.vars.slice(), drag, 25);
      return this.lm(first.vars, null, maxIter);
    }
    return this.lm(this.vars.slice(), null, maxIter);
  }

  lm(v, drag, maxIter) {
    let extra = null;
    if (drag) {
      const w = 0.3;
      extra = [];
      for (const d of [].concat(drag)) {
        if (d.radiusOf) {
          const e = this.ent.get(d.radiusOf);
          extra.push((vv) => w * (hyp(d.x - this.px(vv, e.c), d.y - this.py(vv, e.c)) - this.rad(vv, e.id)));
        } else if (this.pIndex.has(d.id)) {
          extra.push((vv) => w * (this.px(vv, d.id) - d.x), (vv) => w * (this.py(vv, d.id) - d.y));
        }
      }
    }
    let r = this.evalAll(v, extra);
    let cost = sumsq(r);
    let lambda = 1e-3;
    const n = v.length;
    if (n === 0) return { ok: true, residual: 0, vars: v };
    for (let it = 0; it < maxIter && cost > 1e-20; it++) {
      const J = this.jacobian(v, r, extra);
      const m = r.length;
      const A = new Array(n);
      const g = new Float64Array(n);
      for (let i = 0; i < n; i++) A[i] = new Float64Array(n);
      for (let k = 0; k < m; k++) {
        const row = J[k], rk = r[k];
        for (let i = 0; i < n; i++) {
          const ri = row[i];
          if (ri === 0) continue;
          g[i] += ri * rk;
          const Ai = A[i];
          for (let j = 0; j < n; j++) if (row[j] !== 0) Ai[j] += ri * row[j];
        }
      }
      let improved = false;
      for (let tries = 0; tries < 12; tries++) {
        const M = A.map((row, i) => { const c = Float64Array.from(row); c[i] += lambda * (1 + row[i]); return c; });
        const dx = solveLinear(M, g.map((x) => -x));
        if (!dx) { lambda *= 10; continue; }
        const nv = v.map((x, i) => x + dx[i]);
        const nr = this.evalAll(nv, extra);
        const nc = sumsq(nr);
        if (nc < cost) {
          for (let i = 0; i < n; i++) v[i] = nv[i];
          r = nr; cost = nc; lambda = Math.max(lambda / 5, 1e-12); improved = true;
          break;
        }
        lambda *= 8;
      }
      if (!improved) break;
    }
    const cr = this.evalAll(v, null);
    const residual = Math.sqrt(sumsq(cr));
    return { ok: residual < 1e-5, residual, vars: v };
  }

  apply(vars) {
    const s = this.sketch;
    for (const p of s.points) {
      const i = this.pIndex.get(p.id);
      p.x = vars[i]; p.y = vars[i + 1];
    }
    for (const e of s.entities) if (e.type === "circle") e.r = Math.abs(vars[this.rIndex.get(e.id)]);
    this.vars = vars.slice();
  }

  // degrees of freedom left = unknowns - rank(J)
  dof() {
    const v = this.vars.slice();
    const r = this.evalAll(v, null);
    if (!r.length) return v.length;
    const J = this.jacobian(v, r, null);
    return v.length - rank(J);
  }

  // which unknowns are still free (for colouring under-constrained geometry), via the RREF of J
  freeVars() {
    const v = this.vars.slice();
    const n = v.length;
    const r = this.evalAll(v, null);
    const free = new Array(n).fill(true);
    if (!r.length) return free;
    const M = this.jacobian(v, r, null).map((row) => Float64Array.from(row));
    const m = M.length;
    const pivotRow = new Array(n).fill(-1);
    let rk = 0;
    for (let c = 0; c < n && rk < m; c++) {
      let p = rk, best = Math.abs(M[rk][c]);
      for (let i = rk + 1; i < m; i++) if (Math.abs(M[i][c]) > best) { best = Math.abs(M[i][c]); p = i; }
      if (best < 1e-7) continue;
      [M[rk], M[p]] = [M[p], M[rk]];
      const piv = M[rk][c];
      for (let j = c; j < n; j++) M[rk][j] /= piv;
      for (let i = 0; i < m; i++) {
        if (i === rk) continue;
        const f = M[i][c];
        if (Math.abs(f) < 1e-15) continue;
        for (let j = c; j < n; j++) M[i][j] -= f * M[rk][j];
      }
      pivotRow[c] = rk;
      rk++;
    }
    const freeCols = [];
    for (let c = 0; c < n; c++) if (pivotRow[c] < 0) freeCols.push(c);
    for (let c = 0; c < n; c++) {
      if (pivotRow[c] < 0) { free[c] = true; continue; }
      const row = M[pivotRow[c]];
      free[c] = freeCols.some((f) => Math.abs(row[f]) > 1e-6);
    }
    return free;
  }
}

function sumsq(r) { let s = 0; for (const x of r) s += x * x; return s; }

function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
    if (Math.abs(M[p][c]) < 1e-14) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let i = c + 1; i < n; i++) {
      const f = M[i][c] / M[c][c];
      if (f === 0) continue;
      for (let j = c; j <= n; j++) M[i][j] -= f * M[c][j];
    }
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

export function rank(Jin, tol = 1e-7) {
  const M = Jin.map((r) => Float64Array.from(r));
  const m = M.length, n = m ? M[0].length : 0;
  let rk = 0;
  for (let c = 0; c < n && rk < m; c++) {
    let p = rk, best = Math.abs(M[rk][c]);
    for (let i = rk + 1; i < m; i++) if (Math.abs(M[i][c]) > best) { best = Math.abs(M[i][c]); p = i; }
    if (best < tol) continue;
    [M[rk], M[p]] = [M[p], M[rk]];
    for (let i = rk + 1; i < m; i++) {
      const f = M[i][c] / M[rk][c];
      if (f === 0) continue;
      for (let j = c; j < n; j++) M[i][j] -= f * M[rk][j];
    }
    rk++;
  }
  return rk;
}

// Solve a sketch in place; returns {ok, dof}
export function solveSketch(sketch, opts = {}) {
  const sys = new SketchSystem(sketch);
  const res = sys.solve(opts);
  if (res.ok || opts.drag || opts.force) sys.apply(res.vars);
  return { ok: res.ok, residual: res.residual, system: sys };
}
