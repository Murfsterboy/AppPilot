// 3D Print workspace: place the model on the bed, choose settings, slice, preview layers, export G-code.
import * as THREE from "three";
import { WorkerRPC } from "../core/rpc.js";
import { DEFAULT_PRINT, MATERIALS, PRINTERS } from "../core/doc.js";
import { h, ib, toast, row, numField, selectField, segField, switchField, textField, fmt, fmtTime, popMenu } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { saveFile, shareFile } from "../core/files.js";
import { writeSTL } from "../io/mesh-formats.js";

const TYPE_COLORS = [0xe8511f, 0xf2b134, 0xd9862a, 0x9b59b6, 0x2bb3c0, 0x2e9b57, 0x8c8c8c, 0x777777];
const TYPE_NAMES = ["Outer wall", "Inner wall", "Infill", "Top/bottom", "Support", "Skirt/brim", "Raft"];

export class PrintWS {
  constructor(app) {
    this.app = app;
    this.vp = app.viewport;
    this.worker = new WorkerRPC("slicer-worker.js");
    this.group = new THREE.Group();
    this.group.visible = false;
    this.vp.scene.add(this.group);
    this.sliced = null;
    this.only = null;
    this.tris = null;
    this.layer = 0;
    this.vp.onTap((x, y) => { if (this.app.ws === "print" && this.layFlatMode) this.tapLayFlat(x, y); });
  }

  get st() { return this.app.doc.print; }

  enter() {
    this.vp.bodiesGroup.visible = false;
    this.vp.sketchGroup.visible = false;
    this.vp.grid.visible = false;
    this.group.visible = true;
    this.renderToolbar();
    this.floats = h("div", { class: "float right" },
      h("button", { class: "fbtn", title: "Fit", html: icon("fit"), onclick: () => this.fit() }),
      h("button", { class: "fbtn", title: "Top", html: icon("top"), onclick: () => this.vp.setView("top") }),
      h("button", { class: "fbtn", title: "Iso", html: icon("cube"), onclick: () => this.vp.setView("iso") }));
    this.app.stage.appendChild(this.floats);
    this.loadModel(true);
  }

  leave() {
    this.group.visible = false;
    this.vp.bodiesGroup.visible = true;
    this.vp.sketchGroup.visible = true;
    this.vp.grid.visible = true;
    this.floats && this.floats.remove();
    this.clearOverlays();
    this.layFlatMode = false;
    this.vp.requestRender();
  }

  refresh() { this.loadModel(false); }
  onModelChanged() { this.loadModel(false); }

  clearOverlays() {
    this.sliderEl && this.sliderEl.remove();
    this.statEl && this.statEl.remove();
    this.sliderEl = this.statEl = null;
  }

  renderToolbar() {
    const tb = this.app.toolbar;
    tb.innerHTML = "";
    const tools = h("div", { class: "tools", style: { paddingTop: "8px" } });
    const add = (ic, label, fn, on = false) => tools.appendChild(h("button", { class: "tool" + (on ? " on" : ""), onclick: fn, html: icon(ic) + `<span>${label}</span>` }));
    add("settings", "Settings", () => this.openSettings());
    add("rotate", "Rotate", (e) => this.rotateMenu(e.currentTarget));
    add("layFlat", "Lay flat", () => { this.layFlatMode = !this.layFlatMode; this.app.setHint(this.layFlatMode ? "Tap the face that should sit on the bed" : ""); this.renderToolbar(); }, this.layFlatMode);
    add("scale", "Scale", () => this.openPlacement());
    add("slice", "Slice", () => this.slice());
    add("export", "G-code", () => this.exportGcode());
    add("layers", "Bodies", () => this.chooseBodies());
    tb.appendChild(tools);
  }

  openMore(anchor) {
    popMenu(anchor, [
      { label: "Print settings", icon: "settings", action: () => this.openSettings() },
      { label: "Reset placement", icon: "rotate", action: () => { this.st.placement = null; this.app.changed({ regen: false }); this.loadModel(true); } },
      { label: "Export placed STL", icon: "export", action: () => this.exportPlacedSTL() },
      { label: "Export G-code", icon: "export", action: () => this.exportGcode() },
    ]);
  }

