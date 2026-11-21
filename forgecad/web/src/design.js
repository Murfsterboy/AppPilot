// Design workspace: modelling toolbar, feature panels with live preview, picking, browser tree,
// sketch mode, and inspection tools.
import * as THREE from "three";
import { uid, nextName, FEATURE_LABELS, BODY_COLORS } from "./core/doc.js";
import { evaluate, resolveParams, isValidName } from "./core/expr.js";
import { STD_PLANES, PLANE_LABELS } from "./core/planes.js";
import { FEATURE_DEFS, DESIGN_TOOLS } from "./ui/feature-defs.js";
import { h, ib, toast, modal, confirmBox, promptBox, popMenu, row, numField, selectField, segField, switchField, textField, fmt } from "./ui/dom.js";
import { icon } from "./ui/icons.js";
import { Sketcher, SKETCH_TOOLS, CONSTRAINT_TOOLS } from "./sketch/sketcher.js";
import { CONSTRAINT_INFO } from "./sketch/solver.js";
import { findRegions, sampleEntity, pointMap } from "./sketch/profiles.js";

const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

export class DesignWS {
  constructor(app) {
    this.app = app;
    this.vp = app.viewport;
    this.cat = "Create";
    this.panel = null;
    this.selection = null;
    this.sketcher = new Sketcher(app, app.stage);
    this.floats = this.buildFloats();
    this.bindPicking();
    app.onSketchToolChanged = () => this.renderSketchToolbar();
    app.onSketchSelection = () => this.renderSketchContext();
  }

  resetForDoc() {
    this.selection = null;
    this.measure = null;
    this.vp.setSection(null);
    this.vp.clearHighlights();
    this.vp.clearLabels();
    this.sectionState = null;
    this.refreshTree();
  }

  // ---------- enter / leave ----------
  enter() {
    this.app.stage.appendChild(this.floats);
    this.vp.bodiesGroup.visible = true;
    this.vp.sketchGroup.visible = true;
    this.vp.grid.visible = true;
    this.renderToolbar();
    this.app.topExtra.innerHTML = "";
    const fromOther = this.left;
    this.vp.setBodies(this.app.result.bodies, (id) => this.app.doc.bodies[id] || {});
    this.drawSketches();
    if (fromOther) this.vp.fit(true);
  }
  leave() {
    this.left = true;
    this.floats.remove();
    this.clearSelection();
    this.vp.clearLabels();
    this.vp.sketchGroup.clear();
    this.app.topExtra.innerHTML = "";
  }

  buildFloats() {
    const vp = this.vp;
    const viewsBtn = h("button", { class: "fbtn", title: "Views", html: icon("cube"), onclick: (e) => popMenu(e.currentTarget, [
      { label: "Fit all", icon: "fit", action: () => vp.fit() },
      { label: "Isometric", icon: "cube", action: () => vp.setView("iso") },
      { label: "Top", icon: "top", action: () => vp.setView("top") },
      { label: "Front", icon: "front", action: () => vp.setView("front") },
      { label: "Right", icon: "right", action: () => vp.setView("right") },
      { label: "Bottom", icon: "top", action: () => vp.setView("bottom") },
      { label: "Back", icon: "front", action: () => vp.setView("back") },
      { label: "Left", icon: "right", action: () => vp.setView("left") },
    ]) });
    this.orthoBtn = h("button", { class: "fbtn", title: "Perspective / orthographic", html: icon("persp"), onclick: () => { const on = vp.camera !== vp.ortho; vp.setOrtho(on); this.orthoBtn.classList.toggle("on", on); } });
    const dispBtn = h("button", { class: "fbtn", title: "Display style", html: icon("appearance"), onclick: (e) => popMenu(e.currentTarget, [
      { label: "Shaded with edges", icon: "cube", action: () => vp.setDisplayMode("shaded-edges") },
      { label: "Shaded", icon: "appearance", action: () => vp.setDisplayMode("shaded") },
      { label: "Wireframe", icon: "wire", action: () => vp.setDisplayMode("wireframe") },
      { label: "X-ray", icon: "eye", action: () => vp.setDisplayMode("xray") },
      "-",
      { label: (this.hideSketches ? "Show" : "Hide") + " sketches", icon: "sketch", action: () => { this.hideSketches = !this.hideSketches; this.drawSketches(); } },
      { label: (vp.grid.visible ? "Hide" : "Show") + " grid", icon: "grid", action: () => { vp.grid.visible = !vp.grid.visible; vp.requestRender(); } },
    ]) });
    const left = h("div", { class: "float left" },
      h("button", { class: "fbtn", title: "Browser", html: icon("tree"), onclick: () => this.openTree() }));
    const right = h("div", { class: "float right" },
      h("button", { class: "fbtn", title: "Fit", html: icon("fit"), onclick: () => vp.fit() }),
      h("button", { class: "fbtn", title: "Home view", html: icon("home"), onclick: () => vp.setView("iso") }),
      viewsBtn, this.orthoBtn, dispBtn);
    return h("div", {}, left, right);
  }

  // ---------- toolbar ----------
  renderToolbar() {
    if (this.sketcher.active) return this.renderSketchToolbar();
    const tb = this.app.toolbar;
    tb.innerHTML = "";
    const cats = h("div", { class: "cats" });
    for (const g of DESIGN_TOOLS) cats.appendChild(h("button", { class: "cat" + (g.cat === this.cat ? " on" : ""), onclick: () => { this.cat = g.cat; this.renderToolbar(); } }, g.cat));
    const tools = h("div", { class: "tools" });
    const grp = DESIGN_TOOLS.find((g) => g.cat === this.cat);
    for (const t of grp.items) {
      const active = (this.panel && this.panel.toolId === t.id) || (t.id === "measure" && this.measure) || (t.id === "section" && this.sectionState);
      tools.appendChild(h("button", { class: "tool" + (active ? " on" : ""), onclick: () => this.startTool(t.id), html: icon(t.icon) + `<span>${t.label}</span>` }));
    }
    tb.append(cats, tools);
  }

  startTool(id) {
    if (this.panel) this.cancelPanel();
    this.stopMeasure();
    if (id === "sketch") return this.newSketch();
    if (id === "measure") return this.startMeasure();
    if (id === "section") return this.openSection();
    if (id === "properties") return this.openProperties();
    if (id === "params") return this.openParams();
    if (id.startsWith("prim:")) return this.openFeature("primitive", null, { shape: id.slice(5), op: this.app.result.bodies.length ? "new" : "new" });
    return this.openFeature(id);
  }

  openMore(anchor) {
    const sel = this.selection;
    const items = [
      { label: "Parameters", icon: "params", action: () => this.openParams() },
      { label: "Measure", icon: "measure", action: () => this.startMeasure() },
      { label: "Section view", icon: "section", action: () => this.openSection() },
      { label: "Physical properties", icon: "info", action: () => this.openProperties() },
      "-",
      { label: "Export…", icon: "export", action: () => this.app.exportMenu() },
      { label: "Import…", icon: "import", action: () => this.app.importFiles(false) },
    ];
    if (sel && sel.bodyId) items.unshift({ label: `Body: ${this.app.doc.bodies[sel.bodyId]?.name}…`, icon: "cube", action: () => this.bodyMenu(anchor, sel.bodyId) }, "-");
    popMenu(anchor, items);
  }

  onKey(e) {
    if (this.sketcher.active) {
      const k = e.key.toLowerCase();
      const map = { l: "line", r: "rect", c: "circle", a: "arc3", p: "polygon", s: "spline", d: "dimension", t: "trim", x: "construction", escape: "select" };
      if (k === "delete" || k === "backspace") this.sketcher.deleteSelection();
      else if (map[k]) this.sketcher.setTool(map[k]);
      else if (k === "enter") this.finishSketch(true);
      return;
    }
    if (e.key === "f") this.vp.fit();
  }

  onBack() {
    if (this.sketcher.active) {
      if (this.sketcher.tool !== "select") { this.sketcher.setTool("select"); return true; }
      this.finishSketch(true);
      return true;
    }
    if (this.panel) { this.cancelPanel(); return true; }
    if (this.measure) { this.stopMeasure(); return true; }
    if (this.selection) { this.clearSelection(); return true; }
    return false;
  }

  // ---------- results ----------
  onResult(fit) {
    this.drawSketches();
    this.refreshTree();
    if (this.panel) this.refreshPanelHighlights();
    else if (this.selection) this.highlightSelection();
    if (fit) this.vp.fit(false);
  }

