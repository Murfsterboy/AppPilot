// Application shell: home screen, project lifecycle, undo/redo, regeneration and workspaces.
import { WorkerRPC } from "./core/rpc.js";
import { newDoc, migrate, History, bodyMeta, uid, BODY_COLORS } from "./core/doc.js";
import { resolveParams } from "./core/expr.js";
import * as store from "./core/storage.js";
import { saveFile, pickFile, f32ToBase64, base64ToF32, isAndroid } from "./core/files.js";
import { h, ib, toast, modal, confirmBox, promptBox, popMenu, row, selectField, switchField, fmt } from "./ui/dom.js";
import { icon } from "./ui/icons.js";
import { Viewport } from "./view/viewport.js";
import { DesignWS } from "./design.js";
import { PrintWS } from "./print/print-ui.js";
import { CamWS } from "./cam/cam-ui.js";
import { parseSTL, writeSTL, parseOBJ, writeOBJ } from "./io/mesh-formats.js";
import { parseDXF, parseSVG, sketchToDXF, sketchToSVG } from "./io/sketch-formats.js";
import { SAMPLES } from "./core/samples.js";
import { STD_PLANES } from "./core/planes.js";

export class App {
  constructor(root) {
    this.root = root;
    this.kernel = new WorkerRPC("kernel-worker.js");
    this.history = new History();
    this.doc = null;
    this.projectId = null;
    this.result = { bodies: [], errors: {}, sketches: [] };
    this.settings = { theme: "auto", quality: "med", autosave: true };
  }

  async start() {
    const msg = document.getElementById("bootMsg");
    try {
      this.settings = { ...this.settings, ...(await store.getMeta("settings", {})) };
    } catch (_) {}
    this.applyTheme();
    store.requestPersistence();
    msg.textContent = "Loading the geometry kernel…";
    try {
      await this.kernel.call("init");
    } catch (e) {
      msg.textContent = "Couldn't start the geometry kernel: " + e.message;
      return;
    }
    this.buildShell();
    document.getElementById("boot").classList.add("gone");
    const last = await store.getMeta("lastProject", null).catch(() => null);
    await this.showHome();
    if (window.__pendingOpen) this.handleIncomingFile(window.__pendingOpen);
    window.forgeOpenFile = (name, b64) => this.handleIncomingFile({ name, b64 });
    window.addEventListener("keydown", (e) => this.onKey(e));
    window.forgeBack = () => this.onBack();
    void last;
  }