  // ---------- model ----------
  async loadModel(fit) {
    if (!this.app.doc) return;
    const ids = this.only ? this.only.filter((id) => this.app.result.bodies.some((b) => b.id === id)) : this.app.visibleBodyIds();
    this.drawBed();
    if (!ids.length) {
      this.tris = null;
      this.updateModelMesh();
      this.app.setHint("No visible bodies to print — design something first, or import an STL");
      return;
    }
    try {
      this.rawTris = await this.app.meshForBodies(ids);
    } catch (e) { toast(e.message, "err"); return; }
    this.sliced = null;
    this.clearOverlays();
    this.applyPlacement();
    if (fit) this.fit(false);
  }

  placement() {
    if (!this.st.placement) this.st.placement = { q: [0, 0, 0, 1], scale: 100, dx: 0, dy: 0 };
    return this.st.placement;
  }

  applyPlacement() {
    if (!this.rawTris) return;
    const pl = this.placement();
    const q = new THREE.Quaternion(...pl.q);
    const s = pl.scale / 100;
    const out = new Float32Array(this.rawTris.length);
    const v = new THREE.Vector3();
    let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < out.length; i += 3) {
      v.set(this.rawTris[i], this.rawTris[i + 1], this.rawTris[i + 2]).applyQuaternion(q).multiplyScalar(s);
      out[i] = v.x; out[i + 1] = v.y; out[i + 2] = v.z;
      for (let k = 0; k < 3; k++) { const c = out[i + k]; if (c < min[k]) min[k] = c; if (c > max[k]) max[k] = c; }
    }
    const st = this.st;
    const cx = st.origin === "center" ? 0 : st.bedX / 2, cy = st.origin === "center" ? 0 : st.bedY / 2;
    const tx = cx - (min[0] + max[0]) / 2 + pl.dx, ty = cy - (min[1] + max[1]) / 2 + pl.dy, tz = -min[2];
    for (let i = 0; i < out.length; i += 3) { out[i] += tx; out[i + 1] += ty; out[i + 2] += tz; }
    this.tris = out;
    this.size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const bx0 = st.origin === "center" ? -st.bedX / 2 : 0, by0 = st.origin === "center" ? -st.bedY / 2 : 0;
    this.outOfBed = (min[0] + tx) < bx0 - 1e-3 || (max[0] + tx) > bx0 + st.bedX + 1e-3 || (min[1] + ty) < by0 - 1e-3 || (max[1] + ty) > by0 + st.bedY + 1e-3 || this.size[2] > st.bedZ;
    this.updateModelMesh();
    this.app.setHint(`${fmt(this.size[0], 1)} × ${fmt(this.size[1], 1)} × ${fmt(this.size[2], 1)} mm${this.outOfBed ? " · ⚠ doesn't fit the bed" : ""}`);
  }

  updateModelMesh() {
    if (this.modelMesh) { this.group.remove(this.modelMesh); this.modelMesh.geometry.dispose(); }
    this.modelMesh = null;
    if (!this.tris) { this.vp.requestRender(); return; }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.tris, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: this.outOfBed ? 0xd43b3b : 0xe8a33d, roughness: 0.6, metalness: 0.05, transparent: !!this.sliced, opacity: this.sliced ? 0.12 : 1, depthWrite: !this.sliced, flatShading: true }));
    m.userData.kind = "printModel";
    this.modelMesh = m;
    this.group.add(m);
    this.vp.requestRender();
  }

  drawBed() {
    const st = this.st;
    if (this.bed) { this.group.remove(this.bed); }
    const g = new THREE.Group();
    const x0 = st.origin === "center" ? -st.bedX / 2 : 0, y0 = st.origin === "center" ? -st.bedY / 2 : 0;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(st.bedX, st.bedY), new THREE.MeshStandardMaterial({ color: this.app.dark ? 0x2a323c : 0xdfe4ea, roughness: 0.9 }));
    plate.position.set(x0 + st.bedX / 2, y0 + st.bedY / 2, -0.05);
    g.add(plate);
    const lines = [];
    for (let x = 0; x <= st.bedX + 1e-6; x += 10) lines.push(x0 + x, y0, 0, x0 + x, y0 + st.bedY, 0);
    for (let y = 0; y <= st.bedY + 1e-6; y += 10) lines.push(x0, y0 + y, 0, x0 + st.bedX, y0 + y, 0);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
    g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x8592a2, transparent: true, opacity: 0.35 })));
    // build volume outline
    const bx = new THREE.Box3(new THREE.Vector3(x0, y0, 0), new THREE.Vector3(x0 + st.bedX, y0 + st.bedY, st.bedZ));
    g.add(new THREE.Box3Helper(bx, 0x9aa6b4));
    this.bed = g;
    this.group.add(g);
  }

  fit(animate = true) {
    const st = this.st;
    const x0 = st.origin === "center" ? -st.bedX / 2 : 0, y0 = st.origin === "center" ? -st.bedY / 2 : 0;
    const box = this.tris && this.size ? new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(this.tris, 3)) : new THREE.Box3(new THREE.Vector3(x0, y0, 0), new THREE.Vector3(x0 + st.bedX, y0 + st.bedY, 20));
    box.expandByPoint(new THREE.Vector3(x0, y0, 0)).expandByPoint(new THREE.Vector3(x0 + st.bedX, y0 + st.bedY, 0));
    this.vp.fit(animate, box);
  }

  // ---------- placement ----------
  rotateMenu(anchor) {
    const rot = (axis, deg) => {
      const pl = this.placement();
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis), (deg * Math.PI) / 180).multiply(new THREE.Quaternion(...pl.q));
      pl.q = q.toArray();
      this.app.changed({ regen: false });
      this.sliced = null; this.clearOverlays();
      this.applyPlacement();
    };
    popMenu(anchor, [
      { label: "Rotate 90° about X", icon: "rotate", action: () => rot([1, 0, 0], 90) },
      { label: "Rotate 90° about Y", icon: "rotate", action: () => rot([0, 1, 0], 90) },
      { label: "Rotate 90° about Z", icon: "rotate", action: () => rot([0, 0, 1], 90) },
      { label: "Rotate 45° about Z", icon: "rotate", action: () => rot([0, 0, 1], 45) },
      { label: "Upside down", icon: "rotate", action: () => rot([1, 0, 0], 180) },
      "-",
      { label: "Reset rotation", icon: "home", action: () => { this.placement().q = [0, 0, 0, 1]; this.app.changed({ regen: false }); this.sliced = null; this.clearOverlays(); this.applyPlacement(); } },
    ]);
  }

  tapLayFlat(x, y) {
    if (!this.modelMesh) return;
    this.vp.raycaster.setFromCamera(this.vp.ndc(x, y), this.vp.camera);
    const hit = this.vp.raycaster.intersectObject(this.modelMesh)[0];
    if (!hit) return;
    const n = hit.face.normal.clone();
    const pl = this.placement();
    // n is already in placed coordinates; rotate so it points down
    const q = new THREE.Quaternion().setFromUnitVectors(n.normalize(), new THREE.Vector3(0, 0, -1)).multiply(new THREE.Quaternion(...pl.q));
    pl.q = q.toArray();
    this.layFlatMode = false;
    this.renderToolbar();
    this.app.changed({ regen: false });
    this.sliced = null; this.clearOverlays();
    this.applyPlacement();
    toast("Placed flat on the bed");
  }

  openPlacement() {
    const pl = this.placement();
    const upd = () => { this.app.changed({ regen: false }); this.sliced = null; this.clearOverlays(); this.applyPlacement(); };
    const body = h("div", {},
      row("Scale", numField(pl.scale, (v) => { pl.scale = Math.max(1, +v || 100); upd(); }, { unit: "%", step: 10, min: 1 })),
      row("Shift X", numField(pl.dx, (v) => { pl.dx = +v || 0; upd(); }, { unit: "mm", step: 5 })),
      row("Shift Y", numField(pl.dy, (v) => { pl.dy = +v || 0; upd(); }, { unit: "mm", step: 5 })),
      h("div", { class: "note" }, "The model is centred on the bed automatically and dropped onto it."));
    this.app.openSheet("Placement", body, { iconName: "scale" });
  }

  chooseBodies() {
    const ids = this.only || this.app.visibleBodyIds();
    const box = h("div", {});
    for (const b of this.app.result.bodies) {
      const on = ids.includes(b.id);
      box.appendChild(row(this.app.doc.bodies[b.id]?.name || b.id, switchField(on, (v) => {
        const cur = new Set(this.only || this.app.visibleBodyIds());
        v ? cur.add(b.id) : cur.delete(b.id);
        this.only = [...cur];
        this.loadModel(false);
      })));
    }
    if (!this.app.result.bodies.length) box.appendChild(h("div", { class: "empty" }, "No bodies"));
    this.app.openSheet("Bodies to print", box, { iconName: "layers" });
  }

  // ---------- settings ----------
  openSettings() {
    const st = this.st;
    const set = (k) => (v) => { st[k] = typeof DEFAULT_PRINT[k] === "number" ? +v : v; this.app.changed({ regen: false }); this.sliced = null; };
    const n = (k, label, unit, opts = {}) => row(label, numField(st[k], set(k), { unit, step: opts.step, min: opts.min }), opts.hint);
    const body = h("div", {});
    const g = (t) => body.appendChild(h("div", { class: "group-title" }, t));
    g("Printer & material");
    body.append(
      row("Printer", selectField(st.printer, Object.keys(PRINTERS).map((k) => [k, k]), (v) => { Object.assign(st, PRINTERS[v], { printer: v }); this.app.changed({ regen: false }); this.drawBed(); this.applyPlacement(); this.openSettings(); })),
      n("bedX", "Bed width", "mm"), n("bedY", "Bed depth", "mm"), n("bedZ", "Max height", "mm"),
      row("Material", selectField(st.material, Object.keys(MATERIALS).map((k) => [k, k]), (v) => { Object.assign(st, MATERIALS[v], { material: v }); this.app.changed({ regen: false }); this.openSettings(); })),
      n("nozzle", "Nozzle", "mm", { step: 0.1 }), n("filament", "Filament Ø", "mm"));
    g("Quality");
    body.append(
      row("Layer height", segField(String(st.layerHeight), [["0.12", "Fine 0.12"], ["0.2", "Normal 0.2"], ["0.28", "Draft 0.28"]], (v) => { st.layerHeight = +v; this.app.changed({ regen: false }); this.sliced = null; })),
      n("layerHeight", "Custom layer height", "mm", { step: 0.04 }),
      row("Adaptive layers", switchField(st.adaptive, (v) => { st.adaptive = v; this.app.changed({ regen: false }); this.openSettings(); }), "Thinner layers on gentle slopes"),
      ...(st.adaptive ? [n("adaptiveMin", "Thinnest layer", "mm", { step: 0.02 }), n("adaptiveMax", "Thickest layer", "mm", { step: 0.02 })] : []),
      n("firstLayerHeight", "First layer", "mm", { step: 0.02 }), n("lineWidth", "Line width", "mm", { step: 0.02 }));
    g("Strength");
    body.append(
      n("walls", "Walls", "", { step: 1, min: 1 }), n("topLayers", "Top layers", "", { step: 1 }), n("bottomLayers", "Bottom layers", "", { step: 1 }),
      n("infill", "Infill", "%", { step: 5, min: 0 }),
      row("Infill pattern", selectField(st.infillPattern, [["grid", "Grid"], ["lines", "Lines"], ["triangles", "Triangles"], ["concentric", "Concentric"]], set("infillPattern"))));
    g("Support & adhesion");
    body.append(
      row("Supports", switchField(st.supports, (v) => { st.supports = v; this.app.changed({ regen: false }); this.sliced = null; this.openSettings(); })),
      ...(st.supports ? [n("supportAngle", "Overhang angle", "°", { step: 5, hint: "Surfaces steeper than this get support" }), n("supportDensity", "Support density", "%", { step: 5 }), n("supportGap", "Gap to part (XY)", "mm", { step: 0.1 }), n("supportZGap", "Gap layers (Z)", "", { step: 1 })] : []),
      row("Bed adhesion", segField(st.adhesion, [["none", "None"], ["skirt", "Skirt"], ["brim", "Brim"], ["raft", "Raft"]], (v) => { st.adhesion = v; this.app.changed({ regen: false }); this.sliced = null; this.openSettings(); })),
      ...(st.adhesion === "brim" ? [n("brimWidth", "Brim width", "mm")] : st.adhesion === "raft" ? [n("raftLayers", "Raft layers", "", { step: 1 }), n("raftMargin", "Raft margin", "mm")] : st.adhesion === "skirt" ? [n("skirtDistance", "Skirt distance", "mm")] : []));
    g("Speed");
    body.append(n("printSpeed", "Print speed", "mm/s", { step: 5 }), n("outerSpeed", "Outer wall", "mm/s", { step: 5 }), n("infillSpeed", "Infill", "mm/s", { step: 5 }), n("firstLayerSpeed", "First layer", "mm/s", { step: 5 }), n("travelSpeed", "Travel", "mm/s", { step: 10 }), ...(st.supports ? [n("supportSpeed", "Support", "mm/s", { step: 5 })] : []));
    g("Temperature & cooling");
    body.append(n("nozzleTemp", "Nozzle", "°C", { step: 5 }), n("firstLayerNozzleTemp", "Nozzle (first layer)", "°C", { step: 5 }), n("bedTemp", "Bed", "°C", { step: 5 }), n("fan", "Fan", "%", { step: 10 }), n("fanFirstLayers", "Fan off for first", "layers", { step: 1 }), n("minLayerTime", "Min layer time", "s", { step: 1 }));
    g("Retraction & advanced");
    body.append(n("retract", "Retract length", "mm", { step: 0.1 }), n("retractSpeed", "Retract speed", "mm/s", { step: 5 }), n("zHop", "Z hop", "mm", { step: 0.1 }), n("flow", "Flow", "%", { step: 1 }),
      row("Outer wall first", switchField(st.outerFirst, set("outerFirst"))),
      row("Origin", segField(st.origin, [["corner", "Front-left corner"], ["center", "Bed centre"]], (v) => { st.origin = v; this.app.changed({ regen: false }); this.drawBed(); this.applyPlacement(); })));
    const sg = h("textarea", { class: "txt" }); sg.value = st.startGcode; sg.addEventListener("input", () => { st.startGcode = sg.value; this.app.changed({ regen: false }); });
    const eg = h("textarea", { class: "txt" }); eg.value = st.endGcode; eg.addEventListener("input", () => { st.endGcode = eg.value; this.app.changed({ regen: false }); });
    body.append(h("div", { class: "group-title" }, "Start G-code"), sg, h("div", { class: "group-title" }, "End G-code"), eg);
    body.append(h("button", { class: "btn primary", style: { width: "100%", marginTop: "14px" }, onclick: () => { this.app.closeSheet(); this.slice(); }, html: icon("slice") + "Slice now" }));
    this.app.openSheet("Print settings", body, { iconName: "settings" });
  }

  // ---------- slicing ----------
  async slice() {
    if (!this.tris) { toast("Nothing to slice"); return; }
    if (this.outOfBed) toast("The model is bigger than the bed — slicing anyway", "err");
    this.app.closeSheet();
    this.app.setStatus("Slicing… 0%", "busy");
    const tris = this.tris.slice();
    try {
      const res = await this.worker.call("slice", { tris, settings: { ...this.st } }, [tris.buffer], (p) => this.app.setStatus(`Slicing… ${Math.round(p * 100)}%`, "busy"));
      this.sliced = res;
      this.showPreview(res);
      this.app.setStatus("");
    } catch (e) {
      this.app.setStatus("");
      toast("Slicing failed: " + e.message, "err");
    }
  }

  async showGcode(text, name) {
    this.app.setStatus("Reading G-code…", "busy");
    try {
      const res = await this.worker.call("parse", { text });
      res.gcode = text;
      res.name = name;
      this.sliced = res;
      this.tris = null;
      this.updateModelMesh();
      this.drawBed();
      this.showPreview(res);
    } catch (e) { toast(e.message, "err"); }
    this.app.setStatus("");
  }

  showPreview(res) {
    if (this.preview) { this.group.remove(this.preview); this.preview.geometry.dispose(); }
    const pos = res.positions;
    const col = new Float32Array(pos.length);
    const c = new THREE.Color();
    for (let i = 0; i < res.types.length; i++) {
      c.setHex(TYPE_COLORS[res.types[i]] || 0x999999);
      for (let k = 0; k < 2; k++) { col[i * 6 + k * 3] = c.r; col[i * 6 + k * 3 + 1] = c.g; col[i * 6 + k * 3 + 2] = c.b; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.preview = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true }));
    this.group.add(this.preview);
    this.updateModelMesh();
    this.layer = res.layerStart.length - 1;
    this.single = false;
    this.buildSlider(res);
    this.setLayer(this.layer);
  }

  buildSlider(res) {
    this.clearOverlays();
    const n = res.layerStart.length;
    const range = h("input", { type: "range", min: 0, max: Math.max(0, n - 1), value: n - 1 });
    const lbl = h("div", { class: "lbl" });
    range.addEventListener("input", () => this.setLayer(+range.value));
    const single = h("button", { class: "fbtn", title: "Show one layer", html: icon("layers"), onclick: () => { this.single = !this.single; single.classList.toggle("on", this.single); this.setLayer(this.layer); } });
    const up = h("button", { class: "fbtn", html: icon("chevronUp"), onclick: () => { range.value = Math.min(n - 1, +range.value + 1); this.setLayer(+range.value); } });
    const dn = h("button", { class: "fbtn", html: icon("chevronDown"), onclick: () => { range.value = Math.max(0, +range.value - 1); this.setLayer(+range.value); } });
    this.sliderEl = h("div", { class: "layer-slider" }, lbl, up, range, dn, single);
    this.sliderLbl = lbl;
    this.sliderRange = range;
    const s = res.stats || {};
    const legend = h("div", { class: "legend" }, ...TYPE_NAMES.map((nm, i) => (res.types.includes?.(i) || Array.prototype.includes.call(res.types, i) ? h("span", { html: `<i style="background:#${TYPE_COLORS[i].toString(16).padStart(6, "0")}"></i>${nm}` }) : null)));
    this.statEl = h("div", { class: "statbar" },
      s.time ? h("div", {}, h("b", {}, fmtTime(s.time)), ` · ${fmt(s.filament / 1000, 2)} m · ${fmt(s.grams, 1)} g`) : h("div", {}, h("b", {}, res.name || "G-code preview")),
      h("div", {}, `${s.layers || n} layers${s.ms ? ` · sliced in ${fmt(s.ms / 1000, 1)} s` : ""}`), legend);
    this.app.stage.append(this.sliderEl, this.statEl);
  }

  setLayer(i) {
    const res = this.sliced;
    if (!res || !this.preview) return;
    this.layer = i;
    const start = this.single ? res.layerStart[i] : 0;
    const end = i + 1 < res.layerStart.length ? res.layerStart[i + 1] : res.types.length;
    this.preview.geometry.setDrawRange(start * 2, (end - start) * 2);
    if (this.sliderLbl) this.sliderLbl.textContent = `${i + 1}\n${fmt(res.layerZ[i], 2)}`;
    this.vp.requestRender();
  }

  async exportGcode() {
    if (!this.sliced) { await this.slice(); if (!this.sliced) return; }
    const name = (this.app.doc.name || "print").replace(/[^\w\- ]+/g, "_");
    const ok = await saveFile(`${name}.gcode`, this.sliced.gcode, "text/x-gcode");
    if (ok !== false) toast("G-code ready — copy it to your printer's SD card or send it with your printer app");
  }

  async exportPlacedSTL() {
    if (!this.tris) return;
    const name = (this.app.doc.name || "print").replace(/[^\w\- ]+/g, "_");
    await saveFile(`${name}-placed.stl`, writeSTL(this.tris, name), "model/stl");
  }
}

export { shareFile };