  drawSketches() {
    const g = this.vp.sketchGroup;
    g.clear();
    if (this.sketcher.active) return;
    const doc = this.app.doc;
    if (!doc) return;
    const panel = this.panel;
    const showRegionsFor = panel && panel.def.fields.some((f) => f.type === "regions") ? panel.f.sketch : null;
    const panelSketches = new Set(panel ? [panel.f.sketch, panel.f.path, ...(panel.f.sketches || [])].filter(Boolean) : []);
    for (const s of this.app.result.sketches || []) {
      const feat = doc.features.find((f) => f.id === s.id);
      if (!feat) continue;
      const vis = panelSketches.has(s.id) || (!this.hideSketches && feat.visible !== false && !this.consumed(s.id));
      if (!vis) continue;
      const pl = s.plane;
      const X = V3(pl.x), N = V3(pl.n), O = V3(pl.o), Y = new THREE.Vector3().crossVectors(N, X);
      const to3 = (u, v) => O.clone().addScaledVector(X, u).addScaledVector(Y, v);
      const pts = pointMap(s);
      const segs = [], csegs = [];
      for (const e of s.entities) {
        if (e.type === "point") continue;
        const P = sampleEntity(e, pts, 48);
        for (let i = 0; i + 1 < P.length; i++) {
          const a = to3(...P[i]), b = to3(...P[i + 1]);
          (e.construction ? csegs : segs).push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
      const sel = panelSketches.has(s.id);
      if (segs.length) this.vp.addFatLines(segs, sel ? 0xe8611f : 0x2f6fde, sel ? 2.6 : 1.8, g, { depthTest: true });
      if (csegs.length) this.vp.addFatLines(csegs, 0xd9701f, 1.2, g, { dashed: true, opacity: 0.7 });
      if (showRegionsFor === s.id) {
        const regions = findRegions(s);
        const chosen = panel.f.regions;
        regions.forEach((r, ri) => {
          const shape = new THREE.Shape(r.outer.poly.map(([x, y]) => new THREE.Vector2(x, y)));
          for (const hh of r.holes) shape.holes.push(new THREE.Path(hh.poly.map(([x, y]) => new THREE.Vector2(x, y))));
          const geo = new THREE.ShapeGeometry(shape);
          const m = new THREE.Matrix4().makeBasis(X, Y, N).setPosition(O.clone().addScaledVector(N, 0.01));
          geo.applyMatrix4(m);
          const isSel = !chosen || chosen === "auto" ? r.depth % 2 === 0 : chosen.some(([x, y]) => regionHas(r, x, y));
          const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: isSel ? 0xe8611f : 0x2f6fde, transparent: true, opacity: isSel ? 0.4 : 0.12, side: THREE.DoubleSide, depthWrite: false }));
          mesh.userData = { kind: "region", sketchId: s.id, regionIndex: ri, sample: r.sample };
          mesh.renderOrder = 3;
          g.add(mesh);
        });
      }
    }
    this.vp.requestRender();
  }

  consumed(sketchId) {
    return this.app.doc.features.some((f) => f.sketch === sketchId || f.path === sketchId || (f.sketches || []).includes(sketchId));
  }

  // ---------- picking ----------
  bindPicking() {
    const c = this.vp.canvas;
    let down = null;
    c.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), n: (down && down.active ? 2 : 1), active: true }; });
    c.addEventListener("pointermove", (e) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true; });
    c.addEventListener("pointerup", (e) => {
      if (!down) return;
      const d = down;
      down = null;
      if (d.moved || d.n > 1 || performance.now() - d.t > 600) return;
      if (this.app.ws !== "design" || this.sketcher.active) return;
      this.onTap(e.clientX, e.clientY);
    });
  }

  onTap(x, y) {
    if (this.measure) return this.measureTap(x, y);
    if (this.planePicker) return this.planePickTap(x, y);
    if (this.panel && this.panel.activeField) return this.panelPick(x, y);
    const hit = this.vp.pick(x, y, new Set(["face", "body"]));
    if (!hit) { this.clearSelection(); return; }
    this.selection = hit;
    this.highlightSelection();
    const b = this.app.result.bodies.find((q) => q.id === hit.bodyId);
    const meta = this.app.doc.bodies[hit.bodyId] || {};
    let txt = `${meta.name || "Body"} · ${fmt(b.volume / 1000, 2)} cm³`;
    if (hit.type === "face" && hit.face) txt += ` · ${faceLabel(hit.face)}`;
    this.app.setHint(txt);
    this.showSelectionBar(hit);
  }

  showSelectionBar(hit) {
    this.selBar && this.selBar.remove();
    const items = [
      ["sketch", "Sketch here", () => { if (hit.type === "face" && hit.face.type === "PLANE") this.newSketchOnFace(hit); else toast("Tap a flat face to sketch on it"); }],
      ["offsetFace", "Push/pull", () => { if (hit.type === "face") this.openFeature("offsetFace", null, { body: hit.bodyId, faces: [hit.sig] }); }],
      ["hole", "Hole", () => { if (hit.type === "face") this.openFeature("hole", null, { body: hit.bodyId, at: { p: hit.point.toArray(), n: hit.face.n } }); }],
      ["eyeOff", "Hide", () => { this.setBodyVisible(hit.bodyId, false); this.clearSelection(); }],
      ["appearance", "Colour", () => this.pickColor(hit.bodyId)],
      ["more", "More", (e) => this.bodyMenu(e.currentTarget, hit.bodyId)],
    ];
    const bar = h("div", { class: "subbar", style: { bottom: "8px" } });
    for (const [ic, label, fn] of items) bar.appendChild(h("button", { class: "tool", html: icon(ic) + `<span>${label}</span>`, onclick: fn }));
    this.selBar = bar;
    this.app.stage.appendChild(bar);
  }

  clearSelection() {
    this.selection = null;
    this.selBar && this.selBar.remove();
    this.selBar = null;
    this.vp.clearHighlights();
    if (!this.panel && !this.measure) this.app.setHint("");
  }

  highlightSelection() {
    this.vp.clearHighlights();
    const s = this.selection;
    if (!s) return;
    if (s.type === "face") this.vp.highlightFace(s.bodyId, s.index);
    else this.vp.highlightBody(s.bodyId);
  }

  bodyMenu(anchor, id) {
    const meta = this.app.doc.bodies[id];
    popMenu(anchor, [
      { label: "Rename", icon: "edit", action: async () => { const n = await promptBox("Rename body", meta.name); if (n) { this.app.checkpoint(); meta.name = n; this.app.changed({ regen: false }); this.refreshTree(); } } },
      { label: "Colour", icon: "appearance", action: () => this.pickColor(id) },
      { label: meta.visible === false ? "Show" : "Hide", icon: meta.visible === false ? "eye" : "eyeOff", action: () => this.setBodyVisible(id, meta.visible === false) },
      { label: "Move / copy", icon: "move", action: () => this.openFeature("move", null, { body: id }) },
      { label: "Send to 3D print", icon: "print", action: () => { this.app.print.only = [id]; this.app.setWorkspace("print"); } },
      { label: "Export STL", icon: "export", action: async () => { const { writeSTL } = await import("./io/mesh-formats.js"); const tris = await this.app.meshForBodies([id]); const { saveFile } = await import("./core/files.js"); await saveFile(`${meta.name}.stl`, writeSTL(tris, meta.name), "model/stl"); } },
      "-",
      { label: "Remove body", icon: "trash", action: () => { this.app.checkpoint(); this.app.doc.features.push({ id: uid("f"), type: "deleteBody", name: nextName(this.app.doc, "deleteBody"), bodies: [id] }); this.clearSelection(); this.app.changed(); } },
    ]);
  }

  async pickColor(id) {
    const meta = this.app.doc.bodies[id];
    const box = h("div", { style: { display: "flex", flexWrap: "wrap", gap: "10px" } });
    const colors = [...BODY_COLORS, "#d0d4da", "#4a4f57", "#e8611f", "#2f6fde", "#f2c94c", "#27ae60", "#eb5757", "#ffffff"];
    let chosen = null;
    for (const c of colors) box.appendChild(h("button", { class: "swatch", style: { width: "40px", height: "40px", background: c, borderRadius: "10px" }, onclick: () => { chosen = c; document.querySelector(".modal-wrap .btn.primary").click(); } }));
    const custom = h("input", { type: "color", value: meta.color });
    custom.addEventListener("input", () => (chosen = custom.value));
    await modal({ title: "Body colour", body: h("div", {}, box, h("div", { class: "row" }, h("label", {}, "Custom"), custom)), buttons: [{ label: "Done", primary: true, value: true }] });
    if (chosen) { this.app.checkpoint(); meta.color = chosen; this.vp.setBodyColor(id, chosen); this.app.changed({ regen: false }); this.refreshTree(); }
  }

  setBodyVisible(id, vis) {
    const meta = this.app.doc.bodies[id];
    if (!meta) return;
    meta.visible = vis;
    this.vp.setBodyVisible(id, vis);
    this.app.changed({ regen: false });
    this.refreshTree();
  }

  // ---------- browser tree ----------
  openTree() {
    this.treeBody = h("div", {});
    this.refreshTree();
    this.app.openDrawer("Browser", this.treeBody);
  }

  refreshTree() {
    if (!this.treeBody || !this.app.doc) return;
    const doc = this.app.doc;
    const res = this.app.result;
    const body = this.treeBody;
    body.innerHTML = "";
    // parameters
    const { values, errors } = resolveParams(doc.params);
    body.appendChild(h("div", { class: "tree-sec" }, h("span", {}, "Parameters"), ib("edit", "Edit parameters", () => { this.app.closeDrawers(); this.openParams(); })));
    if (!doc.params.length) body.appendChild(h("div", { class: "note", style: { padding: "0 16px" } }, "None yet — add named values to drive your design."));
    for (const p of doc.params) body.appendChild(h("div", { class: "titem" + (errors[p.name] ? " err" : ""), onclick: () => { this.app.closeDrawers(); this.openParams(); } }, h("span", { class: "nm" }, `${p.name} = ${p.expr}`, h("small", {}, errors[p.name] || fmt(values[p.name], 4)))));
    // bodies
    body.appendChild(h("div", { class: "tree-sec" }, h("span", {}, "Bodies")));
    if (!res.bodies.length) body.appendChild(h("div", { class: "note", style: { padding: "0 16px" } }, "No bodies yet."));
    for (const b of res.bodies) {
      const meta = doc.bodies[b.id] || { name: b.id, color: "#999" };
      const vis = meta.visible !== false;
      body.appendChild(h("div", { class: "titem", onclick: (e) => { if (e.target.closest(".ib")) return; this.selection = { type: "body", bodyId: b.id }; this.highlightSelection(); this.app.closeDrawers(); this.showSelectionBar(this.selection); } },
        h("span", { class: "swatch", style: { background: meta.color } }),
        h("span", { class: "nm" }, meta.name, h("small", {}, `${fmt(b.volume / 1000, 2)} cm³${b.kind === "mesh" ? " · mesh" : ""}`)),
        ib(vis ? "eye" : "eyeOff", vis ? "Hide" : "Show", () => this.setBodyVisible(b.id, !vis)),
        ib("more", "Options", (e) => this.bodyMenu(e.currentTarget, b.id))));
    }
    // history
    body.appendChild(h("div", { class: "tree-sec" }, h("span", {}, "History"), doc.rollback != null ? h("button", { class: "btn small", onclick: () => { this.app.checkpoint(); doc.rollback = null; this.app.changed(); } }, "Show all") : null));
    if (!doc.features.length) body.appendChild(h("div", { class: "note", style: { padding: "0 16px" } }, "Start with Sketch or a primitive shape."));
    doc.features.forEach((f, i) => {
      if (doc.rollback != null && i === doc.rollback) body.appendChild(h("div", { class: "rollbar" }));
      const err = res.errors && res.errors[f.id];
      const rolled = doc.rollback != null && i >= doc.rollback;
      const def = FEATURE_DEFS[f.type];
      const ic = f.type === "sketch" ? "sketch" : f.type === "primitive" ? (f.shape === "gear" ? "gear" : f.shape === "box" ? "box" : f.shape) : f.type === "import" ? "import" : f.type === "mesh" ? "layers" : f.type === "deleteBody" ? "trash" : def ? def.icon : "cube";
      const it = h("div", { class: "titem" + (err ? " err" : "") + (f.suppressed ? " suppressed" : "") + (rolled ? " rolled" : ""), onclick: (e) => { if (e.target.closest(".ib")) return; this.app.closeDrawers(); this.editFeature(f); } },
        h("span", { html: icon(ic, "lead") }),
        h("span", { class: "nm" }, f.name || FEATURE_LABELS[f.type], h("small", {}, err ? "⚠ " + err : describe(f, doc))));
      if (f.type === "sketch") {
        const vis = f.visible !== false && !this.consumed(f.id);
        it.appendChild(ib(vis ? "eye" : "eyeOff", "Show/hide sketch", () => { f.visible = !vis; if (!vis && this.consumed(f.id)) f.visible = true; this.app.changed({ regen: false }); this.drawSketches(); this.refreshTree(); }));
      }
      it.appendChild(ib("more", "Options", (e) => this.featureMenu(e.currentTarget, f, i)));
      body.appendChild(it);
    });
    body.appendChild(h("div", { class: "note", style: { padding: "12px 16px" } }, "Tap a step to edit it. Everything after it rebuilds automatically."));
  }

  featureMenu(anchor, f, i) {
    const doc = this.app.doc;
    popMenu(anchor, [
      { label: "Edit", icon: "edit", action: () => { this.app.closeDrawers(); this.editFeature(f); } },
      { label: "Rename", icon: "text", action: async () => { const n = await promptBox("Rename", f.name); if (n) { this.app.checkpoint(); f.name = n; this.app.changed({ regen: false }); this.refreshTree(); } } },
      { label: f.suppressed ? "Unsuppress" : "Suppress", icon: "suppress", action: () => { this.app.checkpoint(); f.suppressed = !f.suppressed; this.app.changed(); } },
      { label: "Roll back to here", icon: "rollback", action: () => { this.app.checkpoint(); doc.rollback = i + 1; this.app.changed(); } },
      i > 0 ? { label: "Move up", icon: "chevronUp", action: () => { this.app.checkpoint(); [doc.features[i - 1], doc.features[i]] = [doc.features[i], doc.features[i - 1]]; this.app.changed(); } } : null,
      i < doc.features.length - 1 ? { label: "Move down", icon: "chevronDown", action: () => { this.app.checkpoint(); [doc.features[i + 1], doc.features[i]] = [doc.features[i], doc.features[i + 1]]; this.app.changed(); } } : null,
      f.type === "sketch" ? { label: "Export DXF", icon: "export", action: async () => { const { sketchToDXF } = await import("./io/sketch-formats.js"); const { saveFile } = await import("./core/files.js"); const sk = this.app.result.sketches.find((s) => s.id === f.id) || f; await saveFile(`${f.name}.dxf`, sketchToDXF(sk), "image/vnd.dxf"); } } : null,
      f.type === "mesh" ? { label: "Convert to solid", icon: "cube", action: () => this.meshToSolid(f) } : null,
      "-",
      { label: "Delete", icon: "trash", action: async () => {
        const users = doc.features.filter((x) => x.sketch === f.id || x.path === f.id || (x.sketches || []).includes(f.id));
        if (users.length && !(await confirmBox("Delete step?", `${users.map((u) => u.name).join(", ")} use${users.length === 1 ? "s" : ""} it and will show errors.`, "Delete", true))) return;
        this.app.checkpoint();
        doc.features.splice(i, 1);
        if (doc.rollback != null && doc.rollback > i) doc.rollback--;
        this.app.changed();
      } },
    ]);
  }

  async meshToSolid(f) {
    this.app.setStatus("Converting mesh…", "busy");
    try {
      const brep = await this.app.kernel.call("meshToSolid", { positions: f.positions });
      this.app.checkpoint();
      const i = this.app.doc.features.indexOf(f);
      this.app.doc.features[i] = { id: f.id, type: "import", name: f.name, brep };
      this.app.changed();
      toast("Converted to a solid body");
    } catch (e) { toast("Couldn't convert: " + e.message, "err"); }
    this.app.setStatus("");
  }

  // ---------- parameters ----------
  openParams() {
    const doc = this.app.doc;
    const work = JSON.parse(JSON.stringify(doc.params));
    const list = h("div", {});
    const render = () => {
      list.innerHTML = "";
      const { values, errors } = resolveParams(work);
      work.forEach((p, i) => {
        const val = h("small", { style: { color: errors[p.name] ? "var(--err)" : "var(--muted)" } }, errors[p.name] || "= " + fmt(values[p.name], 4));
        list.appendChild(h("div", { class: "row" },
          h("div", { style: { display: "flex", flexDirection: "column", gap: "4px", flex: 1 } },
            h("div", { style: { display: "flex", gap: "6px" } },
              textField(p.name, (v) => { p.name = v.trim(); }, "name"),
              textField(p.expr, (v) => { p.expr = v; const r = resolveParams(work); val.textContent = r.errors[p.name] || "= " + fmt(r.values[p.name], 4); }, "value e.g. 20 or width*2")),
            val),
          ib("trash", "Remove", () => { work.splice(i, 1); render(); })));
      });
      list.appendChild(h("button", { class: "btn", onclick: () => { let n = 1; while (work.some((p) => p.name === "p" + n)) n++; work.push({ name: "p" + n, expr: "10" }); render(); }, html: icon("plus") + "Add parameter" }));
    };
    render();
    modal({
      title: "Parameters",
      body: h("div", {}, h("div", { class: "note" }, "Named values you can type into any field, e.g. width, or width/2 + 3. Change one here and the whole design updates."), list),
      buttons: [{ label: "Cancel", value: false }, {
        label: "Apply", primary: true, value: true, validate: () => {
          const names = new Set();
          for (const p of work) {
            if (!isValidName(p.name)) { toast(`"${p.name}" isn't a valid name (letters, digits, _)`, "err"); return false; }
            if (names.has(p.name)) { toast(`"${p.name}" is used twice`, "err"); return false; }
            names.add(p.name);
          }
          return true;
        },
      }],
    }).then((ok) => {
      if (!ok) return;
      this.app.checkpoint();
      doc.params = work;
      this.app.changed();
      this.refreshTree();
    });
  }

  // ---------- feature panels ----------
  openFeature(type, existing = null, preset = {}) {
    const def = FEATURE_DEFS[type];
    if (!def) return;
    const doc = this.app.doc;
    this.clearSelection();
    const snapshot = JSON.stringify(doc);
    let f;
    let index;
    if (existing) {
      f = JSON.parse(JSON.stringify(existing));
      index = doc.features.findIndex((x) => x.id === existing.id);
    } else {
      f = { id: uid("f"), type, name: nextName(doc, type), ...JSON.parse(JSON.stringify(def.defaults || {})), ...preset };
      if (type === "primitive") f.name = nextName({ features: doc.features.map((x) => ({ name: x.name })) }, preset.shape ? preset.shape[0].toUpperCase() + preset.shape.slice(1) : "Primitive").replace(/^(\w+) /, (m) => m);
      // smart defaults
      const sketches = this.availableSketches();
      const lastSk = sketches[sketches.length - 1];
      if (def.fields.some((x) => x.key === "sketch") && !f.sketch && lastSk) f.sketch = lastSk.id;
      if ((type === "extrude" || type === "revolve" || type === "loft" || type === "sweep") && !this.app.result.bodies.length) f.op = "new";
      const bodyField = def.fields.find((x) => x.type === "body" && x.key === "body");
      if ((bodyField || def.picksOnInput) && !f.body) {
        const ids = this.app.result.bodies.filter((b) => b.kind !== "mesh").map((b) => b.id);
        if (ids.length) f.body = ids[ids.length - 1];
      }
      if (type === "boolean" && !f.target) { const ids = this.app.result.bodies.map((b) => b.id); if (ids.length) f.target = ids[0]; }
      if (type === "sweep" && sketches.length >= 2) { f.sketch = sketches[sketches.length - 1].id; f.path = sketches[sketches.length - 2].id; }
      index = doc.rollback != null ? doc.rollback : doc.features.length;
    }
    if (type === "primitive" && !existing) {
      const labels = { box: "Box", cylinder: "Cylinder", sphere: "Sphere", cone: "Cone", torus: "Torus", gear: "Gear" };
      let n = 1;
      while (doc.features.some((x) => x.name === `${labels[f.shape]} ${n}`)) n++;
      f.name = `${labels[f.shape]} ${n}`;
      if (this.app.result.bodies.length && f.op === "new") f.op = "new";
    }
    this.panel = { def, f, existing, index, snapshot, toolId: type === "primitive" ? "prim:" + f.shape : type, activeField: null };
    // pick fields start active when empty
    const pickField = def.fields.find((x) => ["edges", "faces", "face1"].includes(x.type));
    if (pickField && (!f[pickField.key] || !f[pickField.key].length || (pickField.type === "face1" && !f.at))) this.panel.activeField = pickField.key;
    this.renderPanel();
    this.renderToolbar();
    this.previewPanel();
  }

  editFeature(f) {
    if (f.type === "sketch") return this.editSketch(f);
    if (f.type === "import" || f.type === "mesh" || f.type === "deleteBody") { toast("This step has no settings — use ⋮ for options"); return; }
    this.openFeature(f.type, f);
  }

  availableSketches() {
    const doc = this.app.doc;
    const end = this.panel && this.panel.existing ? this.panel.index : doc.rollback != null ? doc.rollback : doc.features.length;
    return doc.features.slice(0, end).filter((x) => x.type === "sketch");
  }

  renderPanel() {
    const p = this.panel;
    const { def, f } = p;
    const params = () => this.app.params();
    const body = h("div", {});
    if (def.help) body.appendChild(h("div", { class: "note" }, def.help));
    const set = (k, v, rerender = false) => { f[k] = v; if (rerender) this.renderPanel(); this.previewPanel(); };
    let lastGroup = null;
    for (const fd of def.fields) {
      if (fd.when && !fd.when(f)) continue;
      if (fd.group && fd.group !== lastGroup) { body.appendChild(h("div", { class: "group-title" }, fd.group)); lastGroup = fd.group; }
      let ctl;
      switch (fd.type) {
        case "num": ctl = numField(f[fd.key], (v) => { if (p.activeField && def.picksOnInput) p.activeField = null; set(fd.key, v); }, { unit: fd.unit, params, step: fd.step, min: fd.min }); break;
        case "seg": ctl = segField(f[fd.key], fd.options, (v) => set(fd.key, v, true)); break;
        case "select": ctl = selectField(f[fd.key], fd.options, (v) => { set(fd.key, v, true); if (fd.key === "shape") { const labels = { box: "Box", cylinder: "Cylinder", sphere: "Sphere", cone: "Cone", torus: "Torus", gear: "Gear" }; f.name = labels[v] + " " + (f.name.split(" ").pop()); } }); break;
        case "bool": ctl = switchField(f[fd.key], (v) => set(fd.key, v, true)); break;
        case "flip": ctl = h("button", { class: "btn small" + (f.flip ? " primary" : ""), onclick: () => set("flip", !f.flip, true) }, f.flip ? "Flipped" : "Flip"); break;
        case "sketch": {
          const sks = this.availableSketches();
          ctl = selectField(f[fd.key] || "", [["", sks.length ? "Choose…" : "No sketches yet"], ...sks.map((s) => [s.id, s.name])], (v) => { set(fd.key, v, true); if (fd.key === "sketch") f.regions = "auto"; this.drawSketches(); });
          break;
        }
        case "sketches": {
          const sks = this.availableSketches();
          const box = h("div", { class: "sel-box" });
          for (const s of sks) {
            const idx = (f.sketches || []).indexOf(s.id);
            box.appendChild(h("button", { class: "chip" + (idx >= 0 ? " active" : ""), onclick: () => { const arr = f.sketches || []; if (idx >= 0) arr.splice(idx, 1); else arr.push(s.id); f.sketches = arr; this.renderPanel(); this.previewPanel(); this.drawSketches(); } }, (idx >= 0 ? `${idx + 1}. ` : "") + s.name));
          }
          if (!sks.length) box.appendChild(h("span", { class: "note" }, "Make sketches on different planes first"));
          ctl = box;
          break;
        }
        case "regions": {
          const active = p.activeField === fd.key;
          const label = !f.regions || f.regions === "auto" ? "Auto" : `${f.regions.length} picked`;
          ctl = h("div", { class: "sel-box" },
            h("button", { class: "chip" + (active ? " active" : ""), onclick: () => { p.activeField = active ? null : fd.key; this.renderPanel(); this.drawSketches(); } }, active ? "Tap regions…" : label),
            f.regions && f.regions !== "auto" ? h("button", { class: "btn small", onclick: () => { f.regions = "auto"; this.renderPanel(); this.previewPanel(); this.drawSketches(); } }, "Auto") : null);
          break;
        }
        case "body":
        case "bodyOrAuto": {
          const bodies = this.app.result.bodies.filter((b) => !p.existing || true);
          const opts = bodies.map((b) => [b.id, this.app.doc.bodies[b.id]?.name || b.id]);
          if (fd.type === "bodyOrAuto") opts.unshift(["auto", "Automatic"]);
          if (f[fd.key] && !opts.some((o) => o[0] === f[fd.key])) opts.push([f[fd.key], "(missing body)"]);
          ctl = selectField(f[fd.key] || (fd.type === "bodyOrAuto" ? "auto" : ""), [...(opts.length ? [] : [["", "No bodies"]]), ...opts], (v) => set(fd.key, v, true));
          break;
        }
        case "bodies": {
          const box = h("div", { class: "sel-box" });
          for (const b of this.app.result.bodies) {
            if (b.id === f.target) continue;
            const on = (f[fd.key] || []).includes(b.id);
            box.appendChild(h("button", { class: "chip" + (on ? " active" : ""), onclick: () => { const arr = f[fd.key] || []; if (on) arr.splice(arr.indexOf(b.id), 1); else arr.push(b.id); f[fd.key] = arr; this.renderPanel(); this.previewPanel(); } }, this.app.doc.bodies[b.id]?.name || b.id));
          }
          ctl = box;
          break;
        }
        case "edges":
        case "faces":
        case "face1": {
          const active = p.activeField === fd.key;
          const n = fd.type === "face1" ? (f.at ? 1 + (f.points || []).length : 0) : (f[fd.key] || []).length;
          const noun = fd.type === "edges" ? "edge" : fd.type === "faces" ? "face" : "spot";
          ctl = h("div", { class: "sel-box" },
            h("button", { class: "chip" + (active ? " active" : "") + (!n ? " err" : ""), onclick: () => { p.activeField = active ? null : fd.key; this.renderPanel(); this.previewPanel(); } }, active ? `Tap ${noun}s… (${n})` : `${n} ${noun}${n === 1 ? "" : "s"}`),
            n ? h("button", { class: "btn small", onclick: () => { if (fd.type === "face1") { f.at = null; f.points = []; } else f[fd.key] = []; p.activeField = fd.key; this.renderPanel(); this.previewPanel(); } }, "Clear") : null);
          break;
        }
        case "plane": {
          const v = typeof f[fd.key] === "string" ? f[fd.key] : "face";
          const active = p.activeField === fd.key;
          ctl = h("div", { class: "sel-box" }, segField(v, [["XY", "XY"], ["XZ", "XZ"], ["YZ", "YZ"]], (nv) => { p.activeField = null; set(fd.key, nv, true); }),
            h("button", { class: "chip" + (active || v === "face" ? " active" : ""), onclick: () => { p.activeField = active ? null : fd.key; this.renderPanel(); } }, active ? "Tap a face…" : v === "face" ? "Face ✓" : "Face"));
          break;
        }
        case "axis": {
          const v = typeof f[fd.key] === "string" ? f[fd.key] : "edge";
          const active = p.activeField === fd.key;
          ctl = h("div", { class: "sel-box" }, segField(v, [["x", "X"], ["y", "Y"], ["z", "Z"]], (nv) => { p.activeField = null; set(fd.key, nv, true); }),
            h("button", { class: "chip" + (active || v === "edge" ? " active" : ""), onclick: () => { p.activeField = active ? null : fd.key; this.renderPanel(); } }, active ? "Tap an edge…" : v === "edge" ? "Edge ✓" : "Edge"));
          break;
        }
        case "sketchAxis": {
          const sk = this.app.doc.features.find((x) => x.id === f.sketch);
          const lines = sk ? sk.entities.filter((e) => e.type === "line") : [];
          const opts = [["x", "Sketch X axis"], ["y", "Sketch Y axis"], ["X", "World X"], ["Y", "World Y"], ["Z", "World Z"], ...lines.map((e, i) => [e.id, `Line ${i + 1}${e.construction ? " (construction)" : ""}`])];
          ctl = selectField(f[fd.key] || "y", opts, (v) => set(fd.key, v));
          break;
        }
      }
      body.appendChild(row(fd.label, ctl, fd.hint));
    }
    const err = this.app.result.errors && this.app.result.errors[f.id];
    p.errEl = h("div", { class: "err-msg" }, err ? "⚠ " + err : "");
    body.appendChild(p.errEl);
    const actions = h("div", { style: { display: "flex", gap: "8px", marginTop: "10px" } },
      h("button", { class: "btn", style: { flex: 1 }, onclick: () => this.cancelPanel() }, "Cancel"),
      h("button", { class: "btn primary", style: { flex: 2 }, onclick: () => this.okPanel(), html: icon("check") + "OK" }));
    body.appendChild(actions);
    this.app.openSheet(f.name, body, { iconName: def.icon, onClose: () => { if (this.panel) this.cancelPanel(true); } });
    this.refreshPanelHighlights();
    const af = p.activeField && def.fields.find((x) => x.key === p.activeField);
    if (af) {
      const hints = { edges: "Tap edges on the model to select them", faces: "Tap faces on the model", face1: "Tap flat faces where the holes go", regions: "Tap closed areas of the sketch", plane: "Tap a flat face", axis: "Tap a straight or circular edge" };
      this.app.setHint(hints[af.type] || "");
    } else this.app.setHint("");
  }

  panelDoc() {
    // doc with the draft feature applied (for preview)
    const p = this.panel;
    const doc = JSON.parse(p.snapshot);
    const f = JSON.parse(JSON.stringify(p.f));
    if (p.existing) doc.features[p.index] = f;
    else { doc.features.splice(p.index, 0, f); if (doc.rollback != null) doc.rollback++; }
    // while picking on the input body, show the model before this feature
    if (p.activeField && p.def.picksOnInput) f.suppressed = true;
    if (p.activeField && p.def.fields.find((x) => x.key === p.activeField)?.type === "face1") f.suppressed = true;
    if (p.existing && doc.rollback == null) doc.rollback = null;
    return doc;
  }

  previewPanel() {
    if (!this.panel) return;
    clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(async () => {
      if (!this.panel) return;
      const doc = this.panelDoc();
      await this.app.regen(false, doc);
      if (!this.panel) return;
      const err = this.app.result.errors && this.app.result.errors[this.panel.f.id];
      if (this.panel.errEl) this.panel.errEl.textContent = err ? "⚠ " + err : "";
      this.refreshPanelHighlights();
    }, 120);
  }

  refreshPanelHighlights() {
    const p = this.panel;
    this.vp.clearHighlights();
    if (!p) return;
    const f = p.f;
    const res = this.app.result;
    const b = res.bodies.find((x) => x.id === f.body);
    if (f.edges && b) for (const sig of f.edges) { const i = nearestIndex(b.edges, sig.p); if (i >= 0) this.vp.highlightEdge(b.id, i); }
    if (f.faces && b) for (const sig of f.faces) { const i = nearestIndex(b.faces, sig.p); if (i >= 0) this.vp.highlightFace(b.id, i); }
    if (p.def === FEATURE_DEFS.hole && f.at) for (const pt of [f.at.p, ...(f.points || [])]) this.vp.addMarker(V3(pt), 0xe8611f);
    if (p.def.fields.some((x) => x.type === "body") && f.body && !p.def.picksOnInput && p.activeField == null && f.type !== "move") { /* body is visible anyway */ }
    if (typeof f.plane === "object" && f.plane && f.plane.face) { const pb = res.bodies.find((x) => x.id === f.plane.body); if (pb) { const i = nearestIndex(pb.faces, f.plane.face.p); if (i >= 0) this.vp.highlightFace(pb.id, i, 0x2f6fde); } }
    this.drawSketches();
  }

  panelPick(x, y) {
    const p = this.panel;
    const fd = p.def.fields.find((q) => q.key === p.activeField);
    const f = p.f;
    if (!fd) return;
    if (fd.type === "regions") {
      const hit = this.vp.pick(x, y, new Set(["region"]));
      if (!hit || hit.type !== "region") return;
      let sel = f.regions === "auto" || !f.regions ? [] : f.regions;
      const ix = sel.findIndex(([sx, sy]) => regionSampleSame(hit, sx, sy, this));
      if (ix >= 0) sel.splice(ix, 1); else sel.push(hit.sample);
      f.regions = sel.length ? sel : "auto";
      this.renderPanel();
      this.previewPanel();
      return;
    }
    if (fd.type === "edges") {
      const hit = this.vp.pick(x, y, new Set(["edge"]));
      if (!hit || hit.type !== "edge") return;
      if (f.body && hit.bodyId !== f.body) { if (f.edges && f.edges.length) { toast("Pick edges on the same body"); return; } }
      f.body = hit.bodyId;
      f.edges = f.edges || [];
      const ix = f.edges.findIndex((s) => dist3(s.p, hit.sig.p) < 1e-3);
      if (ix >= 0) f.edges.splice(ix, 1); else f.edges.push(hit.sig);
      this.renderPanel();
      return;
    }
    if (fd.type === "faces") {
      const hit = this.vp.pick(x, y, new Set(["face"]));
      if (!hit || hit.type !== "face") return;
      if (f.body && hit.bodyId !== f.body && f.faces && f.faces.length) { toast("Pick faces on the same body"); return; }
      f.body = hit.bodyId;
      f.faces = f.faces || [];
      const ix = f.faces.findIndex((s) => dist3(s.p, hit.sig.p) < 1e-3);
      if (ix >= 0) f.faces.splice(ix, 1); else f.faces.push(hit.sig);
      this.renderPanel();
      return;
    }
    if (fd.type === "face1") {
      const hit = this.vp.pick(x, y, new Set(["face"]));
      if (!hit || hit.type !== "face") return;
      if (hit.face.type !== "PLANE") { toast("Tap a flat face"); return; }
      const pt = hit.point.toArray().map((v) => +v.toFixed(4));
      if (!f.at) { f.at = { p: pt, n: hit.face.n }; f.body = hit.bodyId; f.points = []; }
      else f.points = [...(f.points || []), pt];
      this.renderPanel();
      return;
    }
    if (fd.type === "plane") {
      const hit = this.vp.pick(x, y, new Set(["face"]));
      if (!hit || hit.type !== "face" || hit.face.type !== "PLANE") { toast("Tap a flat face"); return; }
      f[fd.key] = { body: hit.bodyId, face: hit.sig };
      p.activeField = null;
      this.renderPanel();
      this.previewPanel();
      return;
    }
    if (fd.type === "axis") {
      const hit = this.vp.pick(x, y, new Set(["edge"]));
      if (!hit || hit.type !== "edge") return;
      f[fd.key] = { body: hit.bodyId, edge: hit.sig };
      p.activeField = null;
      this.renderPanel();
      this.previewPanel();
    }
  }

  okPanel() {
    const p = this.panel;
    if (!p) return;
    const doc = this.app.doc;
    const f = JSON.parse(JSON.stringify(p.f));
    // basic validation
    for (const fd of p.def.fields) {
      if (fd.when && !fd.when(f)) continue;
      if (fd.type === "num") { try { evaluate(f[fd.key], this.app.params()); } catch (e) { toast(`${fd.label}: ${e.message}`, "err"); return; } }
      if (fd.type === "sketch" && !f[fd.key]) { toast(`Choose ${fd.label.toLowerCase()}`, "err"); return; }
    }
    const restore = JSON.parse(p.snapshot);
    this.app.doc = restore;
    this.app.checkpoint();
    const d = this.app.doc;
    if (p.existing) d.features[p.index] = f;
    else { d.features.splice(p.index, 0, f); if (d.rollback != null) d.rollback++; }
    void doc;
    this.panel = null;
    this.app.closeSheet();
    this.app.setHint("");
    this.app.changed();
    this.renderToolbar();
    this.refreshTree();
  }

  cancelPanel(fromClose = false) {
    const p = this.panel;
    if (!p) return;
    this.panel = null;
    this.app.doc = JSON.parse(p.snapshot);
    if (!fromClose) this.app.closeSheet();
    this.app.setHint("");
    this.vp.clearHighlights();
    this.app.regen();
    this.renderToolbar();
  }

  // ---------- sketches ----------
  newSketch() {
    this.planePicker = true;
    const choose = (key) => { this.planePicker = false; this.app.closeSheet(); this.createSketch({ plane: { ...STD_PLANES[key] }, planeRef: key }); };
    const body = h("div", {},
      h("div", { class: "note" }, "Choose a plane to draw on — or tap any flat face of your model."),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", margin: "8px 0" } },
        ...["XY", "XZ", "YZ"].map((k) => h("button", { class: "big-action", style: { alignItems: "center" }, onclick: () => choose(k), html: icon(k === "XY" ? "top" : k === "XZ" ? "front" : "right") + PLANE_LABELS[k] }))));
    this.app.openSheet("New sketch", body, { iconName: "sketch", onClose: () => { this.planePicker = false; this.app.setHint(""); } });
    this.app.setHint("Pick a plane, or tap a flat face");
    this.showPlaneHelpers();
  }

  showPlaneHelpers() {
    const g = this.vp.helpers;
    g.clear();
    const s = Math.max(30, this.app.modelExtent() * 0.6);
    const mk = (pl, color) => {
      const geo = new THREE.PlaneGeometry(s, s);
      const X = V3(pl.x), N = V3(pl.n), Y = new THREE.Vector3().crossVectors(N, X);
      geo.applyMatrix4(new THREE.Matrix4().makeBasis(X, Y, N).setPosition(X.clone().multiplyScalar(s / 2).add(Y.clone().multiplyScalar(s / 2))));
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
      g.add(m);
    };
    mk(STD_PLANES.XY, 0x3f7fe0); mk(STD_PLANES.XZ, 0x4caf50); mk(STD_PLANES.YZ, 0xd9534f);
    this.vp.requestRender();
    const clear = () => { g.clear(); this.vp.requestRender(); };
    this.clearPlaneHelpers = clear;
  }

  planePickTap(x, y) {
    const hit = this.vp.pick(x, y, new Set(["face"]));
    if (!hit || hit.type !== "face" || hit.face.type !== "PLANE") { toast("Tap a flat face (or choose a plane)"); return; }
    this.planePicker = false;
    this.app.closeSheet();
    this.newSketchOnFace(hit);
  }

  newSketchOnFace(hit) {
    const n = hit.face.n.map((v) => +v.toFixed(9));
    const o = hit.face.p;
    const x = Math.abs(n[2]) > 0.9 ? [Math.sign(n[2]) || 1, 0, 0] : norm3(cross3([0, 0, 1], n));
    this.createSketch({ plane: { o, x, n }, planeRef: { body: hit.bodyId, face: hit.sig } });
  }

  createSketch({ plane, planeRef }) {
    this.clearPlaneHelpers && this.clearPlaneHelpers();
    this.clearSelection();
    const doc = this.app.doc;
    const f = { id: uid("f"), type: "sketch", name: nextName(doc, "sketch"), plane, planeRef, offset: 0, points: [], entities: [], constraints: [] };
    this.sketchSnapshot = JSON.stringify(doc);
    this.sketchIsNew = true;
    this.sketchFeature = f;
    this.enterSketch(f);
  }

  editSketch(f) {
    this.sketchSnapshot = JSON.stringify(this.app.doc);
    this.sketchIsNew = false;
    this.sketchFeature = JSON.parse(JSON.stringify(f));
    // use the solved, placed plane from the last rebuild
    const solved = this.app.result.sketches.find((s) => s.id === f.id);
    if (solved) this.sketchFeature.plane = solved.plane;
    this.enterSketch(this.sketchFeature);
  }

  enterSketch(f) {
    const pl = f.plane;
    const refEdges = this.referenceEdges(pl, f.id);
    this.floats.style.display = "none";
    this.selBar && this.selBar.remove();
    this.app.closeSheet();
    this.app.tabsEl.style.display = "none";
    this.sketcher.open(f, { refEdges, params: this.app.params(), onChange: () => { this.app.updateUndo(); this.updateDof(); this.renderSketchContext(); } });
    // header actions
    this.app.topExtra.innerHTML = "";
    this.app.topExtra.append(
      h("button", { class: "btn small", style: { background: "transparent", color: "var(--barText)", borderColor: "rgba(255,255,255,.25)" }, onclick: () => this.finishSketch(false) }, "Cancel"),
      h("button", { class: "btn small primary", style: { marginLeft: "6px" }, onclick: () => this.finishSketch(true), html: icon("check") + "Finish" }));
    this.app.titleEl.querySelector("b").textContent = f.name;
    this.app.titleEl.querySelector("small").textContent = typeof f.planeRef === "string" ? PLANE_LABELS[f.planeRef] : "On face";
    this.sketchCat = "Draw";
    this.dofEl = h("div", { class: "dof" });
    this.app.stage.appendChild(this.dofEl);
    this.updateDof();
    this.renderSketchToolbar();
    this.app.updateUndo();
    this.app.setHint("Tap Line, Rectangle or Circle to start drawing");
  }

  updateDof() {
    if (!this.dofEl) return;
    const s = this.sketcher;
    const n = s.dofCount;
    this.dofEl.className = "dof" + (n === 0 ? " full" : "");
    this.dofEl.textContent = !s.solveOk ? "⚠ conflicting constraints" : n === 0 ? "Fully constrained" : `${n} degree${n === 1 ? "" : "s"} of freedom`;
  }

  referenceEdges(pl, skipId) {
    const out = [];
    const O = V3(pl.o), X = V3(pl.x), N = V3(pl.n), Y = new THREE.Vector3().crossVectors(N, X);
    for (const b of this.app.result.bodies) {
      if (this.app.doc.bodies[b.id]?.visible === false) continue;
      if (!b.lines || !b.edgeGroups.length) continue;
      b.edgeGroups.forEach(([start, count], ei) => {
        const pts = [];
        let inPlane = true;
        for (let i = start; i < start + count; i++) {
          const p = new THREE.Vector3(b.lines[i * 3], b.lines[i * 3 + 1], b.lines[i * 3 + 2]).sub(O);
          const w = p.dot(N);
          if (Math.abs(w) > 1e-3) inPlane = false;
          const q = [+p.dot(X).toFixed(6), +p.dot(Y).toFixed(6)];
          if (i % 2 === 1 && i !== start + count - 1) continue; // lines are segment pairs; keep continuity
          pts.push(q);
        }
        if (pts.length >= 2) {
          const e = b.edges[ei];
          const r = { pts, inPlane };
          if (e && e.type === "CIRCLE" && inPlane) {
            // closed circle: estimate centre/radius in plane
            const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length, cy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
            const rr = Math.hypot(pts[0][0] - cx, pts[0][1] - cy);
            const closed = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-3;
            if (closed) { r.circle = { c: [cx, cy], r: rr }; r.center = [cx, cy]; }
          }
          out.push(r);
        }
      });
    }
    // other sketches on the same plane
    for (const s of this.app.result.sketches || []) {
      if (s.id === skipId) continue;
      const pts = pointMap(s);
      const sx = V3(s.plane.x), sn = V3(s.plane.n), so = V3(s.plane.o), sy = new THREE.Vector3().crossVectors(sn, sx);
      for (const e of s.entities) {
        if (e.construction || e.type === "point") continue;
        const P = sampleEntity(e, pts, 32).map(([u, v]) => { const p = so.clone().addScaledVector(sx, u).addScaledVector(sy, v).sub(O); return [p.dot(X), p.dot(Y), p.dot(N)]; });
        if (P.every((q) => Math.abs(q[2]) < 1e-3)) out.push({ pts: P.map((q) => [q[0], q[1]]), inPlane: false });
      }
    }
    return out;
  }

  finishSketch(save) {
    const sk = this.sketcher.close();
    this.dofEl && this.dofEl.remove();
    this.floats.style.display = "";
    this.app.tabsEl.style.display = "";
    this.app.topExtra.innerHTML = "";
    this.app.setHint("");
    const doc = JSON.parse(this.sketchSnapshot);
    this.app.doc = doc;
    if (save) {
      const hasGeo = sk.entities.length > 0;
      if (this.sketchIsNew && !hasGeo) { toast("Empty sketch discarded"); }
      else {
        this.app.checkpoint();
        if (this.sketchIsNew) {
          const idx = doc.rollback != null ? doc.rollback : doc.features.length;
          doc.features.splice(idx, 0, sk);
          if (doc.rollback != null) doc.rollback++;
        } else {
          const i = doc.features.findIndex((x) => x.id === sk.id);
          // keep the plane reference; plane is re-derived from it
          if (i >= 0) doc.features[i] = { ...sk, plane: doc.features[i].plane };
        }
        const closed = findRegions(sk).length;
        if (this.sketchIsNew && closed) setTimeout(() => this.app.setHint("Sketch saved — tap Extrude or Revolve to make it 3D"), 50);
      }
    }
    this.cat = "Create";
    this.renderToolbar();
    this.app.changed();
    this.refreshTree();
  }

  renderSketchToolbar() {
    const s = this.sketcher;
    if (!s.active) return;
    const tb = this.app.toolbar;
    tb.innerHTML = "";
    const cats = h("div", { class: "cats" });
    for (const c of ["Draw", "Modify", "Constrain", "Options"]) cats.appendChild(h("button", { class: "cat" + (c === this.sketchCat ? " on" : ""), onclick: () => { this.sketchCat = c; this.renderSketchToolbar(); } }, c));
    const tools = h("div", { class: "tools" });
    const add = (id, label, ic, on, fn, cls = "") => tools.appendChild(h("button", { class: "tool " + cls + (on ? " on" : ""), onclick: fn, html: icon(ic) + `<span>${label}</span>` }));
    const drawIds = ["select", "line", "rect", "rectCenter", "circle", "arc3", "arcCenter", "polygon", "slot", "spline", "point", "dimension"];
    const modIds = ["select", "trim", "extend", "fillet", "offset", "mirror", "construction", "project", "dimension"];
    if (this.sketchCat === "Draw" || this.sketchCat === "Modify") {
      const ids = this.sketchCat === "Draw" ? drawIds : modIds;
      for (const id of ids) { const t = SKETCH_TOOLS.find((x) => x.id === id); add(id, t.label, t.icon, s.tool === id, () => s.setTool(id)); }
      if (["line", "spline", "offset", "mirror"].includes(s.tool)) add("done", "Done", "check", false, () => s.finishTool());
    } else if (this.sketchCat === "Constrain") {
      for (const c of CONSTRAINT_TOOLS) {
        const info = CONSTRAINT_INFO[c];
        tools.appendChild(h("button", { class: "tool" + (s.tool === "c:" + c ? " on" : ""), onclick: () => s.setTool("c:" + c), html: `<span style="font-size:22px;line-height:26px;height:26px">${info.icon}</span><span>${info.label}</span>` }));
      }
    } else {
      add("grid", "Grid snap", "grid", s.gridSnap, () => { s.gridSnap = !s.gridSnap; this.renderSketchToolbar(); }, "toggle");
      add("construction", "Construction", "construction", s.constructionMode, () => { s.constructionMode = !s.constructionMode; this.renderSketchToolbar(); }, "toggle");
      add("fit", "Fit view", "fit", false, () => s.fitView());
      add("polygon", `Sides: ${s.polySides}`, "polygon", false, async () => { const v = await promptBox("Polygon sides", String(s.polySides), { numeric: true }); if (v) { s.polySides = Math.max(3, Math.min(64, Math.round(evaluate(v)))); this.renderSketchToolbar(); } });
      add("params", "Parameters", "params", false, () => this.openParams());
      add("look", "Look at 3D", "cube", false, () => { this.finishSketch(true); });
    }
    tb.append(cats, tools);
    this.renderSketchContext();
  }

  renderSketchContext() {
    const s = this.sketcher;
    this.ctxBar && this.ctxBar.remove();
    this.ctxBar = null;
    if (!s.active || s.tool !== "select" || !s.sel.size) { if (this.dofEl) this.dofEl.style.display = ""; return; }
    if (this.dofEl) this.dofEl.style.display = "none";
    const bar = h("div", { class: "subbar" });
    const add = (label, html, fn, title) => bar.appendChild(h("button", { class: "tool", title, onclick: fn, html: html + `<span>${label}</span>` }));
    add("Delete", icon("trash"), () => s.deleteSelection());
    add("Construct", icon("construction"), () => s.toggleConstructionSelection());
    add("Dimension", icon("dimension"), () => s.dimensionSelection());
    for (const c of s.suggestions()) {
      const info = CONSTRAINT_INFO[c];
      add(info.label, `<span style="font-size:22px;line-height:26px;height:26px">${info.icon}</span>`, () => s.applySuggestion(c));
    }
    add("Clear", icon("close"), () => { s.sel.clear(); s.redraw(); this.renderSketchContext(); });
    this.ctxBar = bar;
    this.app.stage.appendChild(bar);
  }

  // ---------- inspect ----------
  startMeasure() {
    this.stopMeasure();
    this.measure = { picks: [] };
    this.renderToolbar();
    this.app.setHint("Tap two points, edges or faces to measure between them");
    this.measureBody = h("div", {}, h("div", { class: "note" }, "Tap on the model. Circular edges snap to their centre."));
    this.app.openSheet("Measure", this.measureBody, { iconName: "measure", onClose: () => this.stopMeasure(true) });
  }

  stopMeasure(fromClose) {
    if (!this.measure) return;
    this.measure = null;
    this.vp.clearHighlights();
    this.vp.clearLabels();
    if (!fromClose) this.app.closeSheet();
    this.app.setHint("");
    this.renderToolbar();
  }

  measureTap(x, y) {
    const hit = this.vp.pick(x, y, new Set(["edge", "face"]));
    if (!hit) return;
    const m = this.measure;
    let p = hit.point.clone();
    let label = "point";
    const b = this.app.result.bodies.find((q) => q.id === hit.bodyId);
    if (hit.type === "edge") {
      const e = b.edges[hit.index];
      const [start, count] = b.edgeGroups[hit.index];
      const L = b.lines;
      const P = [];
      for (let i = start; i < start + count; i++) P.push(new THREE.Vector3(L[i * 3], L[i * 3 + 1], L[i * 3 + 2]));
      let len = 0;
      for (let i = 0; i + 1 < P.length; i += 2) len += P[i].distanceTo(P[i + 1]);
      if (e.type === "CIRCLE") {
        const c = P.reduce((s, q) => s.add(q), new THREE.Vector3()).multiplyScalar(1 / P.length);
        const r = c.distanceTo(P[0]);
        p = c;
        label = `circle ⌀${fmt(2 * r, 3)}`;
      } else {
        // snap to the nearest end if close, else keep the picked point
        const a = P[0], z = P[P.length - 1];
        const px = this.vp.pixelSize(p) * 24;
        if (a.distanceTo(hit.point) < px) p = a.clone(); else if (z.distanceTo(hit.point) < px) p = z.clone();
        label = `edge, length ${fmt(len, 3)}`;
      }
      this.vp.highlightEdge(b.id, hit.index, 0x2f6fde);
    } else if (hit.type === "face") {
      this.vp.highlightFace(b.id, hit.index, 0x2f6fde);
      label = faceLabel(hit.face);
      if (hit.face.radius) label += ` ⌀${fmt(2 * hit.face.radius, 3)}`;
    }
    m.picks.push({ p, label, hit });
    this.vp.addMarker(p, 0xe8611f);
    if (m.picks.length > 2) { m.picks = [m.picks[m.picks.length - 1]]; this.vp.clearHighlights(); this.vp.clearLabels(); this.vp.addMarker(p, 0xe8611f); }
    const body = this.measureBody;
    body.innerHTML = "";
    m.picks.forEach((q, i) => body.appendChild(row(`Pick ${i + 1}`, h("span", {}, q.label), `${fmt(q.p.x, 3)}, ${fmt(q.p.y, 3)}, ${fmt(q.p.z, 3)}`)));
    if (m.picks.length === 2) {
      const [a, c] = m.picks;
      const d = a.p.distanceTo(c.p);
      this.vp.addFatLines([a.p.x, a.p.y, a.p.z, c.p.x, c.p.y, c.p.z], 0xe8611f, 2, this.vp.overlay, { depthTest: false });
      this.vp.addLabel(a.p.clone().add(c.p).multiplyScalar(0.5), `${fmt(d, 3)} mm`);
      body.appendChild(row("Distance", h("b", {}, `${fmt(d, 3)} mm`)));
      body.appendChild(row("ΔX / ΔY / ΔZ", h("span", {}, `${fmt(Math.abs(c.p.x - a.p.x), 3)} / ${fmt(Math.abs(c.p.y - a.p.y), 3)} / ${fmt(Math.abs(c.p.z - a.p.z), 3)}`)));
      if (a.hit.type === "face" && c.hit.type === "face" && a.hit.face.n && c.hit.face.n) {
        const ang = Math.acos(Math.max(-1, Math.min(1, Math.abs(V3(a.hit.face.n).dot(V3(c.hit.face.n)))))) * 180 / Math.PI;
        body.appendChild(row("Angle between faces", h("span", {}, `${fmt(ang, 2)}°`)));
      }
      if (a.hit.bodyId !== c.hit.bodyId) {
        this.app.kernel.call("distance", { a: a.hit.bodyId, b: c.hit.bodyId }).then((dd) => body.appendChild(row("Gap between bodies", h("span", {}, `${fmt(dd, 3)} mm`)))).catch(() => {});
      }
    }
    body.appendChild(h("button", { class: "btn small", onclick: () => { m.picks = []; this.vp.clearHighlights(); this.vp.clearLabels(); body.innerHTML = ""; } }, "Clear"));
  }

  openSection() {
    if (this.sectionState) { this.sectionState = null; this.vp.setSection(null); this.app.closeSheet(); this.renderToolbar(); return; }
    const box = this.vp.bbox();
    const st = { axis: "z", offset: 0, flip: false };
    const range = () => ({ min: box.min[st.axis], max: box.max[st.axis] });
    st.offset = (range().min + range().max) / 2;
    this.sectionState = st;
    const slider = h("input", { type: "range", min: 0, max: 1000, value: 500, style: { width: "100%" } });
    const val = h("span", {}, fmt(st.offset, 2) + " mm");
    const apply = () => { this.vp.setSection({ ...st }); val.textContent = fmt(st.offset, 2) + " mm"; };
    slider.addEventListener("input", () => { const r = range(); st.offset = r.min + ((r.max - r.min) * slider.value) / 1000; apply(); });
    const body = h("div", {},
      row("Cut along", segField("z", [["x", "X"], ["y", "Y"], ["z", "Z"]], (v) => { st.axis = v; const r = range(); st.offset = r.min + ((r.max - r.min) * slider.value) / 1000; apply(); })),
      row("Flip side", switchField(false, (v) => { st.flip = v; apply(); })),
      row("Position", val), slider,
      h("button", { class: "btn", style: { marginTop: "10px", width: "100%" }, onclick: () => this.openSection() }, "Close section"));
    apply();
    this.app.openSheet("Section view", body, { iconName: "section", onClose: () => { if (this.sectionState) { this.sectionState = null; this.vp.setSection(null); this.renderToolbar(); } } });
    this.renderToolbar();
  }

  openProperties() {
    const res = this.app.result;
    const doc = this.app.doc;
    const dens = { "PLA": 1.24, "PETG": 1.27, "ABS": 1.04, "Nylon": 1.14, "Aluminium 6061": 2.70, "Steel": 7.85, "Stainless 304": 8.0, "Brass": 8.5, "Titanium": 4.43, "Oak": 0.75, "Pine": 0.5, "Acrylic": 1.18 };
    let mat = doc.material || "PLA";
    const list = h("div", {});
    const render = () => {
      list.innerHTML = "";
      let tv = 0;
      for (const b of res.bodies) {
        const meta = doc.bodies[b.id] || {};
        if (meta.visible === false) continue;
        tv += b.volume;
        const bb = b.bbox;
        list.appendChild(h("div", { class: "group-title" }, meta.name || b.id));
        list.appendChild(row("Volume", h("span", {}, `${fmt(b.volume / 1000, 3)} cm³`)));
        list.appendChild(row("Mass", h("span", {}, `${fmt((b.volume / 1000) * dens[mat], 2)} g`)));
        if (b.area) list.appendChild(row("Surface area", h("span", {}, `${fmt(b.area / 100, 2)} cm²`)));
        list.appendChild(row("Size X × Y × Z", h("span", {}, `${fmt(bb[1][0] - bb[0][0], 2)} × ${fmt(bb[1][1] - bb[0][1], 2)} × ${fmt(bb[1][2] - bb[0][2], 2)} mm`)));
        if (b.kind !== "mesh") list.appendChild(row("Centre of mass", h("span", {}, b.com.map((v) => fmt(v, 2)).join(", "))));
      }
      if (res.bodies.length > 1) { list.appendChild(h("div", { class: "group-title" }, "Total (visible)")); list.appendChild(row("Mass", h("b", {}, `${fmt((tv / 1000) * dens[mat], 2)} g`))); }
    };
    render();
    const body = h("div", {}, row("Material", selectField(mat, Object.keys(dens).map((k) => [k, `${k} (${dens[k]} g/cm³)`]), (v) => { mat = v; doc.material = v; render(); })), list);
    this.app.openSheet("Physical properties", body, { iconName: "info" });
  }
}

