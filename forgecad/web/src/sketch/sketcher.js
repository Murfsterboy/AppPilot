// Touch-first 2D sketch editor drawn on a canvas over the viewport.
import { uid } from "../core/doc.js";
import { evaluate } from "../core/expr.js";
import { SketchSystem, CONSTRAINT_INFO } from "./solver.js";
import { pointMap, sampleEntity, arcAngles, findRegions, circumcenter, entityCurve, TAU } from "./profiles.js";
import { distanceTo, paramOf, pointAt } from "./geom2d.js";
import { trimAt, extendAt, filletCorner, offsetEntities, mirrorEntities, removeEntities, mergePoints, addPoint, entityPointIds, cleanupPoints } from "./sketch-ops.js";
import { h, toast, promptBox, fmt } from "../ui/dom.js";
import { icon } from "../ui/icons.js";

export const SKETCH_TOOLS = [
  { id: "select", label: "Select", icon: "select" },
  { id: "line", label: "Line", icon: "line" },
  { id: "rect", label: "Rectangle", icon: "rect" },
  { id: "rectCenter", label: "Centre rect", icon: "rectCenter" },
  { id: "circle", label: "Circle", icon: "circle" },
  { id: "arc3", label: "3-pt arc", icon: "arc3" },
  { id: "arcCenter", label: "Centre arc", icon: "arc" },
  { id: "polygon", label: "Polygon", icon: "polygon" },
  { id: "slot", label: "Slot", icon: "slot" },
  { id: "spline", label: "Spline", icon: "spline" },
  { id: "point", label: "Point", icon: "point" },
  { id: "dimension", label: "Dimension", icon: "dimension" },
  { id: "trim", label: "Trim", icon: "trim" },
  { id: "extend", label: "Extend", icon: "extend" },
  { id: "fillet", label: "Fillet", icon: "fillet2d" },
  { id: "offset", label: "Offset", icon: "offset" },
  { id: "mirror", label: "Mirror", icon: "mirror" },
  { id: "construction", label: "Construct", icon: "construction" },
  { id: "project", label: "Project", icon: "import" },
];

export const CONSTRAINT_TOOLS = ["coincident", "horizontal", "vertical", "parallel", "perpendicular", "tangent", "equal", "midpoint", "concentric", "collinear", "symmetric", "pointOnLine", "fix"];

const HINTS = {
  select: "Tap to select · drag points to move · drag empty space to pan",
  line: "Tap points (or drag) to draw lines · tap the start to close · tap ✓ to finish",
  rect: "Tap two opposite corners",
  rectCenter: "Tap the centre, then a corner",
  circle: "Tap the centre, then a point on the circle",
  arc3: "Tap start, end, then a point on the arc",
  arcCenter: "Tap the centre, the start, then the end (counter-clockwise)",
  polygon: "Tap the centre, then a corner",
  slot: "Tap the first centre, the second centre, then the width",
  spline: "Tap points along the curve · tap the first point to close · ✓ to finish",
  point: "Tap to place points",
  dimension: "Tap a line, circle, arc, or two items to dimension",
  trim: "Tap the part of a curve to cut away",
  extend: "Tap near the end of a line to extend it",
  fillet: "Tap a corner where two lines meet",
  offset: "Tap curves to offset (whole chains are picked), then ✓",
  mirror: "Tap curves to mirror, then ✓, then tap the mirror line",
  construction: "Tap curves to switch construction on/off",
  project: "Tap a grey model edge to bring it into the sketch",
};

const CONSTRAINT_NEEDS = {
  coincident: "two points (or a point and a curve)", horizontal: "a line or two points", vertical: "a line or two points",
  parallel: "two lines", perpendicular: "two lines", tangent: "a line and a circle/arc, or two circles", equal: "two lines or two circles",
  midpoint: "a point and a line", concentric: "two circles/arcs", collinear: "two lines", symmetric: "two points and a line",
  pointOnLine: "a point and a curve", fix: "points or curves",
};

export class Sketcher {
  constructor(app, stage) {
    this.app = app;
    this.stage = stage;
    this.canvas = h("canvas", { class: "sketch-canvas", style: { touchAction: "none", zIndex: 3 } });
    this.ctx = this.canvas.getContext("2d");
    this.active = false;
    this.pointers = new Map();
    this.history = [];
    this.future = [];
    this.gridSnap = true;
    this.constructionMode = false;
    this.polySides = 6;
    this.filletR = 2;
    this.offsetD = 2;
    this.bindEvents();
  }

