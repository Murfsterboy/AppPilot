// CNC workspace: stock & origin setup, tool library, operations, toolpaths, simulation and G-code.
import * as THREE from "three";
import { WorkerRPC } from "../core/rpc.js";
import { uid, DEFAULT_TOOLS } from "../core/doc.js";
import * as P from "../core/poly.js";
import { pointMap, sampleEntity } from "../sketch/profiles.js";
import { h, ib, toast, row, numField, selectField, segField, switchField, textField, fmt, fmtTime, popMenu, confirmBox, modal } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { saveFile } from "../core/files.js";

export const OP_TYPES = {
  facing: { label: "Facing", icon: "slice", desc: "Flatten the top of the stock" },
  adaptive: { label: "Adaptive clearing", icon: "layers", desc: "Fast 3D roughing with small stepover and ramped entries" },
  roughing: { label: "Roughing (raster)", icon: "linearPattern", desc: "3D roughing with zig-zag passes level by level" },
  pocket: { label: "Pocket", icon: "shell", desc: "Clear a pocket down to a picked floor face" },
  contour: { label: "Contour / profile", icon: "fillet2d", desc: "Cut around the part outline, with tabs" },
  finishing: { label: "Finishing (3D)", icon: "sphere", desc: "Parallel or waterline passes following the surface" },
  drilling: { label: "Drilling", icon: "hole", desc: "Drill vertical holes found in the model" },
  engrave: { label: "Engraving", icon: "text", desc: "Follow sketch curves at a shallow depth" },
};

const OP_DEFAULTS = {
  facing: { stepoverPct: 70, stepdown: 1, depthTo: null, tool: "t7", angle: 0 },
  adaptive: { stepoverPct: 15, stepdown: 6, stockToLeave: 0.3, tool: "t1" },
  roughing: { stepoverPct: 45, stepdown: 2, stockToLeave: 0.5, tool: "t1", angle: 0 },
  pocket: { stepoverPct: 45, stepdown: 2, stockToLeave: 0, tool: "t2", faces: [] },
  contour: { stepoverPct: 50, stepdown: 2, side: "outside", tabs: true, tabCount: 4, tabWidth: 6, tabHeight: 2, leadIn: 2, tool: "t1", breakThrough: 0.3 },
  finishing: { stepoverPct: 10, stepdown: 1, style: "raster", angle: 0, tool: "t3", stockToLeave: 0 },
  drilling: { peck: 3, minD: 0, maxD: 50, breakThrough: 1, tool: "t6" },
  engrave: { depth: 0.5, stepdown: 0.5, tool: "t5", sketch: "" },
};

export class CamWS {
  constructor(app) {
    this.app = app;
    this.vp = app.viewport;
    this.worker = new WorkerRPC("cam-worker.js");
    this.group = new THREE.Group();
    this.group.visible = false;
    this.vp.scene.add(this.group);
    this.results = null;
    this.vp.onTap((x, y) => { if (this.app.ws === "cnc") this.onTap(x, y); });
  }

  get cam() { return this.app.doc.cam; }

  enter() {
    this.vp.sketchGroup.visible = false;
    this.vp.grid.visible = true;
    this.group.visible = true;
    this.applyBodyFilter();
    this.renderToolbar();
    this.floats = h("div", { class: "float right" },
      h("button", { class: "fbtn", title: "Fit", html: icon("fit"), onclick: () => this.fitStock() }),
      h("button", { class: "fbtn", title: "Top", html: icon("top"), onclick: () => this.vp.setView("top") }),
      h("button", { class: "fbtn", title: "Iso", html: icon("cube"), onclick: () => this.vp.setView("iso") }),
      h("button", { class: "fbtn", title: "Show model", html: icon("eye"), onclick: (e) => { this.hideModel = !this.hideModel; e.currentTarget.classList.toggle("on", this.hideModel); this.applyBodyFilter(); } }));
    this.app.stage.appendChild(this.floats);
    this.refresh().then(() => this.fitStock());
    if (!this.cam.ops.length) setTimeout(() => this.app.setHint("Check the stock in Setup, then add operations with ＋"), 300);
  }

  leave() {
    this.stopSim(true);
    this.group.visible = false;
    this.vp.sketchGroup.visible = true;
    for (const [id, e] of this.vp.bodies) e.group.visible = this.app.doc.bodies[id]?.visible !== false;
    this.floats && this.floats.remove();
    this.pickMode = null;
    this.vp.clearHighlights();
    this.vp.requestRender();
  }

  fitStock() {
    if (!this.stock) return;
    this.vp.fit(true, new THREE.Box3(new THREE.Vector3(...this.stock.min), new THREE.Vector3(...this.stock.max)));
  }

  bodyIds() {
    const sel = this.cam.bodies;
    const all = this.app.result.bodies.map((b) => b.id);
    return sel && sel.length ? sel.filter((id) => all.includes(id)) : this.app.visibleBodyIds();
  }

  applyBodyFilter() {
    const ids = new Set(this.bodyIds());
    for (const [id, e] of this.vp.bodies) e.group.visible = ids.has(id) && !this.hideModel && !this.simActive;
    this.vp.requestRender();
  }

  onModelChanged() { this.results = null; this.refresh(); }

  async refresh() {
    if (!this.app.doc) return;
    this.applyBodyFilter();
    const ids = this.bodyIds();
    this.tris = ids.length ? await this.app.meshForBodies(ids).catch(() => null) : null;
    this.computeStock();
    this.drawSetup();
    this.drawPaths();
  }