// ---------- helpers ----------
function nearestIndex(list, p) {
  let best = -1, bd = Infinity;
  list.forEach((e, i) => { const d = dist3(e.p, p); if (d < bd) { bd = d; best = i; } });
  return bd < 2.5 ? best : -1;
}
function dist3(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm3(a) { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); }
function faceLabel(f) {
  const t = { PLANE: "flat face", CYLINDRE: "cylindrical face", CYLINDER: "cylindrical face", CONE: "conical face", SPHERE: "spherical face", TORUS: "toroidal face", BSPLINE_SURFACE: "freeform face", BEZIER_SURFACE: "freeform face", REVOLUTION: "revolved face", EXTRUSION: "extruded face" };
  return t[f.type] || "face";
}
function regionHas(r, x, y) {
  const inside = (poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  if (!inside(r.outer.poly)) return false;
  return !r.holes.some((hh) => inside(hh.poly));
}
function regionSampleSame(hit, sx, sy, ws) {
  const s = ws.app.result.sketches.find((q) => q.id === hit.sketchId);
  if (!s) return false;
  const regions = findRegions(s);
  const r = regions[hit.regionIndex];
  return r && regionHas(r, sx, sy);
}
function describe(f, doc) {
  const sk = (id) => doc.features.find((x) => x.id === id)?.name || "?";
  switch (f.type) {
    case "sketch": return `${f.entities.filter((e) => e.type !== "point").length} curves · ${typeof f.planeRef === "string" ? f.planeRef : "on face"}`;
    case "extrude": return `${sk(f.sketch)} · ${f.throughAll ? "through all" : f.distance + " mm"} · ${f.op}`;
    case "revolve": return `${sk(f.sketch)} · ${f.angle}° · ${f.op}`;
    case "loft": return `${(f.sketches || []).length} profiles · ${f.op}`;
    case "sweep": return `${sk(f.sketch)} along ${sk(f.path)}`;
    case "primitive": return `${f.shape} · ${f.op}`;
    case "fillet": return `${(f.edges || []).length} edges · R${f.radius}`;
    case "chamfer": return `${(f.edges || []).length} edges · ${f.distance} mm`;
    case "shell": return `${f.thickness} mm wall`;
    case "hole": return `⌀${f.diameter} · ${1 + (f.points || []).length} hole(s)`;
    case "linearPattern": return `${f.count} × ${f.spacing} mm`;
    case "circularPattern": return `${f.count} × ${f.angle}°`;
    case "mesh": return "mesh (STL/OBJ)";
    case "import": return "imported solid";
    default: return FEATURE_LABELS[f.type] || f.type;
  }
}