  applyTheme() {
    const t = this.settings.theme;
    if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    const dark = t === "dark" || (t === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    this.dark = dark;
    if (this.viewport) this.viewport.setTheme(dark);
  }

  async saveSettings() { await store.setMeta("settings", this.settings); }

  // ---------- shell ----------
  buildShell() {
    this.titleEl = h("div", { class: "title" }, h("b", {}, "ForgeCAD"), h("small", {}, ""));
    this.undoBtn = ib("undo", "Undo", () => this.undo());
    this.redoBtn = ib("redo", "Redo", () => this.redo());
    this.menuBtn = ib("menu", "Menu", () => this.openMenu());
    this.moreBtn = ib("more", "More", (e) => this.openMore(e.currentTarget));
    this.topExtra = h("div", { style: { display: "flex" } });
    this.topbar = h("div", { class: "topbar" }, this.menuBtn, this.titleEl, this.topExtra, this.undoBtn, this.redoBtn, this.moreBtn);
    this.tabsEl = h("div", { class: "tabs" });
    for (const [id, label, ic] of [["design", "Design", "design"], ["print", "3D Print", "print"], ["cnc", "CNC", "cnc"]]) {
      this.tabsEl.appendChild(h("button", { class: "tab", "data-ws": id, html: icon(ic) + label, onclick: () => this.setWorkspace(id) }));
    }
    this.stage = h("div", { class: "stage" });
    this.statusEl = h("div", { class: "status" });
    this.hintEl = h("div", { class: "hint" });
    this.stage.append(this.statusEl, this.hintEl);
    this.toolbar = h("div", { class: "toolbar" });
    this.sheet = h("div", { class: "sheet" });
    this.scrim = h("div", { class: "scrim", onclick: () => this.closeDrawers() });
    this.drawer = h("div", { class: "drawer" });
    this.rdrawer = h("div", { class: "drawer right" });
    this.stage.append(this.sheet);
    this.root.append(this.topbar, this.tabsEl, this.stage, this.toolbar, this.scrim, this.drawer, this.rdrawer);
    this.viewport = new Viewport(this.stage);
    this.viewport.setTheme(this.dark);
    this.design = new DesignWS(this);
    this.print = new PrintWS(this);
    this.cam = new CamWS(this);
    this.ws = null;
  }

  setTitle() {
    if (!this.doc) return;
    this.titleEl.querySelector("b").textContent = this.doc.name;
    const n = this.result.bodies.length;
    const err = Object.keys(this.result.errors || {}).length;
    this.titleEl.querySelector("small").textContent = `${n} bod${n === 1 ? "y" : "ies"} · ${this.doc.features.length} features${err ? ` · ${err} error${err > 1 ? "s" : ""}` : ""}`;
  }

  setHint(text) { this.hintEl.textContent = text || ""; this.hintEl.classList.toggle("show", !!text); }
  setStatus(text, kind = "") {
    this.statusEl.className = "status" + (text ? " show" : "") + (kind ? " " + kind : "");
    this.statusEl.innerHTML = kind === "busy" ? `<span class="spin"></span>${text}` : text || "";
  }

  updateUndo() {
    if (this.ws === "design" && this.design.sketcher.active) {
      this.undoBtn.disabled = !this.design.sketcher.history.length;
      this.redoBtn.disabled = !this.design.sketcher.future.length;
      return;
    }
    this.undoBtn.disabled = !this.history.canUndo;
    this.redoBtn.disabled = !this.history.canRedo;
  }

  setWorkspace(ws) {
    if (this.ws === ws) return;
    if (this.ws === "design" && this.design.sketcher.active) { toast("Finish the sketch first"); return; }
    if (this.ws === "design" && this.design.panel) this.design.cancelPanel();
    const prev = this.ws;
    if (prev === "design") this.design.leave();
    if (prev === "print") this.print.leave();
    if (prev === "cnc") this.cam.leave();
    this.ws = ws;
    this.tabsEl.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.ws === ws));
    this.closeSheet();
    this.setHint("");
    if (ws === "design") this.design.enter();
    if (ws === "print") this.print.enter();
    if (ws === "cnc") this.cam.enter();
    this.updateUndo();
  }

  // ---------- sheet & drawers ----------
  openSheet(title, body, { iconName, actions = [], onClose, minimizable = true } = {}) {
    this.sheet.innerHTML = "";
    const head = h("div", { class: "sheet-head" }, h("div", { class: "grab" }), h("h3", { html: (iconName ? icon(iconName) : "") + `<span>${title}</span>` }));
    for (const a of actions) head.appendChild(a);
    if (minimizable) head.appendChild(ib("chevronDown", "Minimise", (e) => { this.sheet.classList.toggle("min"); e.currentTarget.innerHTML = icon(this.sheet.classList.contains("min") ? "chevronUp" : "chevronDown"); }));
    this.sheet.append(head, h("div", { class: "sheet-body" }, body));
    this.sheet.classList.remove("min");
    this.sheet.classList.add("open");
    this.sheetOnClose = onClose;
  }
  closeSheet() {
    this.sheet.classList.remove("open");
    const f = this.sheetOnClose;
    this.sheetOnClose = null;
    f && f();
  }
  openDrawer(title, body, right = false) {
    const d = right ? this.rdrawer : this.drawer;
    d.innerHTML = "";
    d.append(h("div", { class: "drawer-head" }, h("h3", {}, title), ib("close", "Close", () => this.closeDrawers())), h("div", { class: "drawer-body" }, body));
    d.classList.add("open");
    this.scrim.classList.add("show");
  }
  closeDrawers() { this.drawer.classList.remove("open"); this.rdrawer.classList.remove("open"); this.scrim.classList.remove("show"); }

  onBack() {
    if (document.querySelector(".modal-wrap")) { document.querySelector(".modal-wrap").remove(); return true; }
    if (document.querySelector(".pop")) { document.querySelector(".pop").remove(); return true; }
    if (this.drawer.classList.contains("open") || this.rdrawer.classList.contains("open")) { this.closeDrawers(); return true; }
    if (this.ws === "design" && this.design.onBack()) return true;
    if (this.sheet.classList.contains("open")) { this.closeSheet(); return true; }
    if (this.ws && this.ws !== "design") { this.setWorkspace("design"); return true; }
    if (this.homeEl && this.homeEl.isConnected) return false;
    this.showHome();
    return true;
  }

  onKey(e) {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); this.redo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); this.saveNow(true); }
    else if (e.key === "Escape") this.onBack();
    else if (this.ws === "design") this.design.onKey(e);
  }

  // ---------- home ----------
  async showHome() {
    if (this.doc) await this.saveNow();
    this.homeEl && this.homeEl.remove();
    const list = await store.listProjects().catch(() => []);
    const grid = h("div", { class: "proj-grid" });
    for (const p of list) {
      const card = h("div", { class: "proj", onclick: () => this.openProject(p.id) },
        h("div", { class: "thumb" }, p.thumb ? h("img", { src: p.thumb, alt: "" }) : h("span", { html: icon("cube") })),
        h("div", { class: "meta" }, h("b", {}, p.name), h("small", {}, new Date(p.updated).toLocaleString())));
      const more = ib("more", "Project options", (e) => {
        e.stopPropagation();
        popMenu(e.currentTarget, [
          { label: "Rename", icon: "edit", action: async () => { const n = await promptBox("Rename project", p.name); if (n) { const rec = await store.loadProject(p.id); rec.name = n; rec.doc.name = n; await store.saveProject(rec); this.showHome(); } } },
          { label: "Duplicate", icon: "copy", action: async () => { const rec = await store.loadProject(p.id); rec.id = uid("prj"); rec.name += " copy"; rec.doc.name = rec.name; await store.saveProject(rec); this.showHome(); } },
          { label: "Export project file", icon: "export", action: async () => { const rec = await store.loadProject(p.id); await saveFile(`${rec.name}.forgecad`, JSON.stringify(rec.doc), "application/json"); } },
          "-",
          { label: "Delete", icon: "trash", action: async () => { if (await confirmBox("Delete project?", `"${p.name}" will be removed from this device.`, "Delete", true)) { await store.deleteProject(p.id); this.showHome(); } } },
        ]);
      });
      card.appendChild(more);
      grid.appendChild(card);
    }
    const actions = h("div", { class: "home-actions" },
      h("button", { class: "big-action", onclick: () => this.newProjectPrompt(), html: icon("plus") + "New design<small>Start from a blank part</small>" }),
      h("button", { class: "big-action", onclick: () => this.importFiles(true), html: icon("folder") + "Open file<small>STEP, STL, OBJ, DXF, SVG, project</small>" }),
      h("button", { class: "big-action", onclick: () => this.showSamples(), html: icon("gear") + "Examples<small>Brackets, gears, enclosures</small>" }),
      h("button", { class: "big-action", onclick: () => this.showHelp(), html: icon("help") + "Quick guide<small>How to use ForgeCAD</small>" }));
    this.homeEl = h("div", { class: "home" },
      h("div", { class: "home-head" }, h("img", { src: "icon.svg", alt: "" }), h("h1", {}, "ForgeCAD", h("small", {}, "Design · Machine · Print — offline")), ib("settings", "Settings", () => this.openSettings())),
      h("div", { class: "home-body" }, actions, h("div", { class: "h2" }, list.length ? "Your projects" : "No projects yet"), grid,
        list.length ? null : h("div", { class: "empty", html: icon("cube") + "Your designs are stored only on this device. Tap <b>New design</b> or open an <b>Example</b> to begin." })));
    this.root.appendChild(this.homeEl);
  }

  async newProjectPrompt() {
    const n = await promptBox("New design", "Part " + (new Date().toLocaleDateString()), { label: "Name" });
    if (n === undefined) return;
    this.loadDoc(newDoc(n || "Untitled"), uid("prj"));
    this.saveNow();
  }

  async showSamples() {
    const body = h("div", {});
    for (const s of SAMPLES) {
      body.appendChild(h("button", { class: "menu-item", onclick: () => { document.querySelector(".modal-wrap").remove(); this.loadDoc(migrate(s.build()), uid("prj")); this.saveNow(); }, html: icon(s.icon) + `<span><b>${s.name}</b><br><small style="color:var(--muted)">${s.desc}</small></span>` }));
    }
    modal({ title: "Examples", body, buttons: [{ label: "Close", value: null }] });
  }

  async openProject(id) {
    const rec = await store.loadProject(id);
    if (!rec) { toast("Project not found", "err"); return; }
    this.loadDoc(migrate(rec.doc), rec.id);
  }

  loadDoc(doc, id) {
    this.doc = doc;
    this.projectId = id;
    this.history.clear();
    this.homeEl && this.homeEl.remove();
    this.homeEl = null;
    this.result = { bodies: [], errors: {}, sketches: [] };
    this.ws = null;
    this.setWorkspace("design");
    this.design.resetForDoc();
    this.setTitle();
    this.regen(true);
    store.setMeta("lastProject", id).catch(() => {});
  }

  // ---------- doc changes ----------
  // call before mutating doc
  checkpoint() { this.history.push(this.doc); this.updateUndo(); }
  // call after mutating doc
  changed({ regen = true, fit = false } = {}) {
    this.doc.updated = Date.now();
    if (regen) this.regen(fit);
    this.scheduleSave();
    this.updateUndo();
    this.setTitle();
  }

  undo() {
    if (this.ws === "design" && this.design.sketcher.active) { this.design.sketcher.undo(); this.updateUndo(); return; }
    if (this.ws === "design" && this.design.panel) this.design.cancelPanel();
    const d = this.history.undo(this.doc);
    if (d) { this.doc = d; this.changed(); this.design.refreshTree(); this.onDocReplaced(); }
  }
  redo() {
    if (this.ws === "design" && this.design.sketcher.active) { this.design.sketcher.redo(); this.updateUndo(); return; }
    const d = this.history.redo(this.doc);
    if (d) { this.doc = d; this.changed(); this.design.refreshTree(); this.onDocReplaced(); }
  }
  onDocReplaced() { if (this.ws === "print") this.print.refresh(); if (this.ws === "cnc") this.cam.refresh(); }

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), 1500);
  }

  async saveNow(announce = false) {
    if (!this.doc || !this.projectId) return;
    clearTimeout(this.saveTimer);
    let thumb = this.lastThumb;
    try { if (this.ws === "design" && !this.design.sketcher.active && this.result.bodies.length) thumb = this.lastThumb = this.viewport.thumbnail(); } catch (_) {}
    try {
      await store.saveProject({ id: this.projectId, name: this.doc.name, doc: this.doc, thumb });
      if (announce) toast("Saved on this device");
    } catch (e) { toast("Couldn't save: " + e.message, "err"); }
  }

  params() { return resolveParams(this.doc.params).values; }

  // ---------- regeneration ----------
  regen(fit = false, docOverride = null) {
    this.regenWanted = { fit, doc: docOverride };
    if (this.regenBusy) return this.regenPromise;
    this.regenPromise = this.runRegen();
    return this.regenPromise;
  }

  async runRegen() {
    this.regenBusy = true;
    const slow = setTimeout(() => this.setStatus("Rebuilding…", "busy"), 250);
    try {
      while (this.regenWanted) {
        const { fit, doc } = this.regenWanted;
        this.regenWanted = null;
        const d = doc || this.doc;
        const res = await this.kernel.call("regenerate", { doc: d, quality: this.settings.quality });
        if (this.regenWanted) continue; // superseded
        this.result = res;
        this.applyResult(fit);
      }
    } catch (e) {
      toast("Rebuild failed: " + e.message, "err");
      if (/crash|abort|memory/i.test(e.message)) { this.kernel.restart(); await this.kernel.call("init"); }
    } finally {
      clearTimeout(slow);
      this.regenBusy = false;
      const errs = Object.keys(this.result.errors || {});
      if (errs.length) {
        const f = this.doc.features.find((x) => x.id === errs[0]);
        this.setStatus(`⚠ ${f ? f.name + ": " : ""}${this.result.errors[errs[0]]}`, "err");
      } else this.setStatus("");
    }
  }

  applyResult(fit) {
    const doc = this.doc;
    let i = Object.keys(doc.bodies).length;
    for (const b of this.result.bodies) {
      if (!doc.bodies[b.id]) {
        const f = doc.features.find((x) => x.id === b.id || x.id + "" === this.result.createdBy?.[b.id]);
        doc.bodies[b.id] = { name: (f && f.type === "import" && f.name) || `Body ${i + 1}`, color: BODY_COLORS[i % BODY_COLORS.length], visible: true };
        i++;
      }
    }
    this.viewport.setBodies(this.result.bodies, (id) => doc.bodies[id] || { color: "#8aa4c8" });
    this.viewport.updateGrid(this.modelExtent());
    if (this.ws === "design") this.design.onResult(fit);
    if (this.ws === "print") this.print.onModelChanged();
    if (this.ws === "cnc") this.cam.onModelChanged();
    this.setTitle();
  }

  modelExtent() {
    let m = 50;
    for (const b of this.result.bodies) { const bb = b.bbox; m = Math.max(m, ...bb[0].map(Math.abs), ...bb[1].map(Math.abs)); }
    return m;
  }

  // ---------- menus ----------
  openMenu() {
    const items = [
      ["home", "All projects", () => this.showHome()],
      ["plus", "New design", () => this.newProjectPrompt()],
      ["save", "Save now", () => this.saveNow(true)],
      ["edit", "Rename project", async () => { const n = await promptBox("Rename", this.doc.name); if (n) { this.doc.name = n; this.changed({ regen: false }); } }],
      "-",
      ["import", "Import file…", () => this.importFiles(false)],
      ["export", "Export…", () => this.exportMenu()],
      "-",
      ["params", "Parameters", () => this.design.openParams()],
      ["settings", "Settings", () => this.openSettings()],
      ["help", "Quick guide", () => this.showHelp()],
    ];
    const body = h("div", {});
    for (const it of items) {
      if (it === "-") { body.appendChild(h("div", { class: "menu-sep" })); continue; }
      body.appendChild(h("button", { class: "menu-item", onclick: () => { this.closeDrawers(); it[2](); }, html: icon(it[0]) + `<span>${it[1]}</span>` }));
    }
    this.openDrawer(this.doc ? this.doc.name : "ForgeCAD", body);
  }

  openMore(anchor) {
    if (this.ws === "design") return this.design.openMore(anchor);
    if (this.ws === "print") return this.print.openMore(anchor);
    if (this.ws === "cnc") return this.cam.openMore(anchor);
  }

  async openSettings() {
    const s = this.settings;
    const body = h("div", {},
      row("Theme", selectField(s.theme, [["auto", "Follow system"], ["light", "Light"], ["dark", "Dark"]], (v) => { s.theme = v; this.applyTheme(); this.saveSettings(); })),
      row("Display quality", selectField(s.quality, [["low", "Fast"], ["med", "Balanced"], ["high", "Smooth"]], (v) => { s.quality = v; this.saveSettings(); if (this.doc) this.regen(); }), "Smoother curves take longer to show"),
      h("div", { class: "note" }, "ForgeCAD works fully offline. Projects are saved on this device only — export a project file to back up or move a design."),
      h("div", { class: "note" }, "Built with OpenCascade (LGPL), replicad, three.js and Clipper. Licences are included in the app."));
    modal({ title: "Settings", body, buttons: [{ label: "Done", primary: true, value: true }] });
  }

  showHelp() {
    const sec = (t, ...lines) => h("div", {}, h("div", { class: "group-title" }, t), ...lines.map((l) => h("div", { class: "note", style: { color: "var(--text)" }, html: l })));
    const body = h("div", {},
      sec("Moving around", "<b>1 finger</b> orbit · <b>2 fingers</b> pan &amp; pinch-zoom · view buttons on the right for Top/Front/Right/Iso and fit."),
      sec("Making a part", "1. <b>Sketch</b> → pick a plane (or tap a flat face).", "2. Draw with Line, Rectangle, Circle… Endpoints snap together; overlapping shapes still make closed areas.", "3. Add <b>Dimensions</b> (tap a line or circle) and constraints (select items, then tap a suggestion).", "4. ✓ to finish, then <b>Extrude</b> or <b>Revolve</b>.", "5. Round edges with <b>Fillet</b>, add <b>Holes</b>, <b>Shell</b> to hollow out."),
      sec("Parametric", "Every step is kept in the history (☰ browser). Tap a step to edit it later — everything after it rebuilds. Use <b>Parameters</b> for named values like <i>width</i> and type them into any field (e.g. <i>width/2+3</i>)."),
      sec("3D printing", "Open the <b>3D Print</b> tab, pick a printer and material, then <b>Slice</b>. Scrub the layer slider to inspect, then <b>Export G-code</b>."),
      sec("CNC", "In <b>CNC</b> set up the stock, add operations (facing, pocket, contour, adaptive, drilling, engraving, 3D roughing/finishing), check the simulation and export G-code."),
      sec("Files", "Import STEP/STP, STL, OBJ, DXF and SVG. Export STEP, STL, OBJ, DXF, SVG and G-code. Everything stays on your device."));
    modal({ title: "Quick guide", body, buttons: [{ label: "Got it", primary: true, value: true }] });
  }

  // ---------- import / export ----------
  async importFiles(fromHome) {
    const files = await pickFile(".step,.stp,.stl,.obj,.dxf,.svg,.forgecad,.json,.gcode,.nc,.gc,*/*", true);
    for (const f of files) await this.importFile(f.name, await f.arrayBuffer(), fromHome);
  }

  async handleIncomingFile({ name, b64 }) {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    await this.importFile(name, u8.buffer, !this.doc || !!this.homeEl);
  }

  async importFile(name, buf, newProject) {
    const ext = (name.split(".").pop() || "").toLowerCase();
    const base = name.replace(/\.[^.]+$/, "");
    try {
      if (ext === "forgecad" || ext === "json") {
        const doc = migrate(JSON.parse(new TextDecoder().decode(buf)));
        if (doc.format !== "forgecad") throw new Error("Not a ForgeCAD project");
        this.loadDoc(doc, uid("prj"));
        this.saveNow();
        toast("Project opened");
        return;
      }
      if (ext === "gcode" || ext === "nc" || ext === "gc") {
        if (!this.doc) this.loadDoc(newDoc(base), uid("prj"));
        this.setWorkspace("print");
        this.print.showGcode(new TextDecoder().decode(buf), name);
        return;
      }
      if (newProject || !this.doc) { this.loadDoc(newDoc(base), uid("prj")); }
      this.checkpoint();
      if (ext === "step" || ext === "stp") {
        this.setStatus("Reading STEP…", "busy");
        const parts = await this.kernel.call("importSTEP", { bytes: buf }, [buf]);
        parts.forEach((brep, i) => this.doc.features.push({ id: uid("f"), type: "import", name: parts.length > 1 ? `${base} ${i + 1}` : base, brep }));
        toast(`Imported ${parts.length} solid${parts.length > 1 ? "s" : ""}`);
      } else if (ext === "stl" || ext === "obj") {
        const tris = ext === "stl" ? parseSTL(buf) : parseOBJ(new TextDecoder().decode(buf));
        this.doc.features.push({ id: uid("f"), type: "mesh", name: base, positions: f32ToBase64(tris) });
        toast(`Imported mesh (${Math.round(tris.length / 9).toLocaleString()} triangles)`);
      } else if (ext === "dxf" || ext === "svg") {
        const geo = ext === "dxf" ? parseDXF(new TextDecoder().decode(buf)) : await parseSVG(new TextDecoder().decode(buf));
        geo.points.unshift({ id: "O", x: 0, y: 0, keep: true });
        geo.constraints.push({ id: uid("k"), type: "fix", a: "O", x: 0, y: 0, hidden: true });
        this.doc.features.push({ id: uid("f"), type: "sketch", name: base, plane: { ...STD_PLANES.XY }, planeRef: "XY", ...geo });
        toast("Imported as a sketch on the XY plane — extrude it to make a solid");
      } else {
        throw new Error("Unsupported file type: ." + ext);
      }
      this.changed({ fit: true });
      this.design.refreshTree();
    } catch (e) {
      this.setStatus("");
      toast("Import failed: " + e.message, "err");
    }
  }

  visibleBodyIds() { return this.result.bodies.filter((b) => this.doc.bodies[b.id]?.visible !== false).map((b) => b.id); }

  async exportMenu() {
    const bodies = this.result.bodies;
    const sketches = this.doc.features.filter((f) => f.type === "sketch");
    let fmtSel = "stl", which = "visible", sketchId = sketches[0]?.id || "";
    const sketchRow = row("Sketch", selectField(sketchId, sketches.map((s) => [s.id, s.name]), (v) => (sketchId = v)));
    const bodyRow = row("Bodies", selectField(which, [["visible", "Visible bodies"], ["all", "All bodies"], ...bodies.map((b) => [b.id, this.doc.bodies[b.id]?.name || b.id])], (v) => (which = v)));
    const upd = () => { const sk = fmtSel === "dxf" || fmtSel === "svg"; sketchRow.style.display = sk ? "" : "none"; bodyRow.style.display = sk || fmtSel === "forgecad" ? "none" : ""; };
    const body = h("div", {},
      row("Format", selectField(fmtSel, [["stl", "STL (3D printing)"], ["step", "STEP (CAD exchange)"], ["obj", "OBJ (mesh)"], ["dxf", "DXF (sketch, laser/CNC)"], ["svg", "SVG (sketch)"], ["forgecad", "ForgeCAD project (backup)"]], (v) => { fmtSel = v; upd(); })),
      bodyRow, sketchRow);
    upd();
    const ok = await modal({ title: "Export", body, buttons: [{ label: "Cancel", value: false }, { label: "Export", primary: true, value: true }] });
    if (!ok) return;
    const ids = which === "visible" ? this.visibleBodyIds() : which === "all" ? null : [which];
    const name = this.doc.name.replace(/[^\w\- ]+/g, "_");
    try {
      if (fmtSel === "stl" || fmtSel === "obj") {
        const tris = await this.kernel.call("exportSTL", { ids, quality: this.settings.quality });
        if (!tris.length) throw new Error("Nothing to export");
        if (fmtSel === "stl") await saveFile(`${name}.stl`, writeSTL(tris, name), "model/stl");
        else await saveFile(`${name}.obj`, writeOBJ(tris, name), "model/obj");
      } else if (fmtSel === "step") {
        const buf = await this.kernel.call("exportSTEP", { ids });
        await saveFile(`${name}.step`, buf, "application/step");
      } else if (fmtSel === "dxf" || fmtSel === "svg") {
        const sk = this.result.sketches.find((s) => s.id === sketchId) || sketches.find((s) => s.id === sketchId);
        if (!sk) throw new Error("Choose a sketch");
        if (fmtSel === "dxf") await saveFile(`${name}.dxf`, sketchToDXF(sk), "image/vnd.dxf");
        else await saveFile(`${name}.svg`, sketchToSVG(sk), "image/svg+xml");
      } else if (fmtSel === "forgecad") {
        await saveFile(`${name}.forgecad`, JSON.stringify(this.doc), "application/json");
      }
      if (!isAndroid()) toast("Exported");
    } catch (e) { toast("Export failed: " + e.message, "err"); }
  }

  async meshForBodies(ids) {
    return this.kernel.call("exportSTL", { ids, quality: "med" });
  }
}

export { base64ToF32, bodyMeta };
