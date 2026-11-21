// FDM slicer: mesh → layers → walls, top/bottom skin, infill, supports, skirt/brim/raft → G-code.
import * as P from "../core/poly.js";
import { weld, sliceAt, prepareMesh } from "../core/meshslice.js";

const TYPE = { outer: 0, inner: 1, infill: 2, solid: 3, support: 4, skirt: 5, raft: 6, travel: 7, bridge: 8 };
export const TYPE_NAMES = ["Outer wall", "Inner wall", "Infill", "Top/bottom", "Support", "Skirt/brim", "Raft", "Travel"];

function progress(id, v) { self.postMessage({ id, progress: v }); }

function layerHeights(mesh, st, zmax) {
  const out = [];
  let z = st.firstLayerHeight;
  out.push({ top: z, h: st.firstLayerHeight });
  if (!st.adaptive) {
    while (z + 1e-9 < zmax) { const h = Math.min(st.layerHeight, Math.max(zmax - z, st.layerHeight * 0.3)); z += h; out.push({ top: z, h }); }
    return out;
  }
  // adaptive: thinner layers where surfaces are shallow (but not flat)
  const { v, f } = mesh;
  const n = f.length / 3;
  const bins = new Map();
  const bin = 0.05;
  for (let t = 0; t < n; t++) {
    const i0 = f[t * 3], i1 = f[t * 3 + 1], i2 = f[t * 3 + 2];
    const ax = v[i1 * 3] - v[i0 * 3], ay = v[i1 * 3 + 1] - v[i0 * 3 + 1], az = v[i1 * 3 + 2] - v[i0 * 3 + 2];
    const bx = v[i2 * 3] - v[i0 * 3], by = v[i2 * 3 + 1] - v[i0 * 3 + 1], bz = v[i2 * 3 + 2] - v[i0 * 3 + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz) || 1;
    const s = Math.abs(nz / l);
    if (s > 0.995 || s < 0.05) continue;
    const z0 = Math.min(v[i0 * 3 + 2], v[i1 * 3 + 2], v[i2 * 3 + 2]), z1 = Math.max(v[i0 * 3 + 2], v[i1 * 3 + 2], v[i2 * 3 + 2]);
    for (let b = Math.floor(z0 / bin); b <= Math.floor(z1 / bin); b++) bins.set(b, Math.max(bins.get(b) || 0, s));
  }
  const dev = (st.adaptiveMax - st.adaptiveMin) * 0.35 + st.adaptiveMin * 0.25;
  while (z + 1e-9 < zmax) {
    let s = 0;
    for (let b = Math.floor(z / bin); b <= Math.floor((z + st.adaptiveMax) / bin); b++) s = Math.max(s, bins.get(b) || 0);
    let h = s > 0 ? dev / s : st.adaptiveMax;
    h = Math.max(st.adaptiveMin, Math.min(st.adaptiveMax, h));
    h = Math.round(h / 0.02) * 0.02 || st.adaptiveMin;
    h = Math.min(h, Math.max(zmax - z, st.adaptiveMin));
    z += h;
    out.push({ top: z, h });
  }
  return out;
}

// ---------- path helpers ----------
function loopsOf(paths) { return paths.filter((p) => p.length >= 3).map((p) => P.fromPath(p)); }

function orderLines(lines, start) {
  // nearest-neighbour with direction flipping
  const out = [];
  const left = lines.slice();
  let cur = start || [0, 0];
  while (left.length) {
    let bi = 0, bd = Infinity, flip = false;
    for (let i = 0; i < left.length; i++) {
      const L = left[i];
      const d0 = (L[0][0] - cur[0]) ** 2 + (L[0][1] - cur[1]) ** 2;
      const d1 = (L[L.length - 1][0] - cur[0]) ** 2 + (L[L.length - 1][1] - cur[1]) ** 2;
      if (d0 < bd) { bd = d0; bi = i; flip = false; }
      if (d1 < bd) { bd = d1; bi = i; flip = true; }
    }
    let L = left.splice(bi, 1)[0];
    if (flip) L = L.slice().reverse();
    out.push(L);
    cur = L[L.length - 1];
  }
  return out;
}

