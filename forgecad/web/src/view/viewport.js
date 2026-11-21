// 3D viewport: Z-up scene, touch orbit/pan/zoom, bodies with face/edge picking, section plane,
// measurement labels and on-demand rendering.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

const SEL_COLOR = 0xe8611f, HOVER_COLOR = 0x2f6fde;

export class Viewport {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
    this.renderer.localClippingEnabled = true;
    container.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;
    this.scene = new THREE.Scene();
    this.persp = new THREE.PerspectiveCamera(40, 1, 0.1, 20000);
    this.ortho = new THREE.OrthographicCamera(-100, 100, 100, -100, -20000, 20000);
    for (const c of [this.persp, this.ortho]) c.up.set(0, 0, 1);
    this.camera = this.persp;
    this.persp.position.set(160, -220, 160);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.18;
    this.controls.screenSpacePanning = true;
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
    this.controls.zoomToCursor = true;
    this.controls.addEventListener("change", () => this.requestRender());

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a96a6, 1.6));
    this.key = new THREE.DirectionalLight(0xffffff, 1.6);
    this.key.position.set(0.5, -0.8, 1.2);
    this.camera.add(this.key);
    this.scene.add(this.persp, this.ortho);
    this.persp.add(this.key);

    this.grid = this.makeGrid(200, 10);
    this.scene.add(this.grid);
    this.bodiesGroup = new THREE.Group();
    this.overlay = new THREE.Group();
    this.sketchGroup = new THREE.Group();
    this.helpers = new THREE.Group();
    this.scene.add(this.bodiesGroup, this.sketchGroup, this.overlay, this.helpers);
    this.bodies = new Map();
    this.displayMode = "shaded-edges";
    this.section = null;
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    this.labels = [];
    this.labelLayer = document.createElement("div");
    this.labelLayer.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:4;overflow:hidden";
    container.appendChild(this.labelLayer);
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Line.threshold = 1;
    this.needsRender = true;
    this.anim = null;
    this.setupTriad();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    const loop = () => {
      requestAnimationFrame(loop);
      if (this.anim) this.stepAnim();
      const moved = this.controls.update();
      if (this.needsRender || moved || this.anim || this.onFrame) this.render();
    };
    loop();
  }

  setTheme(dark) {
    this.scene.background = new THREE.Color(dark ? 0x1a2028 : 0xf4f6f9);
    this.dark = dark;
    this.requestRender();
  }

  makeGrid(size, step) {
    const g = new THREE.Group();
    const minor = [], major = [];
    const n = Math.round(size / step);
    for (let i = -n; i <= n; i++) {
      const v = i * step;
      const arr = i % 5 === 0 ? major : minor;
      if (i !== 0) arr.push(-size, v, 0, size, v, 0, v, -size, 0, v, size, 0);
    }
    const mk = (arr, color, op) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
      return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
    };
    g.add(mk(minor, 0x9aa6b4, 0.25), mk(major, 0x8592a2, 0.5));
    const ax = (a, b, color) => mk([...a, ...b], color, 0.9);
    g.add(ax([0, 0, 0], [size, 0, 0], 0xd9534f), ax([0, 0, 0], [0, size, 0], 0x4caf50), ax([0, 0, 0], [0, 0, size * 0.25], 0x3f7fe0));
    g.renderOrder = -1;
    g.userData.size = size;
    return g;
  }

  updateGrid(extent) {
    const want = Math.max(50, Math.pow(10, Math.ceil(Math.log10(Math.max(extent, 1) * 1.5))));
    const size = want / 2 < extent ? want : want / 2;
    if (this.grid.userData.size === size) return;
    this.scene.remove(this.grid);
    this.grid = this.makeGrid(size, size / 20);
    this.scene.add(this.grid);
  }

  setupTriad() {
    this.triadScene = new THREE.Scene();
    this.triadCam = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, -10, 10);
    this.triadCam.up.set(0, 0, 1);
    const mk = (dir, color) => {
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(...dir), new THREE.Vector3(), 1.1, color, 0.32, 0.18);
      this.triadScene.add(arrow);
    };
    mk([1, 0, 0], 0xd9534f); mk([0, 1, 0], 0x4caf50); mk([0, 0, 1], 0x3f7fe0);
    const lbl = (txt, pos, color) => {
      const c = document.createElement("canvas"); c.width = c.height = 64;
      const x = c.getContext("2d"); x.fillStyle = color; x.font = "bold 44px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(txt, 32, 34);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
      s.position.set(...pos); s.scale.set(0.5, 0.5, 0.5); this.triadScene.add(s);
    };
    lbl("X", [1.45, 0, 0], "#d9534f"); lbl("Y", [0, 1.45, 0], "#4caf50"); lbl("Z", [0, 0, 1.45], "#3f7fe0");
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.persp.aspect = w / h;
    this.persp.updateProjectionMatrix();
    this.updateOrtho();
    for (const m of this.lineMats || []) m.resolution.set(w, h);
    this.requestRender();
  }

  updateOrtho() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const d = this.persp.position.distanceTo(this.controls.target);
    const halfH = d * Math.tan((this.persp.fov * Math.PI) / 360);
    if (this.camera !== this.ortho) {
      this.ortho.top = halfH; this.ortho.bottom = -halfH;
      this.ortho.left = (-halfH * w) / h; this.ortho.right = (halfH * w) / h;
      this.ortho.zoom = 1;
    } else {
      const hh = (this.ortho.top - this.ortho.bottom) / 2;
      this.ortho.left = (-hh * w) / h; this.ortho.right = (hh * w) / h;
    }
    this.ortho.updateProjectionMatrix();
  }

  setOrtho(on) {
    const target = this.controls.target.clone();
    if (on && this.camera !== this.ortho) {
      this.updateOrtho();
      this.ortho.position.copy(this.persp.position);
      this.ortho.quaternion.copy(this.persp.quaternion);
      this.camera = this.ortho;
      this.ortho.add(this.key);
    } else if (!on && this.camera !== this.persp) {
      // keep apparent size
      const hh = (this.ortho.top - this.ortho.bottom) / 2 / this.ortho.zoom;
      const d = hh / Math.tan((this.persp.fov * Math.PI) / 360);
      const dir = new THREE.Vector3().subVectors(this.ortho.position, target).normalize();
      this.persp.position.copy(target).addScaledVector(dir, d);
      this.camera = this.persp;
      this.persp.add(this.key);
    }
    this.controls.object = this.camera;
    this.controls.target.copy(target);
    this.controls.update();
    this.requestRender();
  }

  requestRender() { this.needsRender = true; }

  // short tap (no drag, single finger) on the canvas
  onTap(fn) {
    let down = null;
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), n: down && down.active ? 2 : 1, active: true }; });
    c.addEventListener("pointermove", (e) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true; });
    c.addEventListener("pointerup", (e) => {
      const d = down; down = null;
      if (!d || d.moved || d.n > 1 || performance.now() - d.t > 600) return;
      fn(e.clientX, e.clientY);
    });
  }

  render() {
    this.needsRender = false;
    if (this.onFrame) this.onFrame();
    const r = this.renderer;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    r.setScissorTest(false);
    r.setViewport(0, 0, w, h);
    r.render(this.scene, this.camera);
    // axis triad bottom-left
    const s = 84;
    r.autoClear = false;
    r.clearDepth();
    r.setScissorTest(true);
    r.setScissor(4, 4, s, s);
    r.setViewport(4, 4, s, s);
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
    this.triadCam.position.copy(dir.multiplyScalar(4));
    this.triadCam.up.copy(this.camera.up);
    this.triadCam.lookAt(0, 0, 0);
    r.render(this.triadScene, this.triadCam);
    r.setScissorTest(false);
    r.autoClear = true;
    this.updateLabels();
  }

  // ---------- bodies ----------
  setBodies(list, meta) {
    const keep = new Set();
    for (const b of list) {
      keep.add(b.id);
      const m = meta(b.id);
      let entry = this.bodies.get(b.id);
      if (entry) this.disposeBody(entry);
      entry = this.buildBody(b, m);
      this.bodies.set(b.id, entry);
      this.bodiesGroup.add(entry.group);
    }
    for (const [id, e] of this.bodies) if (!keep.has(id)) { this.disposeBody(e); this.bodies.delete(id); }
    this.applyDisplayMode();
    this.requestRender();
  }

  buildBody(b, m) {
    const group = new THREE.Group();
    group.userData.bodyId = b.id;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(b.positions, 3));
    if (b.normals && b.normals.length) geo.setAttribute("normal", new THREE.BufferAttribute(b.normals, 3));
    if (b.index && b.index.length) geo.setIndex(new THREE.BufferAttribute(b.index, 1));
    if (!b.normals || !b.normals.length) geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const color = new THREE.Color(m.color || "#8aa4c8");
    const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.15, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, side: THREE.FrontSide, clippingPlanes: [] });
    const back = new THREE.MeshBasicMaterial({ color: 0xe8611f, side: THREE.BackSide, clippingPlanes: [] });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { bodyId: b.id, kind: "body" };
    const backMesh = new THREE.Mesh(geo, back);
    backMesh.visible = false;
    backMesh.raycast = () => {};
    group.add(mesh, backMesh);
    let edges = null;
    if (b.lines && b.lines.length) {
      const eg = new THREE.BufferGeometry();
      eg.setAttribute("position", new THREE.BufferAttribute(b.lines, 3));
      edges = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x1c2530, transparent: true, opacity: 0.85, clippingPlanes: [] }));
      edges.raycast = () => {};
      group.add(edges);
    } else if (b.kind === "mesh") {
      const eg = new THREE.EdgesGeometry(geo, 30);
      edges = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x1c2530, transparent: true, opacity: 0.5, clippingPlanes: [] }));
      edges.raycast = () => {};
      group.add(edges);
    }
    group.visible = m.visible !== false;
    // face index for each triangle
    let triFace = null;
    if (b.faceGroups && b.faceGroups.length) {
      const nt = (b.index ? b.index.length : b.positions.length / 3) / 3;
      triFace = new Int32Array(nt).fill(-1);
      b.faceGroups.forEach(([start, count], fi) => { for (let t = start / 3; t < (start + count) / 3; t++) triFace[t] = fi; });
    }
    return { id: b.id, data: b, group, mesh, backMesh, edges, triFace, highlights: new THREE.Group() };
  }

  disposeBody(e) {
    this.bodiesGroup.remove(e.group);
    e.group.traverse((o) => { o.geometry && o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
  }

  setBodyVisible(id, vis) { const e = this.bodies.get(id); if (e) { e.group.visible = vis; this.requestRender(); } }
  setBodyColor(id, color) { const e = this.bodies.get(id); if (e) { e.mesh.material.color.set(color); this.requestRender(); } }

  setDisplayMode(mode) { this.displayMode = mode; this.applyDisplayMode(); }
  applyDisplayMode() {
    for (const e of this.bodies.values()) {
      const m = this.displayMode;
      e.mesh.visible = m !== "wireframe";
      e.mesh.material.transparent = m === "xray";
      e.mesh.material.opacity = m === "xray" ? 0.35 : 1;
      e.mesh.material.depthWrite = m !== "xray";
      if (e.edges) e.edges.visible = m !== "shaded";
      e.backMesh.visible = !!this.section && m !== "wireframe";
      e.mesh.material.needsUpdate = true;
    }
    this.requestRender();
  }

  // ---------- section ----------
  setSection(sec) {
    // sec: null | {axis:'x'|'y'|'z', offset, flip}
    this.section = sec;
    const planes = [];
    if (sec) {
      const n = new THREE.Vector3(sec.axis === "x" ? 1 : 0, sec.axis === "y" ? 1 : 0, sec.axis === "z" ? 1 : 0);
      if (!sec.flip) n.negate();
      this.clipPlane.set(n, sec.flip ? -sec.offset : sec.offset);
      planes.push(this.clipPlane);
    }
    for (const e of this.bodies.values()) {
      for (const m of [e.mesh.material, e.backMesh.material, e.edges && e.edges.material]) if (m) { m.clippingPlanes = planes; m.needsUpdate = true; }
    }
    this.applyDisplayMode();
  }

  // ---------- views ----------
  bbox(ids) {
    const box = new THREE.Box3();
    for (const e of this.bodies.values()) {
      if (ids && !ids.includes(e.id)) continue;
      if (!e.group.visible) continue;
      box.expandByObject(e.mesh);
    }
    for (const o of [this.sketchGroup, this.overlay]) if (o.children.length) box.expandByObject(o);
    if (box.isEmpty()) box.set(new THREE.Vector3(-50, -50, 0), new THREE.Vector3(50, 50, 30));
    return box;
  }

  fit(animate = true, box = null) {
    box = box || this.bbox();
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 5);
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
    const d = this.fitDistance(r);
    this.animateTo(c.clone().addScaledVector(dir, d), c, r, animate);
  }

  setView(name, animate = true) {
    const dirs = {
      top: [0, -0.0001, 1], bottom: [0, 0.0001, -1], front: [0, -1, 0], back: [0, 1, 0], right: [1, 0, 0], left: [-1, 0, 0], iso: [1, -1.2, 0.9], isoBack: [-1, 1.2, 0.9],
    };
    const box = this.bbox();
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 5);
    const d = this.fitDistance(r);
    const dir = new THREE.Vector3(...dirs[name]).normalize();
    this.animateTo(c.clone().addScaledVector(dir, d), c, r, animate);
  }

  // look straight at a plane {o, x, n}
  lookAtPlane(pl, size = 100) {
    const n = new THREE.Vector3(...pl.n), o = new THREE.Vector3(...pl.o);
    const d = size / Math.sin((this.persp.fov * Math.PI) / 360);
    const up = new THREE.Vector3().crossVectors(n, new THREE.Vector3(...pl.x)).normalize();
    this.animateTo(o.clone().addScaledVector(n, d), o, size, true, up);
  }

  animateTo(pos, target, radius, animate, up = null) {
    const cam = this.camera;
    const from = { pos: cam.position.clone(), target: this.controls.target.clone(), up: cam.up.clone(), zoom: this.ortho.zoom };
    const to = { pos, target, up: up || new THREE.Vector3(0, 0, 1) };
    if (cam === this.ortho) {
      const hh = (this.ortho.top - this.ortho.bottom) / 2;
      to.zoom = Math.min(hh, hh * this.persp.aspect) / (radius * 1.08);
    }
    if (!animate) { this.anim = { from, to, t0: performance.now() - 1000, dur: 1 }; this.stepAnim(); return; }
    this.anim = { from, to, t0: performance.now(), dur: 320 };
  }

  stepAnim() {
    const a = this.anim;
    let t = Math.min(1, (performance.now() - a.t0) / a.dur);
    const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const cam = this.camera;
    // move along a sphere around the target so the view doesn't cut through the part
    const target = a.from.target.clone().lerp(a.to.target, k);
    const d0 = a.from.pos.clone().sub(a.from.target), d1 = a.to.pos.clone().sub(a.to.target);
    const len = THREE.MathUtils.lerp(d0.length(), d1.length(), k);
    const dir = d0.normalize().lerp(d1.normalize(), k);
    if (dir.lengthSq() < 1e-8) dir.copy(d1);
    cam.position.copy(target).addScaledVector(dir.normalize(), len);
    cam.up.copy(a.from.up.clone().lerp(a.to.up, k).normalize());
    if (a.to.zoom !== undefined) { this.ortho.zoom = THREE.MathUtils.lerp(a.from.zoom, a.to.zoom, k); this.ortho.updateProjectionMatrix(); }
    this.controls.target.copy(target);
    cam.lookAt(target);
    if (t >= 1) { this.anim = null; cam.up.copy(a.to.up); this.controls.update(); }
    this.requestRender();
  }

  // ---------- picking ----------
  ndc(x, y) {
    const r = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  }
  toScreen(v) {
    const r = this.canvas.getBoundingClientRect();
    const p = v.clone().project(this.camera);
    return { x: ((p.x + 1) / 2) * r.width, y: ((1 - p.y) / 2) * r.height, z: p.z };
  }

  // filter: Set of 'face','edge','body','region','sketch'
  pick(clientX, clientY, filter = new Set(["face", "body"])) {
    const ndc = this.ndc(clientX, clientY);
    this.raycaster.setFromCamera(ndc, this.camera);
    const targets = [];
    for (const e of this.bodies.values()) if (e.group.visible && e.mesh.visible) targets.push(e.mesh);
    if (filter.has("region")) this.sketchGroup.traverse((o) => { if (o.userData.kind === "region") targets.push(o); });
    let hits = this.raycaster.intersectObjects(targets, false);
    if (this.section) hits = hits.filter((h) => this.clipPlane.distanceToPoint(h.point) >= -1e-6);
    // regions first when requested
    if (filter.has("region")) {
      const rh = hits.find((h) => h.object.userData.kind === "region");
      if (rh) return { type: "region", sketchId: rh.object.userData.sketchId, regionIndex: rh.object.userData.regionIndex, point: rh.point, sample: rh.object.userData.sample };
    }
    const faceHit = hits.find((h) => h.object.userData.kind === "body");
    const r = this.canvas.getBoundingClientRect();
    const px = clientX - r.left, py = clientY - r.top;
    if (filter.has("edge")) {
      const tol = 18;
      let best = null;
      const faceDepth = faceHit ? faceHit.distance : Infinity;
      for (const e of this.bodies.values()) {
        if (!e.group.visible || !e.data.lines || !e.data.edgeGroups.length) continue;
        const L = e.data.lines;
        e.data.edgeGroups.forEach(([start, count], ei) => {
          for (let i = start; i < start + count - 1; i += 2) {
            const a = new THREE.Vector3(L[i * 3], L[i * 3 + 1], L[i * 3 + 2]);
            const b = new THREE.Vector3(L[(i + 1) * 3], L[(i + 1) * 3 + 1], L[(i + 1) * 3 + 2]);
            const sa = this.toScreen(a), sb = this.toScreen(b);
            const d = segDist(px, py, sa.x, sa.y, sb.x, sb.y);
            if (d < tol && (!best || d < best.d)) {
              // occlusion test: edge must not be well behind the face under the cursor
              const t = segT(px, py, sa.x, sa.y, sb.x, sb.y);
              const p = a.clone().lerp(b, t);
              const dist = p.distanceTo(this.raycaster.ray.origin);
              if (dist <= faceDepth + Math.max(1, faceDepth * 0.02)) best = { d, bodyId: e.id, index: ei, point: p };
            }
          }
        });
      }
      if (best && (!faceHit || best.d < tol * 0.75 || !filter.has("face"))) return { type: "edge", bodyId: best.bodyId, index: best.index, point: best.point, sig: e2sig(this.bodies.get(best.bodyId).data.edges[best.index]) };
    }
    if (faceHit) {
      const e = this.bodies.get(faceHit.object.userData.bodyId);
      if (filter.has("face") && e.triFace) {
        const fi = e.triFace[faceHit.faceIndex];
        if (fi >= 0) {
          const f = e.data.faces[fi];
          return { type: "face", bodyId: e.id, index: fi, point: faceHit.point, normal: faceHit.face ? faceHit.face.normal.clone() : null, sig: f2sig(f), face: f };
        }
      }
      if (filter.has("body") || filter.has("face")) return { type: "body", bodyId: e.id, point: faceHit.point };
    }
    return null;
  }

  // ---------- highlights ----------
  clearHighlights() {
    this.overlay.clear();
    this.requestRender();
  }

  highlightFace(bodyId, faceIndex, color = SEL_COLOR) {
    const e = this.bodies.get(bodyId);
    if (!e || !e.data.faceGroups[faceIndex]) return;
    const [start, count] = e.data.faceGroups[faceIndex];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", e.mesh.geometry.getAttribute("position"));
    if (e.mesh.geometry.getAttribute("normal")) geo.setAttribute("normal", e.mesh.geometry.getAttribute("normal"));
    geo.setIndex(new THREE.BufferAttribute(e.data.index.slice(start, start + count), 1));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthTest: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, clippingPlanes: this.section ? [this.clipPlane] : [] }));
    m.raycast = () => {};
    this.overlay.add(m);
    this.requestRender();
  }

  highlightEdge(bodyId, edgeIndex, color = SEL_COLOR) {
    const e = this.bodies.get(bodyId);
    if (!e || !e.data.edgeGroups[edgeIndex]) return;
    const [start, count] = e.data.edgeGroups[edgeIndex];
    const arr = e.data.lines.slice(start * 3, (start + count) * 3);
    this.addFatLines(arr, color, 4);
  }

  highlightBody(bodyId, color = SEL_COLOR) {
    const e = this.bodies.get(bodyId);
    if (!e) return;
    const m = new THREE.Mesh(e.mesh.geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthTest: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    m.raycast = () => {};
    this.overlay.add(m);
    this.requestRender();
  }

  addFatLines(arr, color, width = 3, group = this.overlay, opts = {}) {
    const g = new LineSegmentsGeometry();
    g.setPositions(arr);
    const mat = new LineMaterial({ color, linewidth: width, depthTest: opts.depthTest !== false, transparent: true, opacity: opts.opacity ?? 1, dashed: !!opts.dashed, dashSize: 2, gapSize: 1.5 });
    mat.resolution.set(this.container.clientWidth, this.container.clientHeight);
    this.lineMats = this.lineMats || new Set();
    this.lineMats.add(mat);
    const l = new LineSegments2(g, mat);
    if (opts.dashed) l.computeLineDistances();
    l.raycast = () => {};
    l.renderOrder = opts.renderOrder ?? 2;
    group.add(l);
    this.requestRender();
    return l;
  }

  addMarker(p, color = SEL_COLOR, size = null, group = this.overlay) {
    const s = size || this.pixelSize(p) * 6;
    const m = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 8), new THREE.MeshBasicMaterial({ color, depthTest: false }));
    m.position.copy(p);
    m.renderOrder = 5;
    group.add(m);
    this.requestRender();
    return m;
  }

  // camera distance that fits a sphere of radius r, for both vertical and horizontal field of view
  fitDistance(r) {
    const vf = (this.persp.fov * Math.PI) / 360;
    const hf = Math.atan(Math.tan(vf) * this.persp.aspect);
    return r / Math.sin(Math.min(vf, hf)) * 1.08;
  }

  pixelSize(p) {
    if (this.camera === this.ortho) return (this.ortho.top - this.ortho.bottom) / this.ortho.zoom / this.container.clientHeight;
    const d = this.camera.position.distanceTo(p);
    return (2 * d * Math.tan((this.persp.fov * Math.PI) / 360)) / this.container.clientHeight;
  }

  // ---------- labels ----------
  addLabel(pos, text, cls = "") {
    const el = document.createElement("div");
    el.className = "vlabel " + cls;
    el.style.cssText = "position:absolute;transform:translate(-50%,-50%);background:rgba(29,39,51,.9);color:#fff;font-size:12px;padding:3px 7px;border-radius:8px;white-space:nowrap";
    el.textContent = text;
    this.labelLayer.appendChild(el);
    const l = { pos: pos.clone(), el };
    this.labels.push(l);
    this.requestRender();
    return l;
  }
  clearLabels() { for (const l of this.labels) l.el.remove(); this.labels = []; }
  updateLabels() {
    for (const l of this.labels) {
      const s = this.toScreen(l.pos);
      l.el.style.left = s.x + "px";
      l.el.style.top = s.y + "px";
      l.el.style.display = s.z > 1 ? "none" : "block";
    }
  }

  thumbnail(w = 320, h = 240) {
    this.render();
    const src = this.canvas;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    const s = Math.max(w / src.width, h / src.height);
    x.drawImage(src, (w - src.width * s) / 2, (h - src.height * s) / 2, src.width * s, src.height * s);
    return c.toDataURL("image/jpeg", 0.75);
  }
}

function segT(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  return l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
}
function segDist(px, py, ax, ay, bx, by) {
  const t = segT(px, py, ax, ay, bx, by);
  return Math.hypot(px - (ax + (bx - ax) * t), py - (ay + (by - ay) * t));
}
function e2sig(e) { return { p: e.p, d: e.d, type: e.type }; }
function f2sig(f) { return { p: f.p, n: f.n, type: f.type }; }

export { THREE };