  // ---------- lifecycle ----------
  open(sk, { refEdges = [], params = {}, onChange }) {
    this.sk = sk;
    if (!sk.points.find((p) => p.id === "O")) sk.points.unshift({ id: "O", x: 0, y: 0, keep: true });
    if (!sk.constraints.find((c) => c.type === "fix" && c.a === "O")) sk.constraints.push({ id: uid("k"), type: "fix", a: "O", x: 0, y: 0, hidden: true });
    this.refEdges = refEdges; // [{pts:[[u,v],...], inPlane}]
    this.params = params;
    this.onChange = onChange;
    this.history = [];
    this.future = [];
    this.sel = new Set();
    this.tool = "select";
    this.ts = { clicks: [] };
    this.cursor = null;
    this.active = true;
    this.stage.appendChild(this.canvas);
    this.labelHits = [];
    this.glyphHits = [];
    this.resize();
    this.refreshDims();
    this.solve();
    this.fitView();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.stage);
    this.redraw();
  }

  close() {
    this.active = false;
    this.cancelDimEdit();
    this.canvas.remove();
    this.ro && this.ro.disconnect();
    return this.sk;
  }

  resize() {
    const r = this.stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.dpr = dpr;
    this.W = r.width; this.H = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.canvas.style.width = r.width + "px";
    this.canvas.style.height = r.height + "px";
    if (!this.view) this.view = { s: 4, ox: r.width / 2, oy: r.height / 2 };
    this.redraw();
  }

  // ---------- coordinates ----------
  toScreen(x, y) { return [x * this.view.s + this.view.ox, -y * this.view.s + this.view.oy]; }
  toSketch(sx, sy) { return [(sx - this.view.ox) / this.view.s, -(sy - this.view.oy) / this.view.s]; }
  evPos(e) { const r = this.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  fitView() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const add = (x, y) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
    const pts = pointMap(this.sk);
    for (const e of this.sk.entities) for (const [x, y] of sampleEntity(e, pts, 24)) add(x, y);
    for (const r of this.refEdges) for (const [x, y] of r.pts) add(x, y);
    if (!Number.isFinite(minX)) { minX = -40; maxX = 40; minY = -40; maxY = 40; }
    add(0, 0);
    const w = Math.max(maxX - minX, 10), hh = Math.max(maxY - minY, 10);
    const s = Math.min((this.W * 0.8) / w, (this.H * 0.7) / hh);
    this.view.s = Math.max(0.05, Math.min(400, s));
    this.view.ox = this.W / 2 - ((minX + maxX) / 2) * this.view.s;
    this.view.oy = this.H / 2 + ((minY + maxY) / 2) * this.view.s;
    this.redraw();
  }

  // ---------- history ----------
  snapshot() { this.history.push(JSON.stringify({ p: this.sk.points, e: this.sk.entities, c: this.sk.constraints })); if (this.history.length > 100) this.history.shift(); this.future = []; }
  restore(str) { const d = JSON.parse(str); this.sk.points = d.p; this.sk.entities = d.e; this.sk.constraints = d.c; }
  undo() { if (!this.history.length) return; this.future.push(JSON.stringify({ p: this.sk.points, e: this.sk.entities, c: this.sk.constraints })); this.restore(this.history.pop()); this.sel.clear(); this.changed(); }
  redo() { if (!this.future.length) return; this.history.push(JSON.stringify({ p: this.sk.points, e: this.sk.entities, c: this.sk.constraints })); this.restore(this.future.pop()); this.sel.clear(); this.changed(); }

  changed() {
    this.solve();
    this.regionsCache = null;
    this.redraw();
    this.onChange && this.onChange(this.sk);
  }

  refreshDims() {
    for (const c of this.sk.constraints) if (c.expr !== undefined) { try { c.value = evaluate(c.expr, this.params); } catch (_) {} }
  }

  solve() {
    const sys = new SketchSystem(this.sk);
    const res = sys.solve();
    sys.apply(res.vars);
    this.solveOk = res.ok;
    try {
      const free = sys.freeVars();
      this.freePts = new Set();
      for (const [id, i] of sys.pIndex) if (free[i] || free[i + 1]) this.freePts.add(id);
      this.freeRad = new Set();
      for (const [id, i] of sys.rIndex) if (free[i]) this.freeRad.add(id);
      this.dofCount = free.filter(Boolean).length;
    } catch (_) { this.freePts = new Set(); this.freeRad = new Set(); this.dofCount = 0; }
    return res.ok;
  }

  // Add constraints atomically; reject if they conflict or add nothing.
  tryConstrain(list, { silent = false } = {}) {
    const before = JSON.stringify(this.sk);
    const sysA = new SketchSystem(this.sk);
    const dofA = sysA.dof();
    for (const c of list) this.sk.constraints.push({ id: uid("k"), ...c });
    const sysB = new SketchSystem(this.sk);
    const res = sysB.solve();
    if (!res.ok) {
      Object.assign(this.sk, JSON.parse(before));
      if (!silent) toast("That conflicts with existing constraints", "err");
      return false;
    }
    const dofB = new SketchSystem((sysB.apply(res.vars), this.sk)).dof();
    if (dofB >= dofA && !list.every((c) => c.type === "fix")) {
      Object.assign(this.sk, JSON.parse(before));
      if (!silent) toast("Already constrained that way");
      return false;
    }
    return true;
  }

  // ---------- hit testing ----------
  hitTest(sx, sy, { points = true, entities = true, labels = true, tol = 18 } = {}) {
    if (labels) {
      for (const L of this.labelHits) if (sx >= L.x0 - 6 && sx <= L.x1 + 6 && sy >= L.y0 - 6 && sy <= L.y1 + 6) return { kind: "constraint", id: L.id };
      for (const g of this.glyphHits) if (Math.hypot(sx - g.x, sy - g.y) < 12) return { kind: "constraint", id: g.id };
    }
    const pts = pointMap(this.sk);
    if (points) {
      let best = null;
      for (const p of this.sk.points) {
        const [px, py] = this.toScreen(p.x, p.y);
        const d = Math.hypot(px - sx, py - sy);
        if (d < tol && (!best || d < best.d)) best = { kind: "point", id: p.id, d };
      }
      if (best) return best;
    }
    if (entities) {
      const [x, y] = this.toSketch(sx, sy);
      let best = null;
      for (const e of this.sk.entities) {
        if (e.type === "point") continue;
        const c = entityCurve(e, pts);
        const d = distanceTo(c, [x, y]) * this.view.s;
        if (d < tol && (!best || d < best.d)) best = { kind: "entity", id: e.id, d };
      }
      if (best) return best;
    }
    return null;
  }

  hitRef(sx, sy) {
    const [x, y] = this.toSketch(sx, sy);
    let best = null;
    this.refEdges.forEach((r, i) => {
      for (let k = 0; k + 1 < r.pts.length; k++) {
        const c = { kind: "line", a: r.pts[k], b: r.pts[k + 1] };
        const d = distanceTo(c, [x, y]) * this.view.s;
        if (d < 18 && (!best || d < best.d)) best = { i, d };
      }
    });
    return best ? best.i : -1;
  }

  // snapping for drawing tools
  snap(sx, sy, from = null) {
    const pts = pointMap(this.sk);
    const tol = 16;
    const hit = this.hitTest(sx, sy, { labels: false, entities: false, tol });
    if (hit) { const p = pts.get(hit.id); return { x: p.x, y: p.y, pointId: p.id }; }
    let [x, y] = this.toSketch(sx, sy);
    // midpoints and reference vertices
    for (const e of this.sk.entities) {
      if (e.type !== "line") continue;
      const a = pts.get(e.p1), b = pts.get(e.p2);
      const m = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      const [mx, my] = this.toScreen(m[0], m[1]);
      if (Math.hypot(mx - sx, my - sy) < tol * 0.8) return { x: m[0], y: m[1], mid: e.id };
    }
    for (const r of this.refEdges) {
      for (const p of [r.pts[0], r.pts[r.pts.length - 1], ...(r.center ? [r.center] : [])]) {
        const [rx, ry] = this.toScreen(p[0], p[1]);
        if (Math.hypot(rx - sx, ry - sy) < tol) return { x: p[0], y: p[1], ref: true };
      }
    }
    // on a curve
    const eh = this.hitTest(sx, sy, { labels: false, points: false, tol: 10 });
    let on = null;
    if (eh) {
      const e = this.sk.entities.find((q) => q.id === eh.id);
      const c = entityCurve(e, pts);
      let t = paramOf(c, [x, y]);
      if (t !== null) {
        if (c.kind === "line") t = Math.max(0, Math.min(1, t));
        const p = pointAt(c, t);
        x = p[0]; y = p[1]; on = e.id;
      }
    }
    let inferH = false, inferV = false;
    if (!on && from) {
      const dx = x - from.x, dy = y - from.y;
      const ang = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
      if (Math.hypot(dx, dy) * this.view.s > 12) {
        if (ang < 4 || ang > 176) { y = from.y; inferH = true; }
        else if (Math.abs(ang - 90) < 4) { x = from.x; inferV = true; }
      }
    }
    if (!on && this.gridSnap) {
      const g = this.gridStep();
      const fine = g / 5;
      if (!inferV) x = Math.round(x / fine) * fine;
      if (!inferH) y = Math.round(y / fine) * fine;
    }
    // align with other points (dotted guides)
    let guide = null;
    if (!on) {
      for (const p of this.sk.points) {
        if (from && p.id === from.pointId) continue;
        const [px, py] = this.toScreen(p.x, p.y);
        const [cx, cy] = this.toScreen(x, y);
        if (!inferV && Math.abs(px - cx) < 7 && Math.abs(py - cy) > 20) { x = p.x; guide = { x: p.x, y: p.y, dir: "v" }; break; }
        if (!inferH && Math.abs(py - cy) < 7 && Math.abs(px - cx) > 20) { y = p.y; guide = { x: p.x, y: p.y, dir: "h" }; break; }
      }
    }
    return { x, y, on, inferH, inferV, guide };
  }

  gridStep() {
    const target = 60 / this.view.s; // ~60 px
    const p = Math.pow(10, Math.floor(Math.log10(target)));
    for (const m of [1, 2, 5, 10]) if (p * m >= target) return p * m;
    return p * 10;
  }

  // create (or reuse) a point for a snap result, adding inferred constraints later
  pointFor(sn) {
    if (sn.pointId) return sn.pointId;
    const id = uid("p");
    this.sk.points.push({ id, x: sn.x, y: sn.y });
    if (sn.on) {
      const e = this.sk.entities.find((q) => q.id === sn.on);
      if (e) this.sk.constraints.push({ id: uid("k"), type: e.type === "line" ? "pointOnLine" : "pointOnCircle", a: id, b: e.id });
    }
    if (sn.mid) this.sk.constraints.push({ id: uid("k"), type: "midpoint", a: id, b: sn.mid });
    return id;
  }

  newEntity(e) {
    e.id = e.id || uid("e");
    if (this.constructionMode) e.construction = true;
    this.sk.entities.push(e);
    return e;
  }

  // ---------- tools ----------
  setTool(t) {
    if (this.tool === t && (t === "line" || t === "spline")) { this.finishTool(); return; }
    this.finishTool(true);
    this.tool = t;
    this.ts = { clicks: [], picks: [] };
    if (t.startsWith("c:")) {
      const type = t.slice(2);
      // apply directly to an existing selection when possible
      if (this.sel.size && this.applyConstraint(type, [...this.sel].map((id) => this.kindOf(id)))) { this.sel.clear(); this.tool = "select"; this.changed(); this.app.onSketchToolChanged && this.app.onSketchToolChanged(); return; }
      this.sel.clear();
      this.app.setHint(`${CONSTRAINT_INFO[type].label}: select ${CONSTRAINT_NEEDS[type]}`);
    } else this.app.setHint(HINTS[t] || "");
    if (t !== "select" && t !== "offset" && t !== "mirror") this.sel.clear();
    this.redraw();
    this.app.onSketchToolChanged && this.app.onSketchToolChanged();
  }

  kindOf(id) {
    if (this.sk.points.find((p) => p.id === id)) return { kind: "point", id };
    if (this.sk.entities.find((e) => e.id === id)) return { kind: "entity", id };
    return { kind: "constraint", id };
  }

  finishTool(silent) {
    const t = this.tool, st = this.ts;
    if (t === "spline" && st.clicks && st.clicks.length >= 2) {
      this.snapshot();
      const ids = st.clicks.map((sn) => this.pointFor(sn));
      this.newEntity({ type: "spline", pts: ids, closed: false });
      this.changed();
    }
    if ((t === "offset" || t === "mirror") && !silent && this.sel.size) { this.runSelectionTool(); return; }
    this.ts = { clicks: [], picks: [] };
    this.redraw();
  }

  async runSelectionTool() {
    const ids = [...this.sel].filter((id) => this.sk.entities.find((e) => e.id === id));
    if (!ids.length) { toast("Select curves first"); return; }
    if (this.tool === "offset") {
      const v = await promptBox("Offset distance", String(this.offsetD), { numeric: true, params: this.params, label: "Positive = to the left of the curve direction (outward for circles). Use a negative value for the other side." });
      if (v === undefined) return;
      const d = evaluate(v, this.params);
      this.offsetD = d;
      this.snapshot();
      offsetEntities(this.sk, ids, d);
      this.sel.clear();
      this.changed();
    } else if (this.tool === "mirror") {
      this.ts.mirrorIds = ids;
      this.sel.clear();
      this.app.setHint("Now tap the line to mirror across");
      this.redraw();
    }
  }

  // chain of entities connected to eid (for offset convenience)
  chainOf(eid) {
    const out = new Set([eid]);
    let grew = true;
    while (grew) {
      grew = false;
      const pts = new Set([...out].flatMap((id) => { const e = this.sk.entities.find((q) => q.id === id); return e.type === "line" || e.type === "arc" ? [e.p1, e.p2] : []; }));
      for (const e of this.sk.entities) {
        if (out.has(e.id) || e.construction || !(e.type === "line" || e.type === "arc")) continue;
        if (pts.has(e.p1) || pts.has(e.p2)) { out.add(e.id); grew = true; }
      }
    }
    return [...out];
  }

  async click(sn, sx, sy) {
    const t = this.tool;
    const st = this.ts;
    const pts = () => pointMap(this.sk);
    switch (t) {
      case "line": {
        if (!st.clicks.length) { st.clicks.push(sn); st.startId = null; break; }
        const last = st.clicks[st.clicks.length - 1];
        if (Math.hypot(sn.x - last.x, sn.y - last.y) * this.view.s < 6) { this.finishTool(); break; }
        this.snapshot();
        const a = st.lastId || this.pointFor(last);
        if (!st.startId) st.startId = a;
        const b = this.pointFor(sn);
        const e = this.newEntity({ type: "line", p1: a, p2: b });
        if (sn.inferH) this.sk.constraints.push({ id: uid("k"), type: "horizontal", a: e.id });
        if (sn.inferV) this.sk.constraints.push({ id: uid("k"), type: "vertical", a: e.id });
        st.clicks.push({ ...sn, pointId: b });
        st.lastId = b;
        this.changed();
        if (b === st.startId) { this.ts = { clicks: [] }; this.redraw(); }
        break;
      }
      case "rect":
      case "rectCenter": {
        st.clicks.push(sn);
        if (st.clicks.length < 2) break;
        this.snapshot();
        const [p, q] = st.clicks;
        let x0, y0, x1, y1;
        if (t === "rect") { x0 = p.x; y0 = p.y; x1 = q.x; y1 = q.y; }
        else { x0 = 2 * p.x - q.x; y0 = 2 * p.y - q.y; x1 = q.x; y1 = q.y; }
        if (Math.abs(x1 - x0) < 1e-6 || Math.abs(y1 - y0) < 1e-6) { st.clicks = []; break; }
        const ids = [
          t === "rect" ? this.pointFor(p) : this.pointFor({ x: x0, y: y0 }),
          this.pointFor({ x: x1, y: y0 }),
          t === "rect" ? this.pointFor(q) : this.pointFor(q),
          this.pointFor({ x: x0, y: y1 }),
        ];
        const L = [];
        for (let i = 0; i < 4; i++) L.push(this.newEntity({ type: "line", p1: ids[i], p2: ids[(i + 1) % 4] }));
        this.sk.constraints.push({ id: uid("k"), type: "horizontal", a: L[0].id }, { id: uid("k"), type: "horizontal", a: L[2].id }, { id: uid("k"), type: "vertical", a: L[1].id }, { id: uid("k"), type: "vertical", a: L[3].id });
        if (t === "rectCenter") {
          const c = this.pointFor(p);
          const d1 = this.newEntity({ type: "line", p1: ids[0], p2: ids[2], construction: true });
          const d2 = this.newEntity({ type: "line", p1: ids[1], p2: ids[3], construction: true });
          d1.construction = d2.construction = true;
          this.sk.constraints.push({ id: uid("k"), type: "midpoint", a: c, b: d1.id }, { id: uid("k"), type: "midpoint", a: c, b: d2.id });
        }
        st.clicks = [];
        this.changed();
        break;
      }
      case "circle": {
        st.clicks.push(sn);
        if (st.clicks.length < 2) break;
        const [c, p] = st.clicks;
        const r = Math.hypot(p.x - c.x, p.y - c.y);
        st.clicks = [];
        if (r < 1e-6) break;
        this.snapshot();
        const e = this.newEntity({ type: "circle", c: this.pointFor(c), r });
        if (p.pointId || p.on) { /* passes through point */ if (p.pointId) this.sk.constraints.push({ id: uid("k"), type: "pointOnCircle", a: p.pointId, b: e.id }); }
        this.changed();
        break;
      }
      case "arc3": {
        st.clicks.push(sn);
        if (st.clicks.length < 3) break;
        const [a, b, m] = st.clicks;
        st.clicks = [];
        const cc = circumcenter([a.x, a.y], [m.x, m.y], [b.x, b.y]);
        if (!cc) break;
        this.snapshot();
        const ida = this.pointFor(a), idb = this.pointFor(b);
        const cid = uid("p");
        this.sk.points.push({ id: cid, x: cc[0], y: cc[1] });
        // CCW from p1 to p2 must pass through m
        const ang = (p) => Math.atan2(p.y - cc[1], p.x - cc[0]);
        const norm = (x) => ((x % TAU) + TAU) % TAU;
        const ccw = norm(ang(m) - ang(a)) < norm(ang(b) - ang(a));
        this.newEntity({ type: "arc", c: cid, p1: ccw ? ida : idb, p2: ccw ? idb : ida });
        this.changed();
        break;
      }
      case "arcCenter": {
        st.clicks.push(sn);
        if (st.clicks.length < 3) break;
        const [c, a, b] = st.clicks;
        st.clicks = [];
        const r = Math.hypot(a.x - c.x, a.y - c.y);
        if (r < 1e-6) break;
        this.snapshot();
        const ang = Math.atan2(b.y - c.y, b.x - c.x);
        const bp = b.pointId ? b : { x: c.x + r * Math.cos(ang), y: c.y + r * Math.sin(ang) };
        this.newEntity({ type: "arc", c: this.pointFor(c), p1: this.pointFor(a), p2: this.pointFor(bp) });
        this.changed();
        break;
      }
      case "polygon": {
        st.clicks.push(sn);
        if (st.clicks.length < 2) break;
        const [c, p] = st.clicks;
        st.clicks = [];
        const r = Math.hypot(p.x - c.x, p.y - c.y);
        if (r < 1e-6) break;
        this.snapshot();
        const n = this.polySides;
        const a0 = Math.atan2(p.y - c.y, p.x - c.x);
        const cid = this.pointFor(c);
        const circ = this.newEntity({ type: "circle", c: cid, r });
        circ.construction = true;
        const ids = [];
        for (let i = 0; i < n; i++) {
          const a = a0 + (i * TAU) / n;
          ids.push(i === 0 && p.pointId ? p.pointId : this.pointFor({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) }));
        }
        const L = [];
        for (let i = 0; i < n; i++) L.push(this.newEntity({ type: "line", p1: ids[i], p2: ids[(i + 1) % n] }));
        for (const id of ids) this.sk.constraints.push({ id: uid("k"), type: "pointOnCircle", a: id, b: circ.id });
        for (let i = 1; i < n; i++) this.sk.constraints.push({ id: uid("k"), type: "equal", a: L[0].id, b: L[i].id });
        this.changed();
        break;
      }
      case "slot": {
        st.clicks.push(sn);
        if (st.clicks.length < 3) break;
        const [p, q, w] = st.clicks;
        st.clicks = [];
        const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy);
        if (L < 1e-6) break;
        const nx = -dy / L, ny = dx / L;
        const r = Math.max(Math.abs((w.x - p.x) * nx + (w.y - p.y) * ny), 1e-3);
        this.snapshot();
        const c1 = this.pointFor(p), c2 = this.pointFor(q);
        const a1 = this.pointFor({ x: p.x + nx * r, y: p.y + ny * r }), b1 = this.pointFor({ x: q.x + nx * r, y: q.y + ny * r });
        const a2 = this.pointFor({ x: p.x - nx * r, y: p.y - ny * r }), b2 = this.pointFor({ x: q.x - nx * r, y: q.y - ny * r });
        const l1 = this.newEntity({ type: "line", p1: a2, p2: b2 });
        const arcQ = this.newEntity({ type: "arc", c: c2, p1: b2, p2: b1 });
        const l2 = this.newEntity({ type: "line", p1: b1, p2: a1 });
        const arcP = this.newEntity({ type: "arc", c: c1, p1: a1, p2: a2 });
        const cl = this.newEntity({ type: "line", p1: c1, p2: c2 });
        cl.construction = true;
        this.sk.constraints.push(
          { id: uid("k"), type: "tangent", a: l1.id, b: arcQ.id }, { id: uid("k"), type: "tangent", a: l2.id, b: arcQ.id },
          { id: uid("k"), type: "tangent", a: l1.id, b: arcP.id }, { id: uid("k"), type: "tangent", a: l2.id, b: arcP.id },
          { id: uid("k"), type: "equal", a: arcP.id, b: arcQ.id }, { id: uid("k"), type: "parallel", a: l1.id, b: cl.id });
        this.changed();
        break;
      }
      case "spline": {
        if (st.clicks.length >= 2 && sn.pointId && st.clicks[0].pointId === sn.pointId) {
          this.snapshot();
          const ids = st.clicks.map((c) => this.pointFor(c));
          this.newEntity({ type: "spline", pts: ids, closed: true });
          this.ts = { clicks: [] };
          this.changed();
          break;
        }
        const id = this.pointFor(sn);
        st.clicks.push({ ...sn, pointId: id });
        this.redraw();
        break;
      }
      case "point": {
        this.snapshot();
        const id = this.pointFor(sn);
        this.newEntity({ type: "point", p: id });
        this.changed();
        break;
      }
    }
    this.redraw();
  }

  // tools that act on what you tap (not on snapped positions)
  async tap(sx, sy) {
    const t = this.tool;
    const hit = this.hitTest(sx, sy, { labels: t === "select" || t === "dimension" });
    const [x, y] = this.toSketch(sx, sy);
    if (t === "select") {
      if (!hit) { this.sel.clear(); this.redraw(); this.app.onSketchSelection && this.app.onSketchSelection(); return; }
      if (hit.kind === "constraint") {
        const c = this.sk.constraints.find((k) => k.id === hit.id);
        if (c && CONSTRAINT_INFO[c.type] && CONSTRAINT_INFO[c.type].dim) { this.editDim(c); return; }
      }
      if (this.sel.has(hit.id)) this.sel.delete(hit.id); else this.sel.add(hit.id);
      this.redraw();
      this.app.onSketchSelection && this.app.onSketchSelection();
      return;
    }
    if (t === "trim" || t === "extend") {
      const eh = this.hitTest(sx, sy, { labels: false, points: false });
      if (!eh) return;
      this.snapshot();
      const ok = t === "trim" ? trimAt(this.sk, eh.id, x, y) : extendAt(this.sk, eh.id, x, y);
      if (!ok) { this.history.pop(); toast(t === "extend" ? "Nothing to extend to" : "Couldn't trim"); return; }
      this.changed();
      return;
    }
    if (t === "construction") {
      const eh = this.hitTest(sx, sy, { labels: false, points: false });
      if (!eh) return;
      this.snapshot();
      const e = this.sk.entities.find((q) => q.id === eh.id);
      e.construction = !e.construction;
      this.changed();
      return;
    }
    if (t === "fillet") {
      const ph = this.hitTest(sx, sy, { labels: false, entities: false, tol: 24 });
      if (!ph) { toast("Tap the corner point"); return; }
      const v = await promptBox("Fillet radius", String(this.filletR), { numeric: true, params: this.params });
      if (v === undefined) return;
      const r = evaluate(v, this.params);
      this.filletR = r;
      this.snapshot();
      const err = filletCorner(this.sk, ph.id, r);
      if (err) { this.history.pop(); toast(err, "err"); return; }
      const rc = this.sk.constraints[this.sk.constraints.length - 1];
      if (rc && rc.type === "radius") rc.expr = v;
      this.changed();
      return;
    }
    if (t === "offset" || (t === "mirror" && !this.ts.mirrorIds)) {
      const eh = this.hitTest(sx, sy, { labels: false, points: false });
      if (!eh) return;
      const ids = t === "offset" ? this.chainOf(eh.id) : [eh.id];
      const all = ids.every((id) => this.sel.has(id));
      for (const id of ids) all ? this.sel.delete(id) : this.sel.add(id);
      this.app.setHint(`${this.sel.size} selected · tap ✓ when done`);
      this.redraw();
      return;
    }
    if (t === "mirror" && this.ts.mirrorIds) {
      const eh = this.hitTest(sx, sy, { labels: false, points: false });
      const e = eh && this.sk.entities.find((q) => q.id === eh.id);
      if (!e || e.type !== "line") { toast("Tap a line"); return; }
      this.snapshot();
      const err = mirrorEntities(this.sk, this.ts.mirrorIds, e.id);
      if (typeof err === "string") { this.history.pop(); toast(err, "err"); return; }
      this.ts = { clicks: [] };
      this.app.setHint(HINTS.mirror);
      this.changed();
      return;
    }
    if (t === "project") {
      const ri = this.hitRef(sx, sy);
      if (ri < 0) { toast("Tap a grey model edge"); return; }
      this.snapshot();
      this.projectRef(this.refEdges[ri]);
      this.changed();
      return;
    }
    if (t === "dimension") { this.dimensionPick(hit, x, y); return; }
    if (t.startsWith("c:")) {
      if (!hit || hit.kind === "constraint") return;
      this.ts.picks.push(hit);
      this.sel.add(hit.id);
      const type = t.slice(2);
      const r = this.applyConstraint(type, this.ts.picks, true);
      if (r === true) { this.ts.picks = []; this.sel.clear(); this.changed(); }
      else if (r === false) { this.ts.picks = []; this.sel.clear(); }
      this.redraw();
    }
  }

  projectRef(r) {
    const P = r.pts;
    if (r.circle) {
      const c = this.pointFor({ x: r.circle.c[0], y: r.circle.c[1] });
      const e = this.newEntity({ type: "circle", c, r: r.circle.r });
      this.sk.constraints.push({ id: uid("k"), type: "fix", a: c, x: r.circle.c[0], y: r.circle.c[1] }, { id: uid("k"), type: "radius", a: e.id, value: r.circle.r, ref: true });
      return;
    }
    const ids = P.map(([x, y]) => addPoint(this.sk, x, y, 1e-6));
    for (let i = 0; i + 1 < ids.length; i++) if (ids[i] !== ids[i + 1]) this.newEntity({ type: "line", p1: ids[i], p2: ids[i + 1] });
    for (const id of new Set(ids)) { const p = this.sk.points.find((q) => q.id === id); this.sk.constraints.push({ id: uid("k"), type: "fix", a: id, x: p.x, y: p.y }); }
  }

  // returns true (applied), false (failed, reset), null (need more picks)
  applyConstraint(type, picks, incremental = false) {
    const pts = picks.filter((p) => p.kind === "point").map((p) => p.id);
    const ents = picks.filter((p) => p.kind === "entity").map((p) => this.sk.entities.find((e) => e.id === p.id)).filter(Boolean);
    const lines = ents.filter((e) => e.type === "line");
    const circles = ents.filter((e) => e.type === "circle" || e.type === "arc");
    const need = (cond) => (cond ? null : incremental ? null : false);
    const doit = (list, merge) => {
      this.snapshot();
      if (merge) { mergePoints(this.sk, merge[0], merge[1]); this.solve(); return true; }
      const ok = this.tryConstrain(list);
      if (!ok) this.history.pop();
      return ok;
    };
    const tooMany = () => { if (incremental) { toast(`${CONSTRAINT_INFO[type].label} needs ${CONSTRAINT_NEEDS[type]}`); } return false; };
    switch (type) {
      case "coincident":
        if (pts.length === 2) return doit(null, [pts[0] === "O" ? "O" : pts[0], pts[0] === "O" ? pts[1] : pts[1]]);
        if (pts.length === 1 && ents.length === 1) return doit([{ type: ents[0].type === "line" ? "pointOnLine" : "pointOnCircle", a: pts[0], b: ents[0].id }]);
        return picks.length >= 2 ? tooMany() : need(false);
      case "pointOnLine":
        if (pts.length === 1 && ents.length === 1) return doit([{ type: ents[0].type === "line" ? "pointOnLine" : "pointOnCircle", a: pts[0], b: ents[0].id }]);
        return picks.length >= 2 ? tooMany() : need(false);
      case "horizontal":
      case "vertical":
        if (lines.length === 1 && picks.length === 1) return doit([{ type, a: lines[0].id }]);
        if (pts.length === 2) return doit([{ type, a: pts[0], b: pts[1] }]);
        if (lines.length > 1 && !incremental) return doit(lines.map((l) => ({ type, a: l.id })));
        return picks.length >= 2 || (picks.length === 1 && !lines.length && pts.length !== 1) ? tooMany() : need(false);
      case "parallel":
      case "perpendicular":
      case "collinear":
        if (lines.length === 2) return doit([{ type, a: lines[0].id, b: lines[1].id }]);
        return picks.length >= 2 ? tooMany() : need(false);
      case "equal":
        if (lines.length === 2 || circles.length === 2) return doit([{ type, a: ents[0].id, b: ents[1].id }]);
        if (!incremental && (lines.length > 2 || circles.length > 2)) { const g = lines.length > 2 ? lines : circles; return doit(g.slice(1).map((e) => ({ type, a: g[0].id, b: e.id }))); }
        return picks.length >= 2 ? tooMany() : need(false);
      case "tangent":
        if (ents.length === 2 && circles.length >= 1) {
          let inner = false;
          if (circles.length === 2) {
            const P = pointMap(this.sk);
            const sys = new SketchSystem(this.sk);
            const d = Math.hypot(P.get(circles[0].c).x - P.get(circles[1].c).x, P.get(circles[0].c).y - P.get(circles[1].c).y);
            inner = d < Math.max(sys.rad(sys.vars, circles[0].id), sys.rad(sys.vars, circles[1].id));
          }
          return doit([{ type, a: ents[0].id, b: ents[1].id, inner }]);
        }
        return picks.length >= 2 ? tooMany() : need(false);
      case "midpoint":
        if (pts.length === 1 && lines.length === 1) return doit([{ type, a: pts[0], b: lines[0].id }]);
        return picks.length >= 2 ? tooMany() : need(false);
      case "concentric":
        if (circles.length === 2) {
          return doit(null, [circles[0].c, circles[1].c]);
        }
        return picks.length >= 2 ? tooMany() : need(false);
      case "symmetric":
        if (pts.length === 2 && lines.length === 1) return doit([{ type, a: pts[0], b: pts[1], line: lines[0].id }]);
        return picks.length >= 3 ? tooMany() : need(false);
      case "fix": {
        const P = pointMap(this.sk);
        const ids = new Set(pts);
        for (const e of ents) for (const id of entityPointIds(e)) ids.add(id);
        if (!ids.size) return need(false);
        const list = [...ids].map((id) => ({ type: "fix", a: id, x: P.get(id).x, y: P.get(id).y }));
        for (const e of ents) if (e.type === "circle") list.push({ type: "radius", a: e.id, value: e.r, expr: fmt(e.r, 4) });
        return doit(list);
      }
    }
    return false;
  }

  // ---------- dimensions ----------
  dimensionPick(hit, x, y) {
    const st = this.ts;
    if (!hit || hit.kind === "constraint") {
      if (hit && hit.kind === "constraint") { const c = this.sk.constraints.find((k) => k.id === hit.id); if (c && c.value !== undefined) this.editDim(c); }
      return;
    }
    st.picks.push(hit);
    this.sel.add(hit.id);
    const picks = st.picks;
    const P = pointMap(this.sk);
    const E = (id) => this.sk.entities.find((e) => e.id === id);
    let spec = null;
    if (picks.length === 1) {
      const p = picks[0];
      if (p.kind === "entity") {
        const e = E(p.id);
        if (e.type === "line") { const a = P.get(e.p1), b = P.get(e.p2); spec = { type: "length", a: e.id, value: Math.hypot(b.x - a.x, b.y - a.y) }; }
        else if (e.type === "circle") spec = { type: "diameter", a: e.id, value: 2 * e.r };
        else if (e.type === "arc") { const [, , r] = arcAngles(P.get(e.c), P.get(e.p1), P.get(e.p2)); spec = { type: "radius", a: e.id, value: r }; }
      }
      if (!spec) { this.app.setHint("Now tap a second point or line"); this.redraw(); return; }
    } else {
      const [p, q] = picks.slice(-2);
      const pt = (k) => P.get(k.id);
      if (p.kind === "point" && q.kind === "point") {
        const a = pt(p), b = pt(q);
        const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
        const type = dy < 1e-6 ? "hdistance" : dx < 1e-6 ? "vdistance" : "distance";
        spec = { type, a: p.id, b: q.id, value: type === "hdistance" ? dx : type === "vdistance" ? dy : Math.hypot(dx, dy), alt: true };
      } else if (p.kind === "entity" && q.kind === "entity" && E(p.id).type === "line" && E(q.id).type === "line") {
        const l1 = E(p.id), l2 = E(q.id);
        const d1 = [P.get(l1.p2).x - P.get(l1.p1).x, P.get(l1.p2).y - P.get(l1.p1).y];
        const d2 = [P.get(l2.p2).x - P.get(l2.p1).x, P.get(l2.p2).y - P.get(l2.p1).y];
        const ang = Math.abs(Math.atan2(d1[0] * d2[1] - d1[1] * d2[0], d1[0] * d2[0] + d1[1] * d2[1]) * 180 / Math.PI);
        if (ang < 0.5 || ang > 179.5) {
          // parallel lines → distance from a point to the other line
          const a = P.get(l1.p1);
          const c = entityCurve(l2, P);
          const dd = Math.abs(((a.x - c.a[0]) * (c.b[1] - c.a[1]) - (a.y - c.a[1]) * (c.b[0] - c.a[0])) / Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]));
          spec = { type: "pointLineDistance", a: l1.p1, b: l2.id, value: dd };
        } else spec = { type: "angle", a: l1.id, b: l2.id, value: ang };
      } else {
        const ptk = p.kind === "point" ? p : q.kind === "point" ? q : null;
        const enk = p.kind === "entity" ? p : q;
        const e = E(enk.id);
        if (ptk && e.type === "line") {
          const a = P.get(ptk.id), c = entityCurve(e, P);
          const dd = Math.abs(((a.x - c.a[0]) * (c.b[1] - c.a[1]) - (a.y - c.a[1]) * (c.b[0] - c.a[0])) / Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]));
          spec = { type: "pointLineDistance", a: ptk.id, b: e.id, value: dd };
        } else if (ptk && (e.type === "circle" || e.type === "arc")) {
          const a = P.get(ptk.id), c = P.get(e.c);
          spec = { type: "distance", a: ptk.id, b: e.c, value: Math.hypot(a.x - c.x, a.y - c.y) };
        } else if (e.type !== "line" && (E(p.id)?.type === "circle" || E(p.id)?.type === "arc") && (E(q.id)?.type === "circle" || E(q.id)?.type === "arc")) {
          const c1 = P.get(E(p.id).c), c2 = P.get(E(q.id).c);
          spec = { type: "distance", a: E(p.id).c, b: E(q.id).c, value: Math.hypot(c1.x - c2.x, c1.y - c2.y) };
        }
      }
    }
    if (!spec) { toast("Can't dimension that combination"); st.picks = []; this.sel.clear(); this.redraw(); return; }
    this.showDimEditor(spec, x, y);
  }

  showDimEditor(spec, x, y) {
    this.cancelDimEdit();
    const isAng = spec.type === "angle";
    const [sx, sy] = this.toScreen(x, y);
    const inp = h("input", { value: fmt(spec.value, 3), inputmode: "decimal", autocomplete: "off" });
    const altBox = h("span");
    if (spec.alt) {
      const P = pointMap(this.sk);
      const a = P.get(spec.a), b = P.get(spec.b);
      const set = (type) => { spec.type = type; spec.value = type === "hdistance" ? Math.abs(b.x - a.x) : type === "vdistance" ? Math.abs(b.y - a.y) : Math.hypot(b.x - a.x, b.y - a.y); inp.value = fmt(spec.value, 3); inp.select(); };
      altBox.append(
        h("button", { class: "btn small", onclick: () => set("distance") }, "⤢"),
        h("button", { class: "btn small", onclick: () => set("hdistance") }, "↔"),
        h("button", { class: "btn small", onclick: () => set("vdistance") }, "↕"));
    }
    const ok = () => {
      let v;
      try { v = evaluate(inp.value, this.params); } catch (e) { toast(e.message, "err"); return; }
      if (!(v > 0) && !isAng) { toast("Must be greater than zero", "err"); return; }
      this.cancelDimEdit();
      this.snapshot();
      const c = { ...spec, value: v, expr: inp.value.trim() };
      delete c.alt;
      if (!this.tryConstrain([c])) this.history.pop();
      this.ts.picks = [];
      this.sel.clear();
      this.changed();
    };
    const box = h("div", { class: "dimedit", style: { left: Math.max(4, Math.min(this.W - 230, sx - 60)) + "px", top: Math.max(4, Math.min(this.H - 50, sy - 64)) + "px" } },
      inp, h("span", { class: "unit", style: { alignSelf: "center" } }, isAng ? "°" : "mm"), altBox,
      h("button", { class: "btn small primary", html: icon("check"), onclick: ok }),
      h("button", { class: "btn small", html: icon("close"), onclick: () => { this.cancelDimEdit(); this.ts.picks = []; this.sel.clear(); this.redraw(); } }));
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") ok(); if (e.key === "Escape") this.cancelDimEdit(); });
    this.stage.appendChild(box);
    this.dimBox = box;
    setTimeout(() => { inp.focus(); inp.select(); }, 30);
  }

  cancelDimEdit() { if (this.dimBox) { this.dimBox.remove(); this.dimBox = null; } }

  async editDim(c) {
    const isAng = c.type === "angle";
    const v = await promptBox(`${CONSTRAINT_INFO[c.type].label}`, c.expr ?? fmt(c.value, 4), { numeric: true, params: this.params, label: `Value in ${isAng ? "degrees" : "mm"}. You can type maths or a parameter name (e.g. width/2).` });
    if (v === undefined) return;
    const val = evaluate(v, this.params);
    this.snapshot();
    const old = { value: c.value, expr: c.expr };
    c.value = val; c.expr = v;
    const sys = new SketchSystem(this.sk);
    const res = sys.solve();
    if (!res.ok) { c.value = old.value; c.expr = old.expr; this.history.pop(); toast("The sketch can't reach that value", "err"); this.solve(); this.redraw(); return; }
    sys.apply(res.vars);
    this.changed();
  }

  deleteSelection() {
    if (!this.sel.size) return;
    this.snapshot();
    const ids = [...this.sel];
    const cons = new Set(ids.filter((id) => this.sk.constraints.find((c) => c.id === id)));
    this.sk.constraints = this.sk.constraints.filter((c) => !cons.has(c.id) || c.hidden);
    const pointIds = new Set(ids.filter((id) => id !== "O" && this.sk.points.find((p) => p.id === id)));
    const entIds = ids.filter((id) => this.sk.entities.find((e) => e.id === id));
    // deleting a point removes the curves that use it
    for (const e of this.sk.entities) if (entityPointIds(e).some((p) => pointIds.has(p)) && e.type !== "spline") entIds.push(e.id);
    for (const e of this.sk.entities) if (e.type === "spline") { e.pts = e.pts.filter((p) => !pointIds.has(p)); if (e.pts.length < 2) entIds.push(e.id); }
    removeEntities(this.sk, entIds);
    this.sk.points = this.sk.points.filter((p) => !pointIds.has(p.id) || p.id === "O");
    this.sk.constraints = this.sk.constraints.filter((c) => ![c.a, c.b, c.line].some((r) => r && pointIds.has(r)));
    cleanupPoints(this.sk);
    this.sel.clear();
    this.changed();
    this.app.onSketchSelection && this.app.onSketchSelection();
  }

  toggleConstructionSelection() {
    const ents = this.sk.entities.filter((e) => this.sel.has(e.id));
    if (!ents.length) return;
    this.snapshot();
    const v = !ents.every((e) => e.construction);
    for (const e of ents) e.construction = v;
    this.changed();
  }

  // contextual constraint suggestions for the current selection
  suggestions() {
    const picks = [...this.sel].map((id) => this.kindOf(id));
    const pts = picks.filter((p) => p.kind === "point");
    const ents = picks.filter((p) => p.kind === "entity").map((p) => this.sk.entities.find((e) => e.id === p.id));
    const lines = ents.filter((e) => e.type === "line"), circ = ents.filter((e) => e.type === "circle" || e.type === "arc");
    const n = picks.length;
    const out = [];
    if (picks.some((p) => p.kind === "constraint")) return out;
    if (n === 1 && lines.length === 1) out.push("horizontal", "vertical", "fix");
    if (n === 1 && circ.length === 1) out.push("fix");
    if (n === 2 && pts.length === 2) out.push("coincident", "horizontal", "vertical");
    if (n === 2 && lines.length === 2) out.push("parallel", "perpendicular", "equal", "collinear");
    if (n === 2 && circ.length === 2) out.push("concentric", "equal", "tangent");
    if (n === 2 && lines.length === 1 && circ.length === 1) out.push("tangent");
    if (n === 2 && pts.length === 1 && ents.length === 1) out.push("coincident", ...(lines.length ? ["midpoint"] : []));
    if (n === 3 && pts.length === 2 && lines.length === 1) out.push("symmetric");
    if (n > 2 && lines.length === n) out.push("horizontal", "vertical", "equal");
    if (n > 2 && circ.length === n) out.push("equal");
    if (pts.length === n && n >= 1 && !out.includes("fix")) out.push("fix");
    return out;
  }

  applySuggestion(type) {
    const picks = [...this.sel].map((id) => this.kindOf(id));
    const r = this.applyConstraint(type, picks);
    if (r) { this.sel.clear(); this.changed(); this.app.onSketchSelection && this.app.onSketchSelection(); }
  }

  async dimensionSelection() {
    const picks = [...this.sel].map((id) => this.kindOf(id));
    this.ts = { clicks: [], picks: [] };
    this.tool = "dimension";
    const P = pointMap(this.sk);
    let last = null;
    for (const p of picks) { this.ts.picks.push(p); last = p; }
    const pick = this.ts.picks.pop();
    if (!pick) return;
    const pt = pick.kind === "point" ? P.get(pick.id) : null;
    const [x, y] = pt ? [pt.x, pt.y] : this.toSketch(this.W / 2, this.H / 2);
    this.dimensionPick(pick, x, y);
    this.tool = "select";
  }

  // ---------- events ----------
  bindEvents() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => this.onDown(e));
    c.addEventListener("pointermove", (e) => this.onMove(e));
    c.addEventListener("pointerup", (e) => this.onUp(e));
    c.addEventListener("pointercancel", (e) => { this.pointers.delete(e.pointerId); this.gesture = null; this.drag = null; this.redraw(); });
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      const [sx, sy] = this.evPos(e);
      const k = Math.exp(-e.deltaY * 0.0015);
      this.zoomAt(sx, sy, k);
    }, { passive: false });
  }

  zoomAt(sx, sy, k) {
    const v = this.view;
    const ns = Math.max(0.02, Math.min(800, v.s * k));
    k = ns / v.s;
    v.ox = sx - (sx - v.ox) * k;
    v.oy = sy - (sy - v.oy) * k;
    v.s = ns;
    this.redraw();
  }

  onDown(e) {
    if (!this.active) return;
    this.canvas.setPointerCapture(e.pointerId);
    const pos = this.evPos(e);
    this.pointers.set(e.pointerId, pos);
    this.isTouch = e.pointerType === "touch";
    if (this.pointers.size === 2) {
      // start pinch; cancel any single-finger action
      const [a, b] = [...this.pointers.values()];
      this.gesture = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
      if (this.drag && this.drag.kind === "point" && this.drag.moved) { this.restore(this.history.pop()); this.solve(); }
      this.drag = null;
      this.down = null;
      return;
    }
    if (this.pointers.size > 2) return;
    if (e.button === 1 || e.button === 2) { this.drag = { kind: "pan", last: pos }; return; }
    this.down = { pos, t: performance.now(), moved: false };
    const t = this.tool;
    if (DRAW_TOOLS.has(t)) {
      const from = this.ts.clicks && this.ts.clicks.length ? this.ts.clicks[this.ts.clicks.length - 1] : null;
      const sn = this.snap(pos[0], pos[1], from);
      this.cursor = sn;
      if (!this.ts.clicks.length) { this.down.firstClick = true; this.click(sn, pos[0], pos[1]); }
      this.redraw();
      return;
    }
    if (t === "select") {
      const hit = this.hitTest(pos[0], pos[1]);
      if (hit && hit.kind === "point" && hit.id !== "O") {
        const p = this.sk.points.find((q) => q.id === hit.id);
        this.drag = { kind: "point", id: hit.id, start: [p.x, p.y], last: pos };
      } else if (hit && hit.kind === "entity") {
        const ent = this.sk.entities.find((q) => q.id === hit.id);
        this.drag = { kind: "entity", ent, last: pos, start: this.toSketch(pos[0], pos[1]), orig: entityPointIds(ent).map((id) => { const p = this.sk.points.find((q) => q.id === id); return { id, x: p.x, y: p.y }; }) };
      } else if (hit && hit.kind === "constraint") {
        const c = this.sk.constraints.find((k) => k.id === hit.id);
        if (c && CONSTRAINT_INFO[c.type] && CONSTRAINT_INFO[c.type].dim) this.drag = { kind: "label", c, last: pos };
      } else this.drag = { kind: "pan", last: pos };
      return;
    }
    // tap tools: pan with drag, act on tap
    this.drag = { kind: "pan", last: pos };
  }

  onMove(e) {
    if (!this.active) return;
    const pos = this.evPos(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, pos);
    if (this.pointers.size === 2 && this.gesture) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      this.view.ox += m[0] - this.gesture.m[0];
      this.view.oy += m[1] - this.gesture.m[1];
      this.zoomAt(m[0], m[1], d / (this.gesture.d || d));
      this.gesture = { d, m };
      return;
    }
    if (this.down && Math.hypot(pos[0] - this.down.pos[0], pos[1] - this.down.pos[1]) > 8) this.down.moved = true;
    const t = this.tool;
    if (DRAW_TOOLS.has(t)) {
      if (e.pointerType === "touch" && !this.pointers.has(e.pointerId)) return;
      const from = this.ts.clicks && this.ts.clicks.length ? this.ts.clicks[this.ts.clicks.length - 1] : null;
      this.cursor = this.snap(pos[0], pos[1], from);
      this.cursorScreen = pos;
      this.redraw();
      return;
    }
    const dr = this.drag;
    if (!dr) { this.hover = this.hitTest(pos[0], pos[1]); this.redraw(); return; }
    if (dr.kind === "pan") {
      this.view.ox += pos[0] - dr.last[0];
      this.view.oy += pos[1] - dr.last[1];
      dr.last = pos;
      this.redraw();
    } else if (dr.kind === "point" && this.down && this.down.moved) {
      if (!dr.moved) { this.snapshot(); dr.moved = true; }
      const [x, y] = this.toSketch(pos[0], pos[1]);
      const sys = new SketchSystem(this.sk);
      const res = sys.solve({ drag: { id: dr.id, x, y } });
      sys.apply(res.vars);
      this.cursorScreen = pos;
      this.redraw();
    } else if (dr.kind === "entity" && this.down && this.down.moved) {
      if (!dr.moved) { this.snapshot(); dr.moved = true; }
      const [x, y] = this.toSketch(pos[0], pos[1]);
      const sys = new SketchSystem(this.sk);
      let drag;
      if (dr.ent.type === "circle") drag = { radiusOf: dr.ent.id, x, y };
      else { const dx = x - dr.start[0], dy = y - dr.start[1]; drag = dr.orig.map((o) => ({ id: o.id, x: o.x + dx, y: o.y + dy })); }
      const res = sys.solve({ drag });
      sys.apply(res.vars);
      this.redraw();
    } else if (dr.kind === "label" && this.down && this.down.moved) {
      const dx = (pos[0] - dr.last[0]) / this.view.s, dy = -(pos[1] - dr.last[1]) / this.view.s;
      dr.c.lx = (dr.c.lx || 0) + dx; dr.c.ly = (dr.c.ly || 0) + dy;
      dr.last = pos;
      this.redraw();
    }
  }

  onUp(e) {
    if (!this.active) return;
    const pos = this.evPos(e);
    const wasPinch = this.pointers.size >= 2 || this.gesture;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) this.gesture = null;
    if (wasPinch) { this.cursorScreen = null; this.down = null; this.redraw(); return; }
    const down = this.down;
    this.down = null;
    const dr = this.drag;
    this.drag = null;
    this.cursorScreen = null;
    if (!down) return;
    const t = this.tool;
    if (DRAW_TOOLS.has(t)) {
      if (down.firstClick && !down.moved) { this.redraw(); return; }
      const from = this.ts.clicks && this.ts.clicks.length ? this.ts.clicks[this.ts.clicks.length - 1] : null;
      const sn = this.snap(pos[0], pos[1], from);
      if (!down.firstClick || down.moved) this.click(sn, pos[0], pos[1]);
      if (this.isTouch) this.cursor = null;
      return;
    }
    if (dr && (dr.kind === "point" || dr.kind === "entity") && dr.moved) { this.changed(); return; }
    if (dr && dr.kind === "label" && down.moved) { this.onChange && this.onChange(this.sk); return; }
    if (!down.moved) this.tap(pos[0], pos[1]);
  }

  // ---------- drawing ----------
  redraw() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = null; this.draw(); });
  }

  colors() {
    const dark = document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    return dark
      ? { bg: "#1a2028", grid: "rgba(150,165,185,.10)", grid2: "rgba(150,165,185,.22)", free: "#5b9dff", fixed: "#e6ebf1", cons: "#ff9a5c", sel: "#ff7a33", ref: "rgba(160,175,195,.45)", refIn: "rgba(190,205,225,.8)", dim: "#8fd0ff", region: "rgba(91,157,255,.10)", text: "#e6ebf1", pt: "#e6ebf1" }
      : { bg: "#f7f9fb", grid: "rgba(60,80,100,.07)", grid2: "rgba(60,80,100,.16)", free: "#2f6fde", fixed: "#1c2530", cons: "#d9701f", sel: "#e8611f", ref: "rgba(90,100,115,.35)", refIn: "rgba(60,70,85,.75)", dim: "#1d5fa8", region: "rgba(47,111,222,.08)", text: "#1c2530", pt: "#1c2530" };
  }

  draw() {
    if (!this.active) return;
    const ctx = this.ctx, dpr = this.dpr, W = this.W, H = this.H;
    const C = this.colors();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    // grid
    const g = this.gridStep();
    const [x0, y1] = this.toSketch(0, 0), [x1, y0] = this.toSketch(W, H);
    ctx.lineWidth = 1;
    for (const [step, col] of [[g / 5, C.grid], [g, C.grid2]]) {
      if (step * this.view.s < 6) continue;
      ctx.strokeStyle = col;
      ctx.beginPath();
      for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) { const [sx] = this.toScreen(x, 0); ctx.moveTo(Math.round(sx) + 0.5, 0); ctx.lineTo(Math.round(sx) + 0.5, H); }
      for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) { const [, sy] = this.toScreen(0, y); ctx.moveTo(0, Math.round(sy) + 0.5); ctx.lineTo(W, Math.round(sy) + 0.5); }
      ctx.stroke();
    }
    // axes
    const [ox, oy] = this.toScreen(0, 0);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(217,83,79,.6)"; ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.stroke();
    ctx.strokeStyle = "rgba(76,175,80,.6)"; ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke();
    // reference geometry
    for (const r of this.refEdges) {
      ctx.strokeStyle = r.inPlane ? C.refIn : C.ref;
      ctx.lineWidth = r.inPlane ? 1.6 : 1;
      ctx.beginPath();
      r.pts.forEach(([x, y], i) => { const [sx, sy] = this.toScreen(x, y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
      ctx.stroke();
    }
    const pts = pointMap(this.sk);
    // closed regions
    if (!this.regionsCache) { try { this.regionsCache = findRegions(this.sk); } catch (_) { this.regionsCache = []; } }
    ctx.fillStyle = C.region;
    for (const r of this.regionsCache) {
      if (r.depth % 2) continue;
      ctx.beginPath();
      for (const poly of [r.outer.poly, ...r.holes.map((x) => x.poly)]) poly.forEach(([x, y], i) => { const [sx, sy] = this.toScreen(x, y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
      ctx.fill("evenodd");
    }
    // entities
    const constrained = (e) => {
      const ids = entityPointIds(e);
      if (ids.some((id) => this.freePts.has(id))) return false;
      if (e.type === "circle" && this.freeRad.has(e.id)) return false;
      return true;
    };
    for (const e of this.sk.entities) {
      if (e.type === "point") continue;
      const sel = this.sel.has(e.id) || (this.hover && this.hover.id === e.id && !this.isTouch);
      ctx.strokeStyle = sel ? C.sel : e.construction ? C.cons : constrained(e) ? C.fixed : C.free;
      ctx.lineWidth = sel ? 3.2 : e.construction ? 1.3 : 2;
      ctx.setLineDash(e.construction ? [6, 5] : []);
      ctx.beginPath();
      sampleEntity(e, pts, 64).forEach(([x, y], i) => { const [sx, sy] = this.toScreen(x, y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
      if (e.type === "spline" && e.closed) ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      if (e.type === "spline") {
        // control polygon hint
        ctx.strokeStyle = "rgba(128,128,128,.35)"; ctx.lineWidth = 1; ctx.beginPath();
        e.pts.forEach((id, i) => { const p = pts.get(id); const [sx, sy] = this.toScreen(p.x, p.y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
        ctx.stroke();
      }
    }
    // points
    for (const p of this.sk.points) {
      const [sx, sy] = this.toScreen(p.x, p.y);
      if (sx < -10 || sy < -10 || sx > W + 10 || sy > H + 10) continue;
      const sel = this.sel.has(p.id);
      const isOrigin = p.id === "O";
      ctx.fillStyle = sel ? C.sel : isOrigin ? "#e8611f" : this.freePts.has(p.id) ? C.free : C.pt;
      const s = sel ? 5 : isOrigin ? 4.5 : 3.2;
      ctx.fillRect(sx - s, sy - s, 2 * s, 2 * s);
    }
    this.drawConstraints(ctx, pts, C);
    this.drawPreview(ctx, pts, C);
    this.drawLoupe(ctx);
  }

  drawConstraints(ctx, pts, C) {
    this.labelHits = [];
    this.glyphHits = [];
    const E = new Map(this.sk.entities.map((e) => [e.id, e]));
    const glyphCount = new Map();
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const c of this.sk.constraints) {
      if (c.hidden) continue;
      const info = CONSTRAINT_INFO[c.type];
      if (!info) continue;
      const sel = this.sel.has(c.id);
      if (info.dim) { this.drawDim(ctx, c, pts, E, C, sel); continue; }
      // glyph near the first referenced entity/point
      let anchor = null;
      const ref = E.get(c.a) || E.get(c.b);
      if (ref && ref.type === "line") { const a = pts.get(ref.p1), b = pts.get(ref.p2); anchor = [(a.x + b.x) / 2, (a.y + b.y) / 2]; }
      else if (ref && (ref.type === "circle" || ref.type === "arc")) { const cc = pts.get(ref.c); const r = ref.type === "circle" ? ref.r : Math.hypot(pts.get(ref.p1).x - cc.x, pts.get(ref.p1).y - cc.y); anchor = [cc.x + r * 0.71, cc.y + r * 0.71]; }
      else if (pts.get(c.a)) { const p = pts.get(c.a); anchor = [p.x, p.y]; }
      if (!anchor) continue;
      const key = anchor.map((v) => v.toFixed(3)).join();
      const n = glyphCount.get(key) || 0;
      glyphCount.set(key, n + 1);
      let [sx, sy] = this.toScreen(anchor[0], anchor[1]);
      sx += 12 + n * 18; sy -= 12;
      ctx.fillStyle = sel ? C.sel : "rgba(120,130,145,.18)";
      ctx.beginPath(); ctx.arc(sx, sy, 8.5, 0, TAU); ctx.fill();
      ctx.fillStyle = sel ? "#fff" : C.text;
      ctx.fillText(c.type === "fix" ? "⚓" : info.icon, sx, sy + 0.5);
      this.glyphHits.push({ id: c.id, x: sx, y: sy });
    }
  }

  drawDim(ctx, c, pts, E, C, sel) {
    const col = sel ? C.sel : c.ref ? "#888" : C.dim;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 1;
    const label = c.type === "angle" ? `${fmt(c.value, 2)}°` : (c.type === "diameter" ? "⌀" : c.type === "radius" ? "R" : "") + fmt(c.value, 2);
    const expr = c.expr && isNaN(Number(c.expr)) ? `${c.expr} = ` : "";
    const text = expr + label;
    const S = (x, y) => this.toScreen(x, y);
    let tx, ty;
    const arrow = (x, y, dx, dy) => { const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - dx * 8 - dy * 3, y - dy * 8 + dx * 3); ctx.lineTo(x - dx * 8 + dy * 3, y - dy * 8 - dx * 3); ctx.closePath(); ctx.fill(); };
    if (["length", "distance", "hdistance", "vdistance", "pointLineDistance"].includes(c.type)) {
      let a, b;
      if (c.type === "length") { const e = E.get(c.a); if (!e) return; a = pts.get(e.p1); b = pts.get(e.p2); }
      else if (c.type === "pointLineDistance") {
        a = pts.get(c.a); const e = E.get(c.b); if (!a || !e) return;
        const cv = entityCurve(e, pts); const t = paramOf(cv, [a.x, a.y]); const f = pointAt(cv, t); b = { x: f[0], y: f[1] };
      } else { a = pts.get(c.a); b = pts.get(c.b); }
      if (!a || !b) return;
      let A = [a.x, a.y], B = [b.x, b.y];
      if (c.type === "hdistance") B = [b.x, a.y];
      if (c.type === "vdistance") B = [a.x, b.y];
      let d = [B[0] - A[0], B[1] - A[1]];
      const L = Math.hypot(...d) || 1;
      let n = [-d[1] / L, d[0] / L];
      const off = (c.off !== undefined ? c.off : 22 / this.view.s) + (c.ly || 0);
      const A2 = [A[0] + n[0] * off, A[1] + n[1] * off], B2 = [B[0] + n[0] * off, B[1] + n[1] * off];
      const [sa, sb, sa2, sb2] = [S(a.x, a.y), S(c.type === "hdistance" || c.type === "vdistance" ? b.x : B[0], c.type === "hdistance" || c.type === "vdistance" ? b.y : B[1]), S(...A2), S(...B2)];
      ctx.beginPath(); ctx.moveTo(...sa); ctx.lineTo(...sa2); ctx.moveTo(...sb); ctx.lineTo(...sb2); ctx.moveTo(...sa2); ctx.lineTo(...sb2); ctx.stroke();
      arrow(sa2[0], sa2[1], sa2[0] - sb2[0], sa2[1] - sb2[1]);
      arrow(sb2[0], sb2[1], sb2[0] - sa2[0], sb2[1] - sa2[1]);
      tx = (sa2[0] + sb2[0]) / 2 + (c.lx || 0) * this.view.s; ty = (sa2[1] + sb2[1]) / 2;
    } else if (c.type === "radius" || c.type === "diameter") {
      const e = E.get(c.a); if (!e) return;
      const cc = pts.get(e.c);
      const r = e.type === "circle" ? e.r : Math.hypot(pts.get(e.p1).x - cc.x, pts.get(e.p1).y - cc.y);
      let ang = c.ang !== undefined ? c.ang : Math.PI / 4;
      if (e.type === "arc") { const [a1, a2] = arcAngles(cc, pts.get(e.p1), pts.get(e.p2)); ang = (a1 + a2) / 2; }
      const P1 = S(cc.x + Math.cos(ang) * r, cc.y + Math.sin(ang) * r);
      const P0 = c.type === "diameter" ? S(cc.x - Math.cos(ang) * r, cc.y - Math.sin(ang) * r) : S(cc.x, cc.y);
      const ext = 26;
      const dir = [Math.cos(ang), -Math.sin(ang)];
      const P2 = [P1[0] + dir[0] * ext + (c.lx || 0) * this.view.s, P1[1] + dir[1] * ext - (c.ly || 0) * this.view.s];
      ctx.beginPath(); ctx.moveTo(...P0); ctx.lineTo(...P1); ctx.lineTo(...P2); ctx.stroke();
      arrow(P1[0], P1[1], P1[0] - P0[0], P1[1] - P0[1]);
      tx = P2[0] + dir[0] * 16; ty = P2[1] + dir[1] * 10;
    } else if (c.type === "angle") {
      const l1 = E.get(c.a), l2 = E.get(c.b); if (!l1 || !l2) return;
      const c1 = entityCurve(l1, pts), c2 = entityCurve(l2, pts);
      const d1 = [c1.b[0] - c1.a[0], c1.b[1] - c1.a[1]], d2 = [c2.b[0] - c2.a[0], c2.b[1] - c2.a[1]];
      const den = d1[0] * d2[1] - d1[1] * d2[0];
      let O;
      if (Math.abs(den) < 1e-9) O = c1.a; else { const t = ((c2.a[0] - c1.a[0]) * d2[1] - (c2.a[1] - c1.a[1]) * d2[0]) / den; O = [c1.a[0] + d1[0] * t, c1.a[1] + d1[1] * t]; }
      // point directions away from intersection towards the lines' midpoints
      const m1 = [(c1.a[0] + c1.b[0]) / 2 - O[0], (c1.a[1] + c1.b[1]) / 2 - O[1]], m2 = [(c2.a[0] + c2.b[0]) / 2 - O[0], (c2.a[1] + c2.b[1]) / 2 - O[1]];
      let a1 = Math.atan2(m1[1], m1[0]), a2 = Math.atan2(m2[1], m2[0]);
      let diff = ((a2 - a1) % TAU + TAU) % TAU;
      if (diff > Math.PI) { [a1, a2] = [a2, a1]; diff = TAU - diff; }
      const rr = 34 + (c.ly || 0) * this.view.s;
      const [osx, osy] = S(O[0], O[1]);
      ctx.beginPath(); ctx.arc(osx, osy, Math.abs(rr), -a1, -(a1 + diff), true); ctx.stroke();
      const am = a1 + diff / 2;
      tx = osx + Math.cos(am) * (Math.abs(rr) + 16); ty = osy - Math.sin(am) * (Math.abs(rr) + 16);
    }
    if (tx === undefined) return;
    ctx.font = "600 12.5px system-ui, sans-serif";
    const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = sel ? C.sel : C.bg;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(tx - w / 2, ty - 10, w, 20);
    ctx.globalAlpha = 1;
    ctx.fillStyle = sel ? "#fff" : col;
    ctx.fillText(text, tx, ty + 0.5);
    this.labelHits.push({ id: c.id, x0: tx - w / 2, x1: tx + w / 2, y0: ty - 10, y1: ty + 10 });
  }

  drawPreview(ctx, pts, C) {
    const t = this.tool, st = this.ts, cur = this.cursor;
    if (!DRAW_TOOLS.has(t) || !cur) return;
    const S = (x, y) => this.toScreen(x, y);
    // snap marker
    const [cx, cy] = S(cur.x, cur.y);
    ctx.strokeStyle = cur.pointId ? "#e8611f" : cur.on ? "#2e9b57" : cur.mid ? "#9b59b6" : "#2f6fde";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, cur.pointId || cur.on || cur.mid ? 8 : 5, 0, TAU); ctx.stroke();
    if (cur.guide) {
      ctx.setLineDash([3, 4]); ctx.strokeStyle = "rgba(47,111,222,.7)";
      const [gx, gy] = S(cur.guide.x, cur.guide.y);
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(cx, cy); ctx.stroke(); ctx.setLineDash([]);
    }
    const clicks = st.clicks || [];
    ctx.strokeStyle = "#2f6fde";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    const line = (a, b) => { const [ax, ay] = S(a.x, a.y), [bx, by] = S(b.x, b.y); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); };
    const circ = (c, r) => { const [sx, sy] = S(c.x, c.y); ctx.beginPath(); ctx.arc(sx, sy, r * this.view.s, 0, TAU); ctx.stroke(); };
    let info = "";
    if (clicks.length) {
      const p = clicks[clicks.length - 1];
      if (t === "line") { line(p, cur); info = `${fmt(Math.hypot(cur.x - p.x, cur.y - p.y), 2)} mm  ${fmt(Math.atan2(cur.y - p.y, cur.x - p.x) * 180 / Math.PI, 1)}°`; }
      if (t === "rect" || t === "rectCenter") {
        const a = clicks[0];
        const x0 = t === "rect" ? a.x : 2 * a.x - cur.x, y0 = t === "rect" ? a.y : 2 * a.y - cur.y;
        line({ x: x0, y: y0 }, { x: cur.x, y: y0 }); line({ x: cur.x, y: y0 }, cur); line(cur, { x: x0, y: cur.y }); line({ x: x0, y: cur.y }, { x: x0, y: y0 });
        info = `${fmt(Math.abs(cur.x - x0), 2)} × ${fmt(Math.abs(cur.y - y0), 2)} mm`;
      }
      if (t === "circle") { const r = Math.hypot(cur.x - p.x, cur.y - p.y); circ(p, r); line(p, cur); info = `⌀ ${fmt(2 * r, 2)} mm`; }
      if (t === "polygon") {
        const r = Math.hypot(cur.x - p.x, cur.y - p.y), a0 = Math.atan2(cur.y - p.y, cur.x - p.x);
        for (let i = 0; i < this.polySides; i++) { const a = a0 + (i * TAU) / this.polySides, b = a0 + ((i + 1) * TAU) / this.polySides; line({ x: p.x + r * Math.cos(a), y: p.y + r * Math.sin(a) }, { x: p.x + r * Math.cos(b), y: p.y + r * Math.sin(b) }); }
        info = `${this.polySides} sides`;
      }
      if (t === "arc3") {
        if (clicks.length === 1) line(clicks[0], cur);
        else {
          const cc = circumcenter([clicks[0].x, clicks[0].y], [cur.x, cur.y], [clicks[1].x, clicks[1].y]);
          if (cc) circ({ x: cc[0], y: cc[1] }, Math.hypot(clicks[0].x - cc[0], clicks[0].y - cc[1]));
        }
      }
      if (t === "arcCenter") { const c = clicks[0]; if (clicks.length === 1) line(c, cur); else circ(c, Math.hypot(clicks[1].x - c.x, clicks[1].y - c.y)); }
      if (t === "slot") {
        if (clicks.length === 1) line(clicks[0], cur);
        else { line(clicks[0], clicks[1]); const r = Math.abs(((cur.x - clicks[0].x) * -(clicks[1].y - clicks[0].y) + (cur.y - clicks[0].y) * (clicks[1].x - clicks[0].x)) / (Math.hypot(clicks[1].x - clicks[0].x, clicks[1].y - clicks[0].y) || 1)); circ(clicks[0], r); circ(clicks[1], r); }
      }
      if (t === "spline") { for (let i = 0; i + 1 < clicks.length; i++) line(clicks[i], clicks[i + 1]); line(p, cur); }
    } else {
      info = `${fmt(cur.x, 2)}, ${fmt(cur.y, 2)}`;
    }
    ctx.setLineDash([]);
    if (info) {
      ctx.font = "600 12px system-ui, sans-serif";
      const w = ctx.measureText(info).width + 12;
      const bx = Math.min(this.W - w - 4, cx + 14), by = Math.max(4, cy - 34);
      ctx.fillStyle = "rgba(29,39,51,.85)";
      ctx.fillRect(bx, by, w, 20);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.fillText(info, bx + 6, by + 10.5);
      ctx.textAlign = "center";
    }
  }

  // magnifier above the finger while drawing on touch screens
  drawLoupe(ctx) {
    if (!this.isTouch || !this.cursorScreen || !this.pointers.size) return;
    const [fx, fy] = this.cursorScreen;
    const R = 52, zoom = 2;
    const cx = Math.min(Math.max(fx, R + 6), this.W - R - 6), cy = fy - 110 < R + 6 ? fy + 110 : fy - 110;
    const dpr = this.dpr;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    const sw = (R * 2) / zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.canvas, (fx - sw / 2) * dpr, (fy - sw / 2) * dpr, sw * dpr, sw * dpr, (cx - R) * dpr, (cy - R) * dpr, 2 * R * dpr, 2 * R * dpr);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = "rgba(29,39,51,.7)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = "#e8611f"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8); ctx.stroke();
  }
}

const DRAW_TOOLS = new Set(["line", "rect", "rectCenter", "circle", "arc3", "arcCenter", "polygon", "slot", "spline", "point"]);