function orderLoops(loops, start) {
  const out = [];
  const left = loops.slice();
  let cur = start || [0, 0];
  while (left.length) {
    let bi = 0, bj = 0, bd = Infinity;
    for (let i = 0; i < left.length; i++) {
      const L = left[i];
      for (let j = 0; j < L.length; j += Math.max(1, Math.floor(L.length / 24))) {
        const d = (L[j][0] - cur[0]) ** 2 + (L[j][1] - cur[1]) ** 2;
        if (d < bd) { bd = d; bi = i; bj = j; }
      }
    }
    const L = left.splice(bi, 1)[0];
    const r = [...L.slice(bj), ...L.slice(0, bj)];
    r.push(r[0]);
    out.push(r);
    cur = r[0];
  }
  return out;
}

function infillLines(region, angle, spacing, phase = 0) {
  if (!region.length) return [];
  const b = P.bounds(region);
  const raw = P.hatch(b, angle, spacing, phase);
  return P.clipLines(raw, region).map(P.fromPath).filter((l) => l.length >= 2 && Math.hypot(l[1][0] - l[0][0], l[1][1] - l[0][1]) > 0.05);
}

// ---------- main ----------
function slice(id, tris, st) {
  const t0 = performance.now();
  const mesh = weld(tris);
  const nT = mesh.f.length / 3;
  const zmins = new Float64Array(nT), zmaxs = new Float64Array(nT);
  let zmax = 0;
  for (let t = 0; t < nT; t++) {
    const a = mesh.v[mesh.f[t * 3] * 3 + 2], b = mesh.v[mesh.f[t * 3 + 1] * 3 + 2], c = mesh.v[mesh.f[t * 3 + 2] * 3 + 2];
    zmins[t] = Math.min(a, b, c); zmaxs[t] = Math.max(a, b, c);
    zmax = Math.max(zmax, zmaxs[t]);
  }
  const order = Array.from({ length: nT }, (_, i) => i).sort((a, b) => zmins[a] - zmins[b]);
  const heights = layerHeights(mesh, st, zmax);
  const L = heights.length;
  const w = st.lineWidth;
  // 1. outlines
  const areas = [];
  for (let i = 0; i < L; i++) {
    const zc = heights[i].top - heights[i].h / 2 + 1e-5;
    const loops = sliceAt(mesh, order, zmins, zmaxs, zc);
    let paths = loops.map(P.toPath);
    paths = P.clean(P.union(paths, [], P.NONZERO), 0.003);
    areas.push(paths);
    if (i % 10 === 0) progress(id, 0.05 + (0.3 * i) / L);
  }
  // 2. walls and inner areas
  const layers = [];
  const inner = [];
  for (let i = 0; i < L; i++) {
    const A = areas[i];
    const walls = [];
    for (let k = 0; k < st.walls; k++) {
      const off = P.offset(A, -(w / 2 + k * w));
      if (!off.length) break;
      walls.push({ k, loops: loopsOf(off) });
    }
    inner.push(P.offset(A, -(st.walls * w) + 0.15 * w));
    layers.push({ z: heights[i].top, h: heights[i].h, walls, paths: [] });
    if (i % 10 === 0) progress(id, 0.35 + (0.2 * i) / L);
  }
  // 3. top/bottom skins and infill
  const density = Math.max(0, Math.min(100, st.infill)) / 100;
  for (let i = 0; i < L; i++) {
    const I = inner[i];
    if (!I.length) continue;
    let above = I, below = I;
    for (let k = 1; k <= st.topLayers; k++) above = i + k < L ? P.inter(above, areas[i + k]) : [];
    for (let k = 1; k <= st.bottomLayers; k++) below = i - k >= 0 ? P.inter(below, areas[i - k]) : [];
    const solid = P.union(P.diff(I, above), P.diff(I, below));
    const solidC = P.clean(P.offset(P.offset(solid, -w * 0.3), w * 0.3), 0.01);
    const sparse = P.diff(I, solidC);
    const lay = layers[i];
    const ang = i % 2 ? 135 : 45;
    lay.solid = infillLines(P.inter(solidC, I), ang, w);
    lay.sparse = [];
    if (density > 0.001 && sparse.length) {
      const pat = st.infillPattern;
      if (pat === "lines") lay.sparse = infillLines(sparse, i % 2 ? 135 : 45, w / density);
      else if (pat === "triangles") for (const a of [0, 60, 120]) lay.sparse.push(...infillLines(sparse, a, (3 * w) / density));
      else if (pat === "concentric") {
        let cur = P.offset(sparse, -w / 2);
        let guard = 0;
        while (cur.length && guard++ < 200) { for (const l of loopsOf(cur)) lay.sparse.push([...l, l[0]]); cur = P.offset(cur, -w / density); }
      } else for (const a of [45, 135]) lay.sparse.push(...infillLines(sparse, a, (2 * w) / density));
    }
    if (i % 10 === 0) progress(id, 0.55 + (0.2 * i) / L);
  }
  // 4. supports
  const supports = new Array(L).fill(null).map(() => []);
  if (st.supports) {
    const zGapLayers = Math.max(0, Math.round(st.supportZGap));
    let carry = [];
    const allow = (i) => heights[i].h * Math.tan((st.supportAngle * Math.PI) / 180);
    const pending = new Array(L).fill(null).map(() => []);
    for (let j = 1; j < L; j++) {
      const over = P.diff(areas[j], P.offset(areas[j - 1], allow(j)));
      const big = P.offset(P.offset(over, -w), w);
      if (big.length) { const tgt = j - 1 - zGapLayers; if (tgt >= 0) pending[tgt].push(...big); }
    }
    for (let i = L - 1; i >= 0; i--) {
      carry = P.union(carry, pending[i]);
      carry = P.diff(carry, areas[i]);
      const printable = P.diff(carry, P.offset(areas[i], st.supportGap));
      supports[i] = printable;
    }
    for (let i = 0; i < L; i++) {
      const sp = supports[i];
      if (!sp.length) { layers[i].support = []; continue; }
      const dens = Math.max(0.05, st.supportDensity / 100);
      layers[i].support = infillLines(sp, i === 0 ? 0 : 90, w / dens);
    }
  }
  // 5. adhesion
  const first = P.union(areas[0] || [], supports[0] || []);
  let raft = [];
  let zLift = 0;
  if (st.adhesion === "brim") {
    const loops = [];
    const n = Math.max(1, Math.round(st.brimWidth / w));
    for (let k = n; k >= 1; k--) for (const l of loopsOf(P.offset(areas[0] || [], (k - 0.5) * w))) loops.push(l);
    layers[0].skirt = loops;
  } else if (st.adhesion === "skirt") {
    const loops = [];
    for (let k = 0; k < 2; k++) for (const l of loopsOf(P.offset(first, st.skirtDistance + k * w, "round"))) loops.push(l);
    layers[0].skirt = loops;
  } else if (st.adhesion === "raft") {
    const base = P.offset(first, st.raftMargin, "round");
    const n = Math.max(1, st.raftLayers);
    for (let k = 0; k < n; k++) {
      const h = k === 0 ? 0.3 : 0.2;
      zLift += h;
      const sp = k === 0 ? w * 3 : w * 1.05;
      raft.push({ z: zLift, h, lines: infillLines(base, k % 2 ? 90 : 0, sp), outline: k === 0 ? loopsOf(base) : [] });
    }
    zLift += 0.15; // air gap
  }
  progress(id, 0.8);
  // 6. assemble paths and G-code
  return emit(id, st, layers, raft, zLift, t0);
}