  // ---------- setup ----------
  computeStock() {
    const c = this.cam;
    let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    if (this.tris) for (let i = 0; i < this.tris.length; i += 3) for (let k = 0; k < 3; k++) { const v = this.tris[i + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
    if (!Number.isFinite(min[0])) { min = [0, 0, 0]; max = [50, 50, 20]; }
    this.partBox = { min, max };
    let smin, smax;
    if (c.stockMode === "fixed" && c.stockX > 0 && c.stockY > 0 && c.stockZ > 0) {
      const cx = (min[0] + max[0]) / 2, cy = (min[1] + max[1]) / 2;
      smin = [cx - c.stockX / 2, cy - c.stockY / 2, max[2] + c.stockTopOffset - c.stockZ];
      smax = [cx + c.stockX / 2, cy + c.stockY / 2, max[2] + c.stockTopOffset];
    } else {
      const m = c.stockMargin;
      smin = [min[0] - m, min[1] - m, min[2]];
      smax = [max[0] + m, max[1] + m, max[2] + c.stockTopOffset];
    }
    this.stock = { min: smin, max: smax };
    const o = c.origin;
    const wx = o.includes("center") ? (smin[0] + smax[0]) / 2 : smin[0];
    const wy = o.includes("center") ? (smin[1] + smax[1]) / 2 : smin[1];
    const wz = o.startsWith("bottom") ? smin[2] : smax[2];
    this.wcs = { ox: wx, oy: wy, oz: wz, safeZ: smax[2] + c.safeZ - wz, label: { "top-corner": "top, front-left corner of stock", "top-center": "top centre of stock", "bottom-corner": "bottom, front-left corner" }[o] || o };
  }

  drawSetup() {
    if (this.setupGroup) this.group.remove(this.setupGroup);
    const g = new THREE.Group();
    const s = this.stock;
    const box = new THREE.Box3(new THREE.Vector3(...s.min), new THREE.Vector3(...s.max));
    g.add(new THREE.Box3Helper(box, 0x2bb3c0));
    const stockMesh = new THREE.Mesh(new THREE.BoxGeometry(s.max[0] - s.min[0], s.max[1] - s.min[1], s.max[2] - s.min[2]), new THREE.MeshBasicMaterial({ color: 0x2bb3c0, transparent: true, opacity: 0.07, depthWrite: false }));
    stockMesh.position.set((s.min[0] + s.max[0]) / 2, (s.min[1] + s.max[1]) / 2, (s.min[2] + s.max[2]) / 2);
    stockMesh.raycast = () => {};
    g.add(stockMesh);
    // WCS triad
    const L = Math.max(8, (s.max[0] - s.min[0]) * 0.15);
    const o = new THREE.Vector3(this.wcs.ox, this.wcs.oy, this.wcs.oz);
    for (const [d, c] of [[[1, 0, 0], 0xd9534f], [[0, 1, 0], 0x4caf50], [[0, 0, 1], 0x3f7fe0]]) g.add(new THREE.ArrowHelper(new THREE.Vector3(...d), o, L, c, L * 0.25, L * 0.12));
    this.setupGroup = g;
    this.group.add(g);
    this.vp.requestRender();
  }

  // ---------- toolbar & menus ----------
  renderToolbar() {
    const tb = this.app.toolbar;
    tb.innerHTML = "";
    const tools = h("div", { class: "tools", style: { paddingTop: "8px" } });
    const add = (ic, label, fn, on) => tools.appendChild(h("button", { class: "tool" + (on ? " on" : ""), onclick: fn, html: icon(ic) + `<span>${label}</span>` }));
    add("stock", "Setup", () => this.openSetup());
    add("tool", "Tools", () => this.openTools());
    add("plus", "Operation", (e) => this.addOpMenu(e.currentTarget));
    add("ops", `Ops (${this.cam.ops.length})`, () => this.openOps());
    add("cnc", "Generate", () => this.generate());
    add("play", "Simulate", () => this.simulate(), this.simActive);
    add("export", "G-code", () => this.exportGcode());
    tb.appendChild(tools);
  }

  openMore(anchor) {
    popMenu(anchor, [
      { label: "Setup (stock & origin)", icon: "stock", action: () => this.openSetup() },
      { label: "Tool library", icon: "tool", action: () => this.openTools() },
      { label: "Operations", icon: "ops", action: () => this.openOps() },
      { label: "Show G-code", icon: "text", action: () => this.showGcode() },
      { label: "Export G-code", icon: "export", action: () => this.exportGcode() },
    ]);
  }

  openSetup() {
    const c = this.cam;
    const ch = (k, num = true) => (v) => { c[k] = num ? +v : v; this.app.changed({ regen: false }); this.results = null; this.computeStock(); this.drawSetup(); this.drawPaths(); };
    const bodies = this.app.result.bodies;
    const sel = new Set(this.bodyIds());
    const body = h("div", {},
      h("div", { class: "group-title" }, "Part"),
      ...bodies.map((b) => row(this.app.doc.bodies[b.id]?.name || b.id, switchField(sel.has(b.id), (v) => { const s = new Set(this.bodyIds()); v ? s.add(b.id) : s.delete(b.id); c.bodies = [...s]; this.app.changed({ regen: false }); this.refresh(); }))),
      h("div", { class: "group-title" }, "Stock"),
      row("Stock size", segField(c.stockMode, [["box", "Part + margin"], ["fixed", "Fixed size"]], (v) => { ch("stockMode", false)(v); this.openSetup(); })),
      ...(c.stockMode === "fixed"
        ? [row("Width X", numField(c.stockX || Math.round(this.partBox.max[0] - this.partBox.min[0] + 10), ch("stockX"), { unit: "mm" })), row("Depth Y", numField(c.stockY || Math.round(this.partBox.max[1] - this.partBox.min[1] + 10), ch("stockY"), { unit: "mm" })), row("Height Z", numField(c.stockZ || Math.round(this.partBox.max[2] - this.partBox.min[2] + 2), ch("stockZ"), { unit: "mm" }))]
        : [row("Side margin", numField(c.stockMargin, ch("stockMargin"), { unit: "mm", step: 1 }))]),
      row("Extra on top", numField(c.stockTopOffset, ch("stockTopOffset"), { unit: "mm", step: 0.5 }), "Material above the part to face off"),
      h("div", { class: "group-title" }, "Machine"),
      row("Work origin (G54)", selectField(c.origin, [["top-corner", "Stock top, front-left"], ["top-center", "Stock top, centre"], ["bottom-corner", "Stock bottom, front-left"]], ch("origin", false))),
      row("Safe height", numField(c.safeZ, ch("safeZ"), { unit: "mm" }), "Above stock top, for rapid moves"),
      row("Retract height", numField(c.retractZ, ch("retractZ"), { unit: "mm" })),
      row("Controller", selectField(c.post, [["grbl", "GRBL (hobby routers)"], ["linuxcnc", "LinuxCNC / Mach3/4"], ["fanuc", "Fanuc-style"]], ch("post", false))),
      row("Coolant (M8)", switchField(c.coolant, ch("coolant", false))),
      h("div", { class: "note" }, `Stock: ${fmt(this.stock.max[0] - this.stock.min[0], 1)} × ${fmt(this.stock.max[1] - this.stock.min[1], 1)} × ${fmt(this.stock.max[2] - this.stock.min[2], 1)} mm. The part is machined from the top (+Z).`));
    this.app.openSheet("CNC setup", body, { iconName: "stock" });
  }

  openTools() {
    const c = this.cam;
    const list = h("div", {});
    const render = () => {
      list.innerHTML = "";
      for (const t of c.tools) {
        list.appendChild(h("div", { class: "op-card", onclick: () => this.editTool(t, render) }, h("span", { html: icon("tool") }),
          h("div", { class: "nm" }, `T${t.number} · ${t.name}`, h("small", {}, `${t.type} Ø${t.diameter} mm · ${t.rpm} rpm · F${t.feed} / plunge ${t.plunge}`)), ib("chevronRight", "Edit", () => {})));
      }
      list.appendChild(h("button", { class: "btn", onclick: () => { const t = { id: uid("t"), number: Math.max(0, ...c.tools.map((q) => q.number)) + 1, name: "New tool", type: "flat", diameter: 4, flutes: 2, length: 15, rpm: 18000, feed: 900, plunge: 250 }; c.tools.push(t); this.app.changed({ regen: false }); this.editTool(t, render); }, html: icon("plus") + "Add tool" }));
      list.appendChild(h("button", { class: "btn small", style: { marginLeft: "8px" }, onclick: async () => { if (await confirmBox("Reset tools?", "Replace the library with the default tools.")) { c.tools = JSON.parse(JSON.stringify(DEFAULT_TOOLS)); this.app.changed({ regen: false }); render(); } } }, "Reset"));
    };
    render();
    this.app.openSheet("Tool library", list, { iconName: "tool" });
  }

  editTool(t, done) {
    const ch = (k, num = true) => (v) => { t[k] = num ? +v : v; this.app.changed({ regen: false }); this.results = null; };
    const body = h("div", {},
      row("Name", textField(t.name, ch("name", false))),
      row("Number", numField(t.number, ch("number"), { unit: "", step: 1 })),
      row("Type", selectField(t.type, [["flat", "Flat end mill"], ["ball", "Ball end mill"], ["vbit", "V-bit / engraver"], ["drill", "Drill"]], ch("type", false))),
      row("Diameter", numField(t.diameter, ch("diameter"), { unit: "mm", step: 0.5 })),
      row("Tip angle", numField(t.angle || 90, ch("angle"), { unit: "°" }), "V-bits and drills"),
      row("Flutes", numField(t.flutes, ch("flutes"), { unit: "", step: 1 })),
      row("Flute length", numField(t.length, ch("length"), { unit: "mm" })),
      row("Spindle speed", numField(t.rpm, ch("rpm"), { unit: "rpm", step: 1000 })),
      row("Feed rate", numField(t.feed, ch("feed"), { unit: "mm/min", step: 100 })),
      row("Plunge rate", numField(t.plunge, ch("plunge"), { unit: "mm/min", step: 50 })),
      h("div", { class: "note" }, `Chip load ≈ ${fmt(t.feed / (t.rpm * (t.flutes || 1)), 4)} mm/tooth`),
      h("div", { style: { display: "flex", gap: "8px", marginTop: "10px" } },
        h("button", { class: "btn danger", onclick: () => { const c = this.cam; if (c.ops.some((o) => o.toolId === t.id)) { toast("An operation uses this tool"); return; } c.tools.splice(c.tools.indexOf(t), 1); this.app.changed({ regen: false }); this.openTools(); } }, "Delete"),
        h("button", { class: "btn primary", style: { flex: 1 }, onclick: () => this.openTools() }, "Done")));
    this.app.openSheet(`Tool T${t.number}`, body, { iconName: "tool" });
  }

  addOpMenu(anchor) {
    popMenu(anchor, Object.entries(OP_TYPES).map(([k, v]) => ({ label: v.label, icon: v.icon, action: () => this.addOp(k) })));
  }

  addOp(type) {
    const c = this.cam;
    const d = OP_DEFAULTS[type];
    const tool = c.tools.find((t) => t.id === d.tool) || c.tools.find((t) => (type === "finishing" ? t.type === "ball" : type === "engrave" ? t.type === "vbit" : type === "drilling" ? t.type === "drill" : t.type === "flat")) || c.tools[0];
    let n = 1;
    while (c.ops.some((o) => o.name === `${OP_TYPES[type].label} ${n}`)) n++;
    const op = { id: uid("op"), type, name: `${OP_TYPES[type].label} ${n}`, toolId: tool.id, ...JSON.parse(JSON.stringify(d)), feed: tool.feed, plunge: tool.plunge, rpm: tool.rpm };
    delete op.tool;
    if (type === "engrave") { const sk = this.flatSketches()[0]; if (sk) op.sketch = sk.id; }
    this.app.checkpoint();
    c.ops.push(op);
    this.app.changed({ regen: false });
    this.renderToolbar();
    this.editOp(op);
  }

  openOps() {
    const c = this.cam;
    const list = h("div", {});
    if (!c.ops.length) list.appendChild(h("div", { class: "empty", html: icon("ops") + "No operations yet. Tap <b>＋ Operation</b>. A typical job: Facing → Adaptive clearing → Finishing → Contour." }));
    c.ops.forEach((op, i) => {
      const tool = c.tools.find((t) => t.id === op.toolId);
      const r = this.results && this.results.find((q) => q.id === op.id);
      const sub = r ? (r.error ? "⚠ " + r.error : `${fmtTime(r.stats.time)} · ${fmt(r.stats.cut / 1000, 2)} m cutting`) : `${tool ? "T" + tool.number + " " + tool.name : "no tool"}`;
      list.appendChild(h("div", { class: "op-card" + (r && r.error ? " err" : ""), style: { opacity: op.disabled ? 0.5 : 1 }, onclick: (e) => { if (e.target.closest(".ib")) return; this.editOp(op); } },
        h("span", { html: icon(OP_TYPES[op.type].icon) }),
        h("div", { class: "nm" }, `${i + 1}. ${op.name}`, h("small", {}, sub)),
        ib("more", "Options", (e) => popMenu(e.currentTarget, [
          { label: "Edit", icon: "edit", action: () => this.editOp(op) },
          { label: op.disabled ? "Enable" : "Disable", icon: "suppress", action: () => { op.disabled = !op.disabled; this.app.changed({ regen: false }); this.results = null; this.openOps(); } },
          { label: "Duplicate", icon: "copy", action: () => { const cp = { ...JSON.parse(JSON.stringify(op)), id: uid("op"), name: op.name + " copy" }; c.ops.splice(i + 1, 0, cp); this.app.changed({ regen: false }); this.openOps(); } },
          i > 0 ? { label: "Move up", icon: "chevronUp", action: () => { [c.ops[i - 1], c.ops[i]] = [c.ops[i], c.ops[i - 1]]; this.app.changed({ regen: false }); this.openOps(); } } : null,
          i < c.ops.length - 1 ? { label: "Move down", icon: "chevronDown", action: () => { [c.ops[i + 1], c.ops[i]] = [c.ops[i], c.ops[i + 1]]; this.app.changed({ regen: false }); this.openOps(); } } : null,
          "-",
          { label: "Delete", icon: "trash", action: () => { this.app.checkpoint(); c.ops.splice(i, 1); this.app.changed({ regen: false }); this.results = null; this.drawPaths(); this.renderToolbar(); this.openOps(); } },
        ]))));
    });
    if (c.ops.length) list.appendChild(h("button", { class: "btn primary", style: { width: "100%", marginTop: "8px" }, onclick: () => this.generate(), html: icon("cnc") + "Generate toolpaths" }));
    this.app.openSheet("Operations", list, { iconName: "ops" });
  }

  flatSketches() {
    return (this.app.result.sketches || []).filter((s) => Math.abs(Math.abs(s.plane.n[2]) - 1) < 1e-6);
  }

  editOp(op) {
    const c = this.cam;
    const tool = () => c.tools.find((t) => t.id === op.toolId) || c.tools[0];
    const ch = (k, num = true) => (v) => { op[k] = num ? (v === "" ? null : +v) : v; this.app.changed({ regen: false }); this.results = null; };
    const body = h("div", {}, h("div", { class: "note" }, OP_TYPES[op.type].desc));
    body.append(
      row("Name", textField(op.name, ch("name", false))),
      row("Tool", selectField(op.toolId, c.tools.map((t) => [t.id, `T${t.number} ${t.name}`]), (v) => { op.toolId = v; const t = tool(); op.feed = t.feed; op.plunge = t.plunge; op.rpm = t.rpm; this.app.changed({ regen: false }); this.results = null; this.editOp(op); })));
    body.append(h("div", { class: "group-title" }, "Feeds & speeds"),
      row("Spindle", numField(op.rpm, ch("rpm"), { unit: "rpm", step: 1000 })),
      row("Feed rate", numField(op.feed, ch("feed"), { unit: "mm/min", step: 100 })),
      row("Plunge rate", numField(op.plunge, ch("plunge"), { unit: "mm/min", step: 50 })));
    body.append(h("div", { class: "group-title" }, "Passes"));
    if (op.type !== "drilling" && op.type !== "engrave") body.append(row("Stepover", numField(op.stepoverPct, ch("stepoverPct"), { unit: "% of Ø", step: 5, min: 1 }), `= ${fmt((tool().diameter * op.stepoverPct) / 100, 2)} mm`));
    if (op.type !== "drilling") body.append(row("Step down", numField(op.stepdown, ch("stepdown"), { unit: "mm", step: 0.5 })));
    if (["adaptive", "roughing", "pocket", "contour", "finishing"].includes(op.type)) body.append(row("Stock to leave", numField(op.stockToLeave ?? 0, ch("stockToLeave"), { unit: "mm", step: 0.1 })));
    if (["facing", "roughing", "finishing"].includes(op.type)) body.append(row("Pass angle", numField(op.angle || 0, ch("angle"), { unit: "°", step: 45 })));
    if (["adaptive", "roughing", "pocket", "contour", "finishing"].includes(op.type)) body.append(row("Climb milling", switchField(op.climb !== false, (v) => { op.climb = v; this.app.changed({ regen: false }); })));
    if (["facing", "adaptive", "roughing", "contour", "finishing"].includes(op.type)) body.append(row("Bottom height", numField(op.depthTo ?? "", ch("depthTo"), { unit: "mm" }), op.type === "facing" ? "Blank = top of part" : "Blank = automatic"));
    if (op.type === "finishing") body.append(row("Style", segField(op.style, [["raster", "Parallel"], ["waterline", "Waterline"]], ch("style", false))));
    if (op.type === "contour") {
      body.append(
        row("Side", segField(op.side, [["outside", "Outside"], ["inside", "Inside"], ["on", "On line"]], ch("side", false))),
        row("Lead-in", numField(op.leadIn, ch("leadIn"), { unit: "mm" })),
        row("Break-through", numField(op.breakThrough, ch("breakThrough"), { unit: "mm", step: 0.1 }), "Cut this far below the stock"),
        row("Holding tabs", switchField(op.tabs, (v) => { op.tabs = v; this.app.changed({ regen: false }); this.results = null; this.editOp(op); })));
      if (op.tabs) body.append(row("Tab count", numField(op.tabCount, ch("tabCount"), { unit: "", step: 1 })), row("Tab width", numField(op.tabWidth, ch("tabWidth"), { unit: "mm" })), row("Tab height", numField(op.tabHeight, ch("tabHeight"), { unit: "mm", step: 0.5 })));
    }
    if (op.type === "pocket") {
      const n = (op.faces || []).length;
      body.append(row("Floor faces", h("div", { class: "sel-box" },
        h("button", { class: "chip" + (this.pickMode === op.id ? " active" : "") + (n ? "" : " err"), onclick: () => { this.pickMode = this.pickMode === op.id ? null : op.id; this.app.setHint(this.pickMode ? "Tap the flat floor face(s) of the pocket" : ""); this.editOp(op); this.highlightOpFaces(op); } }, this.pickMode === op.id ? `Tap faces… (${n})` : `${n} face${n === 1 ? "" : "s"}`),
        n ? h("button", { class: "btn small", onclick: () => { op.faces = []; this.app.changed({ regen: false }); this.results = null; this.editOp(op); this.highlightOpFaces(op); } }, "Clear") : null)));
      body.append(row("Top height", numField(op.top ?? "", ch("top"), { unit: "mm" }), "Blank = stock top"));
    }
    if (op.type === "drilling") {
      const holes = this.findHoles();
      body.append(
        row("Peck depth", numField(op.peck, ch("peck"), { unit: "mm", step: 0.5 }), "0 = drill in one go"),
        row("Min hole Ø", numField(op.minD, ch("minD"), { unit: "mm", step: 0.5 })),
        row("Max hole Ø", numField(op.maxD, ch("maxD"), { unit: "mm", step: 0.5 })),
        row("Break-through", numField(op.breakThrough, ch("breakThrough"), { unit: "mm", step: 0.5 })),
        h("div", { class: "note" }, holes.length ? `Found ${holes.length} vertical hole(s): ${[...new Set(holes.map((x) => "Ø" + fmt(x.d, 2)))].join(", ")}` : "No vertical holes found in the part."));
    }
    if (op.type === "engrave") {
      const sks = this.flatSketches();
      body.append(
        row("Sketch", selectField(op.sketch || "", [["", sks.length ? "Choose…" : "No flat sketches"], ...sks.map((s) => [s.id, this.app.doc.features.find((f) => f.id === s.id)?.name || s.id])], ch("sketch", false))),
        row("Depth", numField(op.depth, ch("depth"), { unit: "mm", step: 0.1 })),
        row("From stock top", switchField(op.fromStockTop, (v) => { op.fromStockTop = v; this.app.changed({ regen: false }); }), "Otherwise from the sketch plane"));
    }
    body.append(h("div", { style: { display: "flex", gap: "8px", marginTop: "12px" } },
      h("button", { class: "btn", style: { flex: 1 }, onclick: () => { this.pickMode = null; this.openOps(); } }, "All operations"),
      h("button", { class: "btn primary", style: { flex: 1 }, onclick: () => { this.pickMode = null; this.generate(op.id); }, html: icon("cnc") + "Generate" })));
    this.app.openSheet(op.name, body, { iconName: OP_TYPES[op.type].icon, onClose: () => { this.pickMode = null; this.vp.clearHighlights(); } });
  }

  highlightOpFaces(op) {
    this.vp.clearHighlights();
    for (const f of op.faces || []) {
      const b = this.app.result.bodies.find((q) => q.id === f.body);
      if (!b) continue;
      let best = -1, bd = Infinity;
      b.faces.forEach((x, i) => { const d = Math.hypot(x.p[0] - f.sig.p[0], x.p[1] - f.sig.p[1], x.p[2] - f.sig.p[2]); if (d < bd) { bd = d; best = i; } });
      if (best >= 0) this.vp.highlightFace(b.id, best);
    }
  }

  onTap(x, y) {
    if (!this.pickMode) return;
    const op = this.cam.ops.find((o) => o.id === this.pickMode);
    if (!op) return;
    const hit = this.vp.pick(x, y, new Set(["face"]));
    if (!hit || hit.type !== "face") return;
    if (hit.face.type !== "PLANE" || Math.abs(hit.face.n[2]) < 0.999) { toast("Pick a flat, horizontal floor face"); return; }
    op.faces = op.faces || [];
    const ix = op.faces.findIndex((f) => f.body === hit.bodyId && Math.hypot(f.sig.p[0] - hit.sig.p[0], f.sig.p[1] - hit.sig.p[1], f.sig.p[2] - hit.sig.p[2]) < 1e-3);
    if (ix >= 0) op.faces.splice(ix, 1); else op.faces.push({ body: hit.bodyId, sig: hit.sig });
    this.app.changed({ regen: false });
    this.results = null;
    this.editOp(op);
    this.highlightOpFaces(op);
  }

  // ---------- geometry for operations ----------
  faceRegion(f) {
    const b = this.app.result.bodies.find((q) => q.id === f.body);
    if (!b) return null;
    let best = -1, bd = Infinity;
    b.faces.forEach((x, i) => { const d = Math.hypot(x.p[0] - f.sig.p[0], x.p[1] - f.sig.p[1], x.p[2] - f.sig.p[2]); if (d < bd) { bd = d; best = i; } });
    if (best < 0 || bd > 3) return null;
    const [start, count] = b.faceGroups[best];
    const tris = [];
    let z = 0;
    for (let i = start; i < start + count; i += 3) {
      const pts = [0, 1, 2].map((k) => { const vi = b.index[i + k]; z = b.positions[vi * 3 + 2]; return [b.positions[vi * 3], b.positions[vi * 3 + 1]]; });
      const a = (pts[1][0] - pts[0][0]) * (pts[2][1] - pts[0][1]) - (pts[2][0] - pts[0][0]) * (pts[1][1] - pts[0][1]);
      tris.push(P.toPath(a < 0 ? pts.reverse() : pts));
    }
    const u = P.union(tris, [], P.NONZERO);
    return { z, loops: u.map(P.fromPath) };
  }

  findHoles() {
    const holes = [];
    const ids = new Set(this.bodyIds());
    for (const b of this.app.result.bodies) {
      if (!ids.has(b.id) || b.kind === "mesh") continue;
      b.faces.forEach((f, fi) => {
        if (!f.axis || !f.radius) return;
        const d = f.axis.d;
        if (Math.abs(Math.abs(d[2]) - 1) > 1e-4) return;
        const [start, count] = b.faceGroups[fi];
        let zmin = Infinity, zmax = -Infinity, inward = 0;
        for (let i = start; i < start + count; i++) {
          const vi = b.index[i];
          const z = b.positions[vi * 3 + 2];
          if (z < zmin) zmin = z;
          if (z > zmax) zmax = z;
          if (b.normals) {
            const rx = b.positions[vi * 3] - f.axis.o[0], ry = b.positions[vi * 3 + 1] - f.axis.o[1];
            inward += rx * b.normals[vi * 3] + ry * b.normals[vi * 3 + 1] < 0 ? 1 : -1;
          }
        }
        if (inward <= 0) return; // a boss, not a hole
        const key = `${f.axis.o[0].toFixed(3)},${f.axis.o[1].toFixed(3)}`;
        const ex = holes.find((q) => q.key === key);
        if (ex) { ex.ztop = Math.max(ex.ztop, zmax); ex.zbot = Math.min(ex.zbot, zmin); ex.d = Math.min(ex.d, 2 * f.radius); return; }
        holes.push({ key, x: f.axis.o[0], y: f.axis.o[1], ztop: zmax, zbot: zmin, d: 2 * f.radius });
      });
    }
    const pz = this.partBox ? this.partBox.min[2] : 0;
    for (const hh of holes) hh.through = hh.zbot <= pz + 1e-3;
    return holes;
  }

  engraveCurves(sketchId) {
    const s = (this.app.result.sketches || []).find((q) => q.id === sketchId);
    if (!s) return [];
    const pl = s.plane;
    const X = new THREE.Vector3(...pl.x), N = new THREE.Vector3(...pl.n), O = new THREE.Vector3(...pl.o), Y = new THREE.Vector3().crossVectors(N, X);
    const pts = pointMap(s);
    const out = [];
    for (const e of s.entities) {
      if (e.construction || e.type === "point") continue;
      const P2 = sampleEntity(e, pts, 64).map(([u, v]) => { const p = O.clone().addScaledVector(X, u).addScaledVector(Y, v); return [p.x, p.y]; });
      out.push({ z: O.z, pts: P2 });
    }
    return out;
  }

  opsForWorker(onlyId) {
    const c = this.cam;
    return c.ops.map((op) => {
      const tool = c.tools.find((t) => t.id === op.toolId) || c.tools[0];
      const o = { ...op, tool, stepover: (tool.diameter * (op.stepoverPct || 50)) / 100 };
      if (onlyId && op.id !== onlyId) o.disabled = true;
      if (op.type === "pocket") o.regions = (op.faces || []).map((f) => this.faceRegion(f)).filter(Boolean);
      if (op.type === "drilling") o.holes = this.findHoles();
      if (op.type === "engrave") o.curves = this.engraveCurves(op.sketch);
      return o;
    });
  }

  // ---------- generate / display ----------
  async generate(onlyId = null) {
    this.stopSim(true);
    if (!this.cam.ops.length) { toast("Add an operation first"); return; }
    if (!this.tris) { toast("No part selected — check Setup"); return; }
    this.app.setStatus("Generating toolpaths…", "busy");
    const tris = this.tris.slice();
    try {
      const res = await this.worker.call("generate", { tris, stock: this.stock, ops: this.opsForWorker(onlyId), setup: { safeZ: this.cam.safeZ, retractZ: this.cam.retractZ } }, [tris.buffer],
        (p) => this.app.setStatus(`Generating toolpaths… ${Math.round(p * 100)}%`, "busy"));
      if (onlyId && this.results) {
        const r = res.find((q) => q.id === onlyId);
        this.results = this.results.map((q) => (q.id === onlyId ? r : q));
        if (!this.results.some((q) => q.id === onlyId)) this.results.push(r);
      } else this.results = res;
      this.focusOp = onlyId;
      this.drawPaths();
      const errs = res.filter((r) => r.error && (!onlyId || r.id === onlyId));
      const total = this.results.reduce((s, r) => s + (r.stats ? r.stats.time : 0), 0);
      if (errs.length) toast(`${this.cam.ops.find((o) => o.id === errs[0].id)?.name}: ${errs[0].error}`, "err");
      else toast(`Toolpaths ready · estimated ${fmtTime(total)}`);
      this.app.setStatus("");
      this.openOps();
    } catch (e) {
      this.app.setStatus("");
      toast("Toolpath generation failed: " + e.message, "err");
    }
  }

  drawPaths() {
    if (this.pathGroup) { this.group.remove(this.pathGroup); this.pathGroup.traverse((o) => o.geometry && o.geometry.dispose()); }
    this.pathGroup = null;
    if (!this.results) { this.vp.requestRender(); return; }
    const g = new THREE.Group();
    const cut = [], rapid = [], plunge = [];
    for (const r of this.results) {
      if (!r || !r.moves || r.moves.length < 10) continue;
      if (this.focusOp && r.id !== this.focusOp) continue;
      const m = r.moves;
      for (let i = 5; i < m.length; i += 5) {
        const arr = m[i + 3] === 0 ? rapid : m[i + 3] === 2 ? plunge : cut;
        arr.push(m[i - 5], m[i - 4], m[i - 3], m[i], m[i + 1], m[i + 2]);
      }
    }
    const mk = (arr, color, op = 1) => {
      if (!arr.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
      g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: op < 1, opacity: op })));
    };
    mk(cut, 0x2f6fde); mk(plunge, 0xe8a33d); mk(rapid, 0xd43b3b, 0.45);
    this.pathGroup = g;
    this.group.add(g);
    this.vp.requestRender();
  }

  async post() {
    const res = await this.worker.call("post", { ops: this.cam.ops, results: this.results, setup: this.cam, tools: this.cam.tools, wcs: this.wcs, name: this.app.doc.name });
    return res;
  }

  async exportGcode() {
    if (!this.results || this.focusOp) await this.generate();
    if (!this.results) return;
    if (this.results.every((r) => !r.moves || !r.moves.length)) { toast("No toolpaths to export", "err"); return; }
    const g = await this.post();
    const name = (this.app.doc.name || "job").replace(/[^\w\- ]+/g, "_");
    await saveFile(`${name}.nc`, g, "text/plain");
  }

  async showGcode() {
    if (!this.results) await this.generate();
    if (!this.results) return;
    const g = await this.post();
    const lines = g.split("\n");
    modal({ title: `G-code (${lines.length.toLocaleString()} lines)`, body: h("pre", { class: "code" }, lines.slice(0, 400).join("\n") + (lines.length > 400 ? `\n… ${lines.length - 400} more lines` : "")), buttons: [{ label: "Close", value: 0 }] });
  }

  // ---------- simulation ----------
  async simulate() {
    if (this.simActive) { this.stopSim(); return; }
    if (!this.results) await this.generate();
    if (!this.results) return;
    const c = this.cam;
    const moves = [];
    const toolsAt = [];
    for (const op of c.ops) {
      const r = this.results.find((q) => q.id === op.id);
      if (!r || !r.moves || !r.moves.length || op.disabled) continue;
      if (this.focusOp && op.id !== this.focusOp) continue;
      const tool = c.tools.find((t) => t.id === op.toolId) || c.tools[0];
      toolsAt.push({ from: moves.length / 5, tool });
      for (const v of r.moves) moves.push(v);
    }
    if (!moves.length) { toast("No toolpaths to simulate"); return; }
    this.app.closeSheet();
    this.simActive = true;
    this.applyBodyFilter();
    this.renderToolbar();
    const s = this.stock;
    const sx = s.max[0] - s.min[0], sy = s.max[1] - s.min[1];
    const res = Math.max(0.2, Math.max(sx, sy) / 260);
    const nx = Math.ceil(sx / res) + 1, ny = Math.ceil(sy / res) + 1;
    const hm = new Float32Array(nx * ny).fill(s.max[2]);
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(nx * ny * 3);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; pos[k * 3] = s.min[0] + i * res; pos[k * 3 + 1] = s.min[1] + j * res; pos[k * 3 + 2] = s.max[2]; }
    const idx = [];
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c2 = a + nx, d = c2 + 1; idx.push(a, b, d, a, d, c2); }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xc9b48a, roughness: 0.75, metalness: 0.05, side: THREE.DoubleSide }));
    const toolMesh = new THREE.Group();
    this.simGroup = new THREE.Group();
    this.simGroup.add(mesh, toolMesh);
    this.group.add(this.simGroup);
    if (this.pathGroup) this.pathGroup.visible = false;
    this.sim = { moves, toolsAt, hm, nx, ny, res, geo, pos, mesh, toolMesh, i: 1, t: 0, playing: true, speed: 1, toolId: null, frame: 0 };
    this.buildPlayer();
    this.lastT = performance.now();
    this.vp.onFrame = () => this.simStep();
  }

  buildPlayer() {
    const sim = this.sim;
    const n = sim.moves.length / 5;
    const range = h("input", { type: "range", min: 1, max: n - 1, value: 1 });
    const time = h("span", { class: "t" }, "0%");
    const play = ib("pause", "Play/pause", () => { sim.playing = !sim.playing; play.innerHTML = icon(sim.playing ? "pause" : "play"); this.lastT = performance.now(); });
    const speed = h("button", { class: "btn small", onclick: () => { const sp = [1, 4, 16, 64, 256]; sim.speed = sp[(sp.indexOf(sim.speed) + 1) % sp.length]; speed.textContent = `${sim.speed}×`; } }, "1×");
    range.addEventListener("input", () => this.simSeek(+range.value));
    this.player = h("div", { class: "player" }, play, speed, range, time, ib("close", "Stop simulation", () => this.stopSim()));
    this.playerRange = range;
    this.playerTime = time;
    this.app.stage.appendChild(this.player);
  }

  toolFor(i) {
    let t = this.sim.toolsAt[0].tool;
    for (const ta of this.sim.toolsAt) if (ta.from <= i) t = ta.tool;
    return t;
  }

  setToolMesh(tool) {
    const sim = this.sim;
    if (sim.toolId === tool.id) return;
    sim.toolId = tool.id;
    sim.toolMesh.clear();
    const r = tool.diameter / 2, len = Math.max(15, tool.length || 20);
    const mat = new THREE.MeshStandardMaterial({ color: 0xb8c2cc, metalness: 0.8, roughness: 0.3 });
    let tip;
    if (tool.type === "ball") { tip = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 12), mat); tip.position.z = r; }
    else if (tool.type === "vbit" || tool.type === "drill") { const hgt = r / Math.tan(((tool.angle || 90) / 2) * Math.PI / 180); tip = new THREE.Mesh(new THREE.ConeGeometry(r, hgt, 20), mat); tip.rotation.x = -Math.PI / 2; tip.position.z = hgt / 2; }
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 20), mat);
    body.rotation.x = Math.PI / 2;
    body.position.z = len / 2 + (tool.type === "ball" ? r : 0);
    const holder = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.6 + 2, r * 1.6 + 2, 25, 20), new THREE.MeshStandardMaterial({ color: 0x55606c, metalness: 0.6, roughness: 0.4 }));
    holder.rotation.x = Math.PI / 2;
    holder.position.z = len + 12.5;
    sim.toolMesh.add(body, holder);
    if (tip) sim.toolMesh.add(tip);
  }

  stamp(x, y, z, tool) {
    const sim = this.sim, s = this.stock;
    if (z >= s.max[2]) return;
    const r = tool.diameter / 2;
    const cx = (x - s.min[0]) / sim.res, cy = (y - s.min[1]) / sim.res, rr = r / sim.res;
    const i0 = Math.max(0, Math.floor(cx - rr)), i1 = Math.min(sim.nx - 1, Math.ceil(cx + rr));
    const j0 = Math.max(0, Math.floor(cy - rr)), j1 = Math.min(sim.ny - 1, Math.ceil(cy + rr));
    const tanH = Math.tan(((tool.angle || 90) / 2) * Math.PI / 180);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d2 = ((i - cx) ** 2 + (j - cy) ** 2) * sim.res * sim.res;
      if (d2 > r * r) continue;
      let zz = z;
      if (tool.type === "ball") zz = z + r - Math.sqrt(r * r - d2);
      else if (tool.type === "vbit" || tool.type === "drill") zz = z + Math.sqrt(d2) / tanH;
      const k = j * sim.nx + i;
      if (zz < sim.hm[k]) { sim.hm[k] = zz; sim.pos[k * 3 + 2] = Math.max(zz, s.min[2]); sim.dirty = true; }
    }
  }

  cutSegment(i) {
    const m = this.sim.moves;
    const k = i * 5;
    if (m[k + 3] === 0) return; // rapids don't cut
    const x0 = m[k - 5], y0 = m[k - 4], z0 = m[k - 3], x1 = m[k], y1 = m[k + 1], z1 = m[k + 2];
    const tool = this.toolFor(i);
    const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    const n = Math.max(1, Math.ceil(len / (this.sim.res * 0.7)));
    for (let s = 1; s <= n; s++) { const t = s / n; this.stamp(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t, tool); }
  }

  simStep() {
    const sim = this.sim;
    if (!sim) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastT) / 1000);
    this.lastT = now;
    const m = sim.moves, n = m.length / 5;
    if (sim.playing && sim.i < n) {
      // advance by machine time × speed
      let budget = dt * sim.speed;
      let guard = 0;
      while (budget > 0 && sim.i < n && guard++ < 4000) {
        const k = sim.i * 5;
        const len = Math.hypot(m[k] - m[k - 5], m[k + 1] - m[k - 4], m[k + 2] - m[k - 3]);
        const feed = m[k + 3] === 0 ? 5000 : Math.max(50, m[k + 4]);
        const segT = (len / feed) * 60 / 8; // shown 8× faster than real time at 1×
        if (sim.t + budget >= segT) { budget -= segT - sim.t; this.cutSegment(sim.i); sim.i++; sim.t = 0; }
        else { sim.t += budget; budget = 0; }
      }
      if (sim.i >= n) { sim.playing = false; }
    }
    // tool position
    const i = Math.min(sim.i, n - 1), k = i * 5;
    const k0 = Math.max(0, k - 5);
    const segK = sim.i < n ? sim.t : 0;
    const len = Math.hypot(m[k] - m[k0], m[k + 1] - m[k0 + 1], m[k + 2] - m[k0 + 2]);
    const feed = m[k + 3] === 0 ? 5000 : Math.max(50, m[k + 4]);
    const frac = len > 0 ? Math.min(1, segK / ((len / feed) * 60 / 8)) : 1;
    const tool = this.toolFor(i);
    this.setToolMesh(tool);
    sim.toolMesh.position.set(m[k0] + (m[k] - m[k0]) * frac, m[k0 + 1] + (m[k + 1] - m[k0 + 1]) * frac, m[k0 + 2] + (m[k + 2] - m[k0 + 2]) * frac);
    if (sim.dirty) {
      sim.geo.attributes.position.needsUpdate = true;
      if (++sim.frame % 6 === 0 || !sim.playing) sim.geo.computeVertexNormals();
      sim.dirty = false;
    }
    if (this.playerRange && document.activeElement !== this.playerRange) this.playerRange.value = sim.i;
    if (this.playerTime) this.playerTime.textContent = `${Math.round((sim.i / n) * 100)}%`;
  }

  simSeek(target) {
    const sim = this.sim;
    if (target < sim.i) {
      // rebuild from scratch
      sim.hm.fill(this.stock.max[2]);
      for (let k = 0; k < sim.nx * sim.ny; k++) sim.pos[k * 3 + 2] = this.stock.max[2];
      sim.i = 1;
    }
    while (sim.i < target) { this.cutSegment(sim.i); sim.i++; }
    sim.t = 0;
    sim.dirty = true;
    sim.geo.attributes.position.needsUpdate = true;
    sim.geo.computeVertexNormals();
  }

  stopSim(silent) {
    if (!this.simActive) return;
    this.simActive = false;
    this.vp.onFrame = null;
    if (this.simGroup) { this.group.remove(this.simGroup); this.simGroup.traverse((o) => { o.geometry && o.geometry.dispose(); }); }
    this.simGroup = null;
    this.sim = null;
    this.player && this.player.remove();
    if (this.pathGroup) this.pathGroup.visible = true;
    this.applyBodyFilter();
    if (!silent) this.renderToolbar();
    this.vp.requestRender();
  }
}