function emit(id, st, layers, raft, zLift, t0) {
  const fil = Math.PI * (st.filament / 2) ** 2;
  const flow = st.flow / 100;
  const g = [];
  const prev = { pos: [], col: [], layerStart: [], layerZ: [] };
  let x = 0, y = 0, z = 0, e = 0, time = 0, filLen = 0, retracted = false;
  const fmt = (n) => (Math.abs(n) < 5e-6 ? "0" : n.toFixed(3).replace(/\.?0+$/, ""));
  const pushSeg = (x0, y0, x1, y1, zz, type) => { prev.pos.push(x0, y0, zz, x1, y1, zz); prev.col.push(type); };
  const ox = st.origin === "center" ? 0 : 0;
  void ox;
  g.push(`; Generated by ForgeCAD slicer`, `; layer height ${st.layerHeight}${st.adaptive ? " (adaptive)" : ""}, ${st.walls} walls, ${st.infill}% ${st.infillPattern}`,
    `; material ${st.material}, nozzle ${st.nozzle} mm, filament ${st.filament} mm`,
    `M140 S${st.bedTemp}`, `M104 S${st.firstLayerNozzleTemp}`, `M190 S${st.bedTemp}`, `M109 S${st.firstLayerNozzleTemp}`,
    ...String(st.startGcode || "").split("\n"), "G21", "G90", "M82", "G92 E0", "M107");
  const travel = (tx, ty, zz) => {
    const d = Math.hypot(tx - x, ty - y);
    if (d < 1e-4) return;
    const needRetract = d > st.retractMinTravel && st.retract > 0;
    if (needRetract && !retracted) { e -= st.retract; g.push(`G1 E${fmt(e)} F${st.retractSpeed * 60}`); retracted = true; time += st.retract / st.retractSpeed; }
    if (needRetract && st.zHop > 0) g.push(`G1 Z${fmt(zz + st.zHop)} F${st.travelSpeed * 60}`);
    g.push(`G0 X${fmt(tx)} Y${fmt(ty)} F${st.travelSpeed * 60}`);
    if (needRetract && st.zHop > 0) g.push(`G1 Z${fmt(zz)} F${st.travelSpeed * 60}`);
    time += d / st.travelSpeed;
    x = tx; y = ty;
  };
  const extrude = (pts, h, wid, speed, type, zz) => {
    if (pts.length < 2) return;
    travel(pts[0][0], pts[0][1], zz);
    if (retracted) { e += st.retract; g.push(`G1 E${fmt(e)} F${st.retractSpeed * 60}`); retracted = false; }
    const k = (wid * h * flow) / fil;
    let first = true;
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = pts[i];
      const d = Math.hypot(px - x, py - y);
      if (d < 1e-4) continue;
      e += d * k;
      filLen += d * k;
      g.push(`G1 X${fmt(px)} Y${fmt(py)} E${fmt(e)}${first ? ` F${Math.round(speed * 60)}` : ""}`);
      first = false;
      pushSeg(x, y, px, py, zz, type);
      time += d / speed;
      x = px; y = py;
    }
  };
  let li = 0;
  // raft
  for (const r of raft) {
    prev.layerStart.push(prev.col.length); prev.layerZ.push(r.z);
    g.push(`;LAYER:${li++} (raft)`, `G1 Z${fmt(r.z)} F600`);
    z = r.z;
    for (const l of orderLoops(r.outline, [x, y])) extrude(l, r.h, st.lineWidth, st.firstLayerSpeed, TYPE.raft, z);
    for (const l of orderLines(r.lines, [x, y])) extrude(l, r.h, st.lineWidth * (r === raft[0] ? 1.5 : 1), st.firstLayerSpeed, TYPE.raft, z);
  }
  const fanS = Math.round((st.fan / 100) * 255);
  layers.forEach((lay, n) => {
    const zz = lay.z + zLift;
    const firstL = n === 0;
    prev.layerStart.push(prev.col.length); prev.layerZ.push(zz);
    const tStart = time;
    const gStart = g.length;
    g.push(`;LAYER:${li++}`, `;Z:${fmt(zz)}`, `G1 Z${fmt(zz)} F600`);
    if (n === 1) g.push(`M104 S${st.nozzleTemp}`);
    if (n === st.fanFirstLayers && fanS > 0) g.push(`M106 S${fanS}`);
    z = zz;
    const spd = (s) => (firstL ? st.firstLayerSpeed : s);
    if (lay.skirt) for (const l of orderLoops(lay.skirt, [x, y])) extrude(l, lay.h, st.lineWidth, spd(st.printSpeed), TYPE.skirt, zz);
    if (lay.support) for (const l of orderLines(lay.support, [x, y])) extrude(l, lay.h, st.lineWidth, spd(st.supportSpeed), TYPE.support, zz);
    // walls: inner first unless outerFirst
    const wallsOrdered = st.outerFirst ? lay.walls : [...lay.walls].reverse();
    for (const wl of wallsOrdered) {
      const type = wl.k === 0 ? TYPE.outer : TYPE.inner;
      for (const l of orderLoops(wl.loops, [x, y])) extrude(l, lay.h, st.lineWidth, spd(wl.k === 0 ? st.outerSpeed : st.printSpeed), type, zz);
    }
    for (const l of orderLines(lay.solid || [], [x, y])) extrude(l, lay.h, st.lineWidth, spd(st.printSpeed), TYPE.solid, zz);
    for (const l of orderLines(lay.sparse || [], [x, y])) extrude(l, lay.h, st.lineWidth, spd(st.infillSpeed), TYPE.infill, zz);
    // minimum layer time: slow the feed rates of this layer down
    const lt = time - tStart;
    if (lt > 0 && lt < st.minLayerTime && !firstL) {
      const f = lt / st.minLayerTime;
      for (let k = gStart; k < g.length; k++) {
        if (g[k].startsWith("G1 X")) g[k] = g[k].replace(/F(\d+)/, (m, v) => "F" + Math.max(300, Math.round(+v * f)));
      }
      time += st.minLayerTime - lt;
    }
    if (n % 20 === 0) progress(id, 0.8 + (0.2 * n) / layers.length);
  });
  if (retracted === false && st.retract > 0) { e -= st.retract; g.push(`G1 E${fmt(e)} F${st.retractSpeed * 60}`); }
  g.push(...String(st.endGcode || "").split("\n"));
  const grams = (filLen * Math.PI * (st.filament / 2) ** 2 / 1000) * st.density;
  const header = [`;FLAVOR:Marlin`, `;TIME:${Math.round(time)}`, `;Filament used: ${(filLen / 1000).toFixed(3)}m`, `;Layer height: ${st.layerHeight}`, `;LAYER_COUNT:${li}`];
  const gcode = header.join("\n") + "\n" + g.join("\n") + "\n";
  const pos = new Float32Array(prev.pos);
  const col = new Uint8Array(prev.col);
  return {
    result: {
      gcode, positions: pos, types: col, layerStart: prev.layerStart, layerZ: prev.layerZ,
      stats: { time, filament: filLen, grams, layers: li, ms: Math.round(performance.now() - t0) },
    },
    transfer: [pos.buffer, col.buffer],
  };
}

// parse G-code for preview (G0/G1 moves with E)
function parseGcode(text) {
  let x = 0, y = 0, z = 0, e = 0, abs = true, absE = true;
  const pos = [], types = [], layerStart = [], layerZ = [];
  let lastZ = -1;
  let curType = TYPE.outer;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith(";TYPE:")) {
      const t = line.slice(6).toUpperCase();
      curType = t.includes("OUTER") ? TYPE.outer : t.includes("INNER") || t.includes("WALL") ? TYPE.inner : t.includes("SKIN") || t.includes("TOP") || t.includes("BOTTOM") ? TYPE.solid : t.includes("SUPPORT") ? TYPE.support : t.includes("SKIRT") || t.includes("BRIM") ? TYPE.skirt : TYPE.infill;
      continue;
    }
    const c = line.split(";")[0];
    if (!c) continue;
    const words = c.split(/\s+/);
    const cmd = words[0].toUpperCase();
    if (cmd === "G90") abs = true; else if (cmd === "G91") abs = false;
    else if (cmd === "M82") absE = true; else if (cmd === "M83") absE = false;
    else if (cmd === "G92") { for (const w of words.slice(1)) if (w[0].toUpperCase() === "E") e = +w.slice(1); }
    else if (cmd === "G0" || cmd === "G1") {
      let nx = x, ny = y, nz = z, ne = e, hasE = false;
      for (const w of words.slice(1)) {
        const k = w[0].toUpperCase(), v = +w.slice(1);
        if (k === "X") nx = abs ? v : x + v; else if (k === "Y") ny = abs ? v : y + v; else if (k === "Z") nz = abs ? v : z + v;
        else if (k === "E") { ne = absE ? v : e + v; hasE = true; }
      }
      if (hasE && ne > e + 1e-6 && (nx !== x || ny !== y)) {
        if (Math.abs(nz - lastZ) > 1e-6) { layerStart.push(types.length); layerZ.push(nz); lastZ = nz; }
        pos.push(x, y, nz, nx, ny, nz); types.push(curType);
      }
      x = nx; y = ny; z = nz; e = ne;
    }
  }
  const p = new Float32Array(pos), t = new Uint8Array(types);
  return { result: { positions: p, types: t, layerStart, layerZ, stats: { layers: layerStart.length } }, transfer: [p.buffer, t.buffer] };
}

self.onmessage = (ev) => {
  const { id, cmd, args } = ev.data;
  try {
    const out = cmd === "slice" ? slice(id, args.tris, args.settings) : cmd === "parse" ? parseGcode(args.text) : null;
    if (!out) throw new Error("Unknown command");
    if (cmd === "slice" && (!out.result.positions.length)) throw new Error("Nothing to print — is the model on the bed?");
    self.postMessage({ id, ok: true, result: out.result }, out.transfer);
  } catch (e) {
    self.postMessage({ id, ok: false, error: e.message || String(e) });
  }
};
