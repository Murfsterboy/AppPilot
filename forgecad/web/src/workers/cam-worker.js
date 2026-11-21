// CAM: generates CNC toolpaths from the part mesh and setup, and posts them to G-code.
// Moves are flat arrays: [x, y, z, kind, feed] with kind 0 = rapid, 1 = cut, 2 = plunge/ramp.
import * as P from "../core/poly.js";
import { prepareMesh } from "../core/meshslice.js";

const RAPID = 0, CUT = 1, PLUNGE = 2;

class Path {
  constructor(safeZ, retractZ) { this.m = []; this.safeZ = safeZ; this.retractZ = retractZ; this.cur = null; }
  push(x, y, z, k, f) { this.m.push(x, y, z, k, f); this.cur = [x, y, z]; }
  rapidTo(x, y, z) { this.push(x, y, z, RAPID, 0); }
  // go to (x,y) at safe height then plunge to z
  enter(x, y, z, plungeF, clearZ) {
    const c = this.cur;
    const top = clearZ ?? this.safeZ;
    if (!c) { this.rapidTo(x, y, this.safeZ); }
    else if (Math.hypot(c[0] - x, c[1] - y) > 1e-6) {
      if (c[2] < top) this.rapidTo(c[0], c[1], top);
      this.rapidTo(x, y, top);
    }
    const r = Math.max(z, Math.min(this.retractZ, top));
    if (this.cur[2] > r + 1e-6) this.rapidTo(x, y, r);
    this.push(x, y, z, PLUNGE, plungeF);
  }
  cut(x, y, z, f) { this.push(x, y, z, CUT, f); }
  retract() { if (this.cur) this.rapidTo(this.cur[0], this.cur[1], this.safeZ); }
}

// ---------- geometry helpers ----------
function partOutline(pm, z0, z1, n = 12) {
  // union of sections between z0 and z1 → silhouette from above (approx)
  let acc = [];
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n + (i === 0 ? 1e-4 : i === n ? -1e-4 : 0);
    const loops = pm.slice(z);
    if (loops.length) acc = P.union(acc, loops.map(P.toPath));
  }
  return P.clean(acc, 0.005);
}

// material at or above z (cannot be cut from the top without undercutting)
function shadowAbove(pm, z, cache) {
  const key = z.toFixed(4);
  if (cache.has(key)) return cache.get(key);
  const out = partOutline(pm, Math.max(z, pm.zmin), pm.zmax, Math.max(4, Math.ceil((pm.zmax - z) / 1.5)));
  cache.set(key, out);
  return out;
}

function stockRect(st) {
  return [P.toPath([[st.min[0], st.min[1]], [st.max[0], st.min[1]], [st.max[0], st.max[1]], [st.min[0], st.max[1]]])];
}

function levels(top, bottom, step) {
  const out = [];
  if (step <= 0) step = top - bottom;
  let z = top;
  while (z - step > bottom + 1e-6) { z -= step; out.push(z); }
  out.push(bottom);
  return out;
}

function loopsOf(paths) { return paths.filter((p) => p.length >= 3).map((p) => { const l = P.fromPath(p); l.push(l[0]); return l; }); }

// climb (CCW for outer boundaries when cutting outside) ordering helper
function orient(loop, ccw) {
  let a = 0;
  for (let i = 0; i + 1 < loop.length; i++) a += loop[i][0] * loop[i + 1][1] - loop[i + 1][0] * loop[i][1];
  if ((a > 0) !== ccw) return loop.slice().reverse();
  return loop;
}

function nearestStart(loop, cur) {
  if (!cur) return loop;
  let bi = 0, bd = Infinity;
  for (let i = 0; i < loop.length - 1; i++) { const d = (loop[i][0] - cur[0]) ** 2 + (loop[i][1] - cur[1]) ** 2; if (d < bd) { bd = d; bi = i; } }
  const body = loop.slice(0, -1);
  const r = [...body.slice(bi), ...body.slice(0, bi)];
  r.push(r[0]);
  return r;
}

// contour-parallel offsets: list of rings from outside in
function offsetRings(region, firstOff, step) {
  const rings = [];
  let cur = P.offset(region, -firstOff, "round");
  let guard = 0;
  while (cur.length && guard++ < 2000) {
    rings.push(cur);
    cur = P.offset(cur, -step, "round");
  }
  return rings;
}

// cut a set of rings innermost-first with ramp entry
function cutRings(path, rings, z, op, climb) {
  const order = rings.slice().reverse();
  let first = true;
  for (const ring of order) {
    for (let loop of loopsOf(ring)) {
      loop = orient(loop, !climb);
      loop = nearestStart(loop, path.cur);
      const [sx, sy] = loop[0];
      const near = path.cur && path.cur[2] <= z + 1e-6 && Math.hypot(path.cur[0] - sx, path.cur[1] - sy) < op.stepover * 1.6;
      if (near && !first) path.cut(sx, sy, z, op.feed);
      else rampEnter(path, loop, z, op);
      for (let i = 1; i < loop.length; i++) path.cut(loop[i][0], loop[i][1], z, op.feed);
      first = false;
    }
  }
}

// ramp down along the start of the loop instead of plunging straight in
function rampEnter(path, loop, z, op) {
  const [sx, sy] = loop[0];
  const startZ = Math.min(op.levelTop + 0.5, path.safeZ);
  path.enter(sx, sy, startZ, op.plunge, op.clearZ);
  const drop = startZ - z;
  if (drop <= 0.01 || !op.ramp) { path.push(sx, sy, z, PLUNGE, op.plunge); return; }
  // ramp angle ~ 3°: horizontal length = drop / tan(3°), go along loop, possibly several laps
  const len = drop / Math.tan((op.rampAngle * Math.PI) / 180);
  const ring = loop.slice(0, -1);
  const n = ring.length;
  let zz = startZ, i = 0, guard = 0;
  let px = sx, py = sy;
  while (zz > z + 1e-6 && guard++ < 20000 && n > 1) {
    i = (i + 1) % n;
    const [nx, ny] = ring[i];
    const d = Math.hypot(nx - px, ny - py);
    zz = Math.max(z, zz - (d / len) * drop);
    path.push(nx, ny, zz, PLUNGE, op.plunge);
    px = nx; py = ny;
  }
  if (n <= 1) path.push(sx, sy, z, PLUNGE, op.plunge);
  // return to loop start at depth
  path.cut(sx, sy, z, op.feed);
}

function zigzag(path, region, angle, step, z, op) {
  const raw = P.hatch(P.bounds(region), angle, step);
  const lines = P.clipLines(raw, region).map(P.fromPath).filter((l) => l.length >= 2);
  // sort by perpendicular offset then alternate
  const a = (angle * Math.PI) / 180;
  const nx = -Math.sin(a), ny = Math.cos(a);
  lines.sort((p, q) => (p[0][0] * nx + p[0][1] * ny) - (q[0][0] * nx + q[0][1] * ny));
  let flip = false;
  for (let L of lines) {
    if (flip) L = L.slice().reverse();
    flip = !flip;
    const [sx, sy] = L[0];
    const c = path.cur;
    if (c && c[2] <= z + 1e-6 && Math.hypot(c[0] - sx, c[1] - sy) < step * 1.8) path.cut(sx, sy, z, op.feed);
    else path.enter(sx, sy, z, op.plunge, op.clearZ);
    for (let i = 1; i < L.length; i++) path.cut(L[i][0], L[i][1], z, op.feed);
  }
}

// ---------- heightmap for 3D ops & simulation ----------
function heightmap(tris, x0, y0, x1, y1, res, floorZ) {
  const nx = Math.max(2, Math.ceil((x1 - x0) / res) + 1), ny = Math.max(2, Math.ceil((y1 - y0) / res) + 1);
  const hm = new Float32Array(nx * ny).fill(floorZ);
  for (let i = 0; i < tris.length; i += 9) {
    const ax = tris[i], ay = tris[i + 1], az = tris[i + 2], bx = tris[i + 3], by = tris[i + 4], bz = tris[i + 5], cx = tris[i + 6], cy = tris[i + 7], cz = tris[i + 8];
    const minX = Math.max(0, Math.floor((Math.min(ax, bx, cx) - x0) / res)), maxX = Math.min(nx - 1, Math.ceil((Math.max(ax, bx, cx) - x0) / res));
    const minY = Math.max(0, Math.floor((Math.min(ay, by, cy) - y0) / res)), maxY = Math.min(ny - 1, Math.ceil((Math.max(ay, by, cy) - y0) / res));
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-12) {
      // vertical triangle: mark its edges
      for (const [px, py, pz] of [[ax, ay, az], [bx, by, bz], [cx, cy, cz]]) {
        const gx = Math.round((px - x0) / res), gy = Math.round((py - y0) / res);
        if (gx >= 0 && gy >= 0 && gx < nx && gy < ny && pz > hm[gy * nx + gx]) hm[gy * nx + gx] = pz;
      }
      continue;
    }
    for (let gy = minY; gy <= maxY; gy++) {
      const py = y0 + gy * res;
      for (let gx = minX; gx <= maxX; gx++) {
        const px = x0 + gx * res;
        const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den;
        const l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        const z = l1 * az + l2 * bz + l3 * cz;
        const k = gy * nx + gx;
        if (z > hm[k]) hm[k] = z;
      }
    }
  }
  return { hm, nx, ny, x0, y0, res };
}

// lowest safe tool-tip height at (x,y) for a flat or ball cutter (drop cutter on the heightmap)
function dropCutter(H, x, y, r, ball) {
  const { hm, nx, ny, x0, y0, res } = H;
  const cx = (x - x0) / res, cy = (y - y0) / res;
  const rr = r / res;
  let best = -Infinity;
  const gx0 = Math.max(0, Math.floor(cx - rr)), gx1 = Math.min(nx - 1, Math.ceil(cx + rr));
  const gy0 = Math.max(0, Math.floor(cy - rr)), gy1 = Math.min(ny - 1, Math.ceil(cy + rr));
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const d2 = ((gx - cx) ** 2 + (gy - cy) ** 2) * res * res;
      if (d2 > r * r) continue;
      let z = hm[gy * nx + gx];
      if (ball) z -= r - Math.sqrt(r * r - d2);
      if (z > best) best = z;
    }
  }
  return best;
}

// ---------- operations ----------
function opFacing(path, ctx, op) {
  const st = ctx.stock;
  const r = op.tool.diameter / 2;
  const region = P.offset(stockRect(st), r * 0.9);
  const bottom = op.depthTo !== undefined && op.depthTo !== null ? op.depthTo : ctx.pm.zmax;
  for (const z of levels(st.max[2], bottom, op.stepdown)) {
    op.levelTop = z + op.stepdown;
    zigzag(path, region, op.angle || 0, op.stepover, z, op);
  }
}

function opPocket(path, ctx, op) {
  const r = op.tool.diameter / 2;
  if (!op.regions || !op.regions.length) throw new Error("Tap the floor face(s) of the pocket in the 3D view");
  for (const reg of op.regions) {
    const region = P.union(reg.loops.map(P.toPath), [], P.EVENODD);
    const top = op.top !== undefined && op.top !== null ? op.top : ctx.stock.max[2];
    const bottom = reg.z + (op.stockToLeaveZ || 0);
    for (const z of levels(top, bottom, op.stepdown)) {
      op.levelTop = Math.min(top, z + op.stepdown);
      const rings = offsetRings(region, r + (op.stockToLeave || 0), op.stepover);
      if (!rings.length) throw new Error("The tool is too big for this pocket");
      cutRings(path, rings, z, op, op.climb !== false);
    }
    path.retract();
  }
}

function opContour(path, ctx, op) {
  const r = op.tool.diameter / 2;
  const pm = ctx.pm;
  const outline = partOutline(pm, pm.zmin, pm.zmax);
  if (!outline.length) throw new Error("No part found in the setup");
  const side = op.side || "outside";
  let loops = side === "outside" ? P.offset(outline, r + (op.stockToLeave || 0), "round") : side === "inside" ? P.offset(outline, -(r + (op.stockToLeave || 0)), "round") : outline;
  if (side === "outside") {
    // only the outer boundary of each island
    loops = loops.filter((p) => P.orientation(p));
  }
  const top = ctx.stock.max[2];
  const bottom = op.depthTo !== undefined && op.depthTo !== null ? op.depthTo : ctx.stock.min[2] - (op.breakThrough || 0.3);
  const tabs = op.tabs && side !== "inside" ? Math.max(0, op.tabCount || 4) : 0;
  const tabTop = bottom + (op.tabHeight || 2);
  const tabW = (op.tabWidth || 6) + op.tool.diameter;
  for (const z of levels(top, bottom, op.stepdown)) {
    op.levelTop = z + op.stepdown;
    for (let loop of loopsOf(loops)) {
      loop = orient(loop, op.climb !== false ? side !== "inside" : side === "inside");
      loop = nearestStart(loop, path.cur);
      // lead-in: short arc/line from outside the cut
      const [sx, sy] = loop[0];
      const [nx2, ny2] = loop[1];
      const tx = nx2 - sx, ty = ny2 - sy, tl = Math.hypot(tx, ty) || 1;
      const lead = op.leadIn ? Math.min(op.leadIn, op.tool.diameter) : 0;
      const outward = side === "inside" ? 1 : -1;
      const lx = sx - (tx / tl) * lead + (-ty / tl) * lead * outward * (side === "inside" ? -1 : 1);
      const ly = sy - (ty / tl) * lead + (tx / tl) * lead * outward * (side === "inside" ? -1 : 1);
      if (lead > 0) { path.enter(lx, ly, z, op.plunge, op.clearZ); path.cut(sx, sy, z, op.feed); }
      else path.enter(sx, sy, z, op.plunge, op.clearZ);
      // tab positions (by arc length) on the final passes
      let total = 0;
      for (let i = 1; i < loop.length; i++) total += Math.hypot(loop[i][0] - loop[i - 1][0], loop[i][1] - loop[i - 1][1]);
      const useTabs = tabs > 0 && z < tabTop - 1e-6;
      const tabCenters = useTabs ? Array.from({ length: tabs }, (_, k) => ((k + 0.5) * total) / tabs) : [];
      const inTab = (s) => tabCenters.some((c) => Math.abs(s - c) < tabW / 2);
      let s = 0;
      for (let i = 1; i < loop.length; i++) {
        const [ax, ay] = loop[i - 1], [bx, by] = loop[i];
        const segL = Math.hypot(bx - ax, by - ay);
        if (!useTabs) { path.cut(bx, by, z, op.feed); s += segL; continue; }
        const n = Math.max(1, Math.ceil(segL / 0.5));
        for (let k = 1; k <= n; k++) {
          const t = k / n;
          const px = ax + (bx - ax) * t, py = ay + (by - ay) * t;
          const zz = inTab(s + segL * t) ? Math.max(z, tabTop) : z;
          path.cut(px, py, zz, op.feed);
        }
        s += segL;
      }
      if (lead > 0) path.cut(sx + (tx / tl) * lead * 0.5, sy + (ty / tl) * lead * 0.5, z, op.feed);
    }
  }
  path.retract();
}

function clearLevelRegion(ctx, z, r, leave) {
  const shadow = shadowAbove(ctx.pm, z, ctx.shadowCache);
  const keep = P.offset(shadow, r + leave, "round");
  const stock = P.offset(stockRect(ctx.stock), r * 0.95);
  return { region: P.diff(stock, keep), keep };
}

function opAdaptive(path, ctx, op) {
  const r = op.tool.diameter / 2;
  const leave = op.stockToLeave ?? 0.3;
  const bottom = op.depthTo !== undefined && op.depthTo !== null ? op.depthTo : Math.max(ctx.pm.zmin, ctx.stock.min[2]);
  for (const z of levels(ctx.stock.max[2], bottom, op.stepdown)) {
    op.levelTop = z + op.stepdown;
    const { region } = clearLevelRegion(ctx, z, r, leave);
    if (!region.length) continue;
    // clear each separate area with constant-stepover rings (outside → in for open areas, ramped)
    for (const ex of P.polyTree(region)) {
      const area = [ex.outer, ...ex.holes];
      const rings = offsetRings(area, 0, op.stepover);
      cutRings(path, rings, z, op, op.climb !== false);
      path.retract();
    }
  }
}

function opRoughing(path, ctx, op) {
  const r = op.tool.diameter / 2;
  const leave = op.stockToLeave ?? 0.5;
  const bottom = op.depthTo !== undefined && op.depthTo !== null ? op.depthTo : Math.max(ctx.pm.zmin, ctx.stock.min[2]);
  for (const z of levels(ctx.stock.max[2], bottom, op.stepdown)) {
    op.levelTop = z + op.stepdown;
    const { region, keep } = clearLevelRegion(ctx, z, r, leave);
    if (!region.length) continue;
    const inner = P.offset(region, -0.05);
    zigzag(path, inner, op.angle || 0, op.stepover, z, op);
    // clean-up pass around the part
    for (let loop of loopsOf(keep)) {
      loop = orient(loop, op.climb !== false);
      loop = nearestStart(loop, path.cur);
      path.enter(loop[0][0], loop[0][1], z, op.plunge, op.clearZ);
      for (let i = 1; i < loop.length; i++) path.cut(loop[i][0], loop[i][1], z, op.feed);
    }
    path.retract();
  }
}

function opFinishing(path, ctx, op) {
  const r = op.tool.diameter / 2;
  const ball = op.tool.type === "ball";
  const st = ctx.stock;
  const res = Math.max(0.1, Math.min(op.stepover / 2, 0.5));
  const H = ctx.heightmap(res, st.min[2]);
  const style = op.style || "raster";
  if (style === "waterline") {
    // contour around the part at constant z steps
    for (const z of levels(st.max[2], Math.max(ctx.pm.zmin, st.min[2]), op.stepdown || 1)) {
      const keep = P.offset(shadowAbove(ctx.pm, z, ctx.shadowCache), r + (op.stockToLeave || 0), "round");
      for (let loop of loopsOf(keep)) {
        loop = orient(loop, op.climb !== false);
        loop = nearestStart(loop, path.cur);
        path.enter(loop[0][0], loop[0][1], z, op.plunge, op.clearZ);
        for (let i = 1; i < loop.length; i++) path.cut(loop[i][0], loop[i][1], z, op.feed);
      }
      path.retract();
    }
    return;
  }
  const ang = ((op.angle || 0) * Math.PI) / 180;
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const cx = (st.min[0] + st.max[0]) / 2, cy = (st.min[1] + st.max[1]) / 2;
  const R = Math.hypot(st.max[0] - st.min[0], st.max[1] - st.min[1]) / 2;
  const floor = op.depthTo !== undefined && op.depthTo !== null ? op.depthTo : st.min[2];
  let flip = false;
  const inStock = (x, y) => x >= st.min[0] - r && x <= st.max[0] + r && y >= st.min[1] - r && y <= st.max[1] + r;
  for (let t = -R; t <= R; t += op.stepover) {
    const pts = [];
    for (let u = -R; u <= R; u += res) {
      const x = cx + nx * t + dx * u, y = cy + ny * t + dy * u;
      if (!inStock(x, y)) continue;
      const z = Math.max(floor, dropCutter(H, x, y, r, ball) + (op.stockToLeave || 0));
      pts.push([x, y, z]);
    }
    if (pts.length < 2) continue;
    if (flip) pts.reverse();
    flip = !flip;
    // drop collinear points
    const simp = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = simp[simp.length - 1], b = pts[i], c = pts[i + 1];
      if (Math.abs((b[2] - a[2]) * Math.hypot(c[0] - a[0], c[1] - a[1]) - (c[2] - a[2]) * Math.hypot(b[0] - a[0], b[1] - a[1])) > 0.002) simp.push(b);
    }
    simp.push(pts[pts.length - 1]);
    const c = path.cur;
    if (c && Math.hypot(c[0] - simp[0][0], c[1] - simp[0][1]) < op.stepover * 1.8) path.cut(simp[0][0], simp[0][1], simp[0][2], op.feed);
    else path.enter(simp[0][0], simp[0][1], simp[0][2], op.plunge, op.clearZ);
    for (let i = 1; i < simp.length; i++) path.cut(simp[i][0], simp[i][1], simp[i][2], op.feed);
  }
  path.retract();
}

function opDrilling(path, ctx, op) {
  const holes = (op.holes || []).filter((hh) => !op.minD || hh.d >= op.minD - 1e-6).filter((hh) => !op.maxD || hh.d <= op.maxD + 1e-6);
  if (!holes.length) throw new Error("No matching holes. Holes must be vertical cylinders; adjust the diameter range.");
  // nearest-neighbour order
  const left = holes.slice();
  let cur = [ctx.stock.min[0], ctx.stock.min[1]];
  while (left.length) {
    let bi = 0, bd = Infinity;
    left.forEach((hh, i) => { const d = (hh.x - cur[0]) ** 2 + (hh.y - cur[1]) ** 2; if (d < bd) { bd = d; bi = i; } });
    const hh = left.splice(bi, 1)[0];
    cur = [hh.x, hh.y];
    const top = hh.ztop;
    let bottom = hh.zbot - (hh.through ? op.breakThrough ?? 1 : 0);
    if (op.tool.type === "drill" && hh.through) bottom -= (op.tool.diameter / 2) / Math.tan(((op.tool.angle || 118) / 2) * Math.PI / 180);
    path.enter(hh.x, hh.y, top + 1, op.plunge, op.clearZ);
    const peck = op.peck > 0 ? op.peck : top - bottom;
    let z = top;
    while (z > bottom + 1e-6) {
      z = Math.max(bottom, z - peck);
      path.push(hh.x, hh.y, z, PLUNGE, op.plunge);
      if (z > bottom + 1e-6) { path.rapidTo(hh.x, hh.y, top + 1); path.rapidTo(hh.x, hh.y, z + 0.5); }
    }
    path.rapidTo(hh.x, hh.y, path.retractZ);
  }
  path.retract();
}

function opEngrave(path, ctx, op) {
  if (!op.curves || !op.curves.length) throw new Error("Choose a sketch to engrave (it must lie flat, parallel to the XY plane)");
  const depth = op.depth || 0.5;
  for (const c of op.curves) {
    const z0 = op.fromStockTop ? ctx.stock.max[2] : c.z;
    const levelsZ = levels(z0, z0 - depth, op.stepdown || depth);
    for (const z of levelsZ) {
      const pts = c.pts;
      path.enter(pts[0][0], pts[0][1], z, op.plunge, op.clearZ);
      for (let i = 1; i < pts.length; i++) path.cut(pts[i][0], pts[i][1], z, op.feed);
    }
    path.retract();
  }
}

const OPS = { facing: opFacing, pocket: opPocket, contour: opContour, adaptive: opAdaptive, roughing: opRoughing, finishing: opFinishing, drilling: opDrilling, engrave: opEngrave, profile: opContour };

function stats(m) {
  let cut = 0, rapid = 0, time = 0;
  for (let i = 5; i < m.length; i += 5) {
    const d = Math.hypot(m[i] - m[i - 5], m[i + 1] - m[i - 4], m[i + 2] - m[i - 3]);
    if (m[i + 3] === RAPID) { rapid += d; time += d / 3000 * 60; } else { cut += d; time += (d / Math.max(1, m[i + 4])) * 60; }
  }
  return { cut, rapid, time };
}

function generate(id, { tris, stock, ops, setup }) {
  const pm = prepareMesh(tris);
  const hmCache = new Map();
  const ctx = {
    pm, stock, shadowCache: new Map(),
    heightmap: (res, floor) => {
      const k = res.toFixed(3);
      if (!hmCache.has(k)) hmCache.set(k, heightmap(tris, stock.min[0] - 10, stock.min[1] - 10, stock.max[0] + 10, stock.max[1] + 10, res, floor - 1000));
      return hmCache.get(k);
    },
  };
  const out = [];
  const transfer = [];
  ops.forEach((op, i) => {
    self.postMessage({ id, progress: i / ops.length });
    if (op.disabled) { out.push({ id: op.id, moves: new Float32Array(0), error: null, stats: { cut: 0, rapid: 0, time: 0 } }); return; }
    const path = new Path(stock.max[2] + setup.safeZ, stock.max[2] + setup.retractZ);
    try {
      const fn = OPS[op.type];
      if (!fn) throw new Error("Unknown operation");
      op.clearZ = stock.max[2] + setup.safeZ;
      op.ramp = op.ramp !== false;
      op.rampAngle = op.rampAngle || 3;
      fn(path, ctx, op);
      path.retract();
      const moves = new Float32Array(path.m);
      transfer.push(moves.buffer);
      out.push({ id: op.id, moves, error: null, stats: stats(path.m) });
    } catch (e) {
      out.push({ id: op.id, moves: new Float32Array(0), error: e.message || String(e), stats: { cut: 0, rapid: 0, time: 0 } });
    }
  });
  return { result: out, transfer };
}

// ---------- post processor ----------
function post({ ops, results, setup, tools, wcs, name }) {
  const flavor = setup.post || "grbl";
  const f = (n) => { const v = Math.abs(n) < 5e-5 ? 0 : n; return v.toFixed(3).replace(/\.?0+$/, "") || "0"; };
  const L = [];
  const C = (t) => (flavor === "fanuc" ? `(${t.replace(/[()]/g, "")})` : `; ${t}`);
  L.push(flavor === "fanuc" ? "%" : "", C(`ForgeCAD CAM – ${name}`), C(`Post: ${flavor}`), C(`Origin: ${wcs.label}`), "G21", "G90", "G17", flavor === "grbl" ? "G94" : "G94 G40 G49 G80");
  let curTool = null, x = null, y = null, z = null, fr = null;
  const safe = wcs.safeZ;
  ops.forEach((op, i) => {
    const r = results.find((q) => q.id === op.id);
    if (!r || r.error || !r.moves.length || op.disabled) return;
    const tool = tools.find((t) => t.id === op.toolId);
    L.push("", C(`Operation ${i + 1}: ${op.name} (${tool ? tool.name : "?"})`));
    if (!curTool || curTool.id !== tool.id) {
      if (curTool) { L.push("M5"); if (setup.coolant) L.push("M9"); L.push(`G0 Z${f(safe)}`); }
      if (flavor === "grbl") { if (curTool) L.push(C(`Change to tool ${tool.number}: ${tool.name}`), "M0"); }
      else L.push(`T${tool.number} M6`, ...(flavor === "linuxcnc" ? [`G43 H${tool.number}`] : []));
      L.push(`S${Math.round(op.rpm || tool.rpm)} M3`);
      if (flavor !== "grbl") L.push("G4 P2");
      if (setup.coolant) L.push("M8");
      curTool = tool;
      fr = null;
    }
    const m = r.moves;
    for (let k = 0; k < m.length; k += 5) {
      const X = m[k] - wcs.ox, Y = m[k + 1] - wcs.oy, Z = m[k + 2] - wcs.oz;
      const kind = m[k + 3], feed = m[k + 4];
      let s = kind === RAPID ? "G0" : "G1";
      if (x === null || Math.abs(X - x) > 5e-4) s += ` X${f(X)}`;
      if (y === null || Math.abs(Y - y) > 5e-4) s += ` Y${f(Y)}`;
      if (z === null || Math.abs(Z - z) > 5e-4) s += ` Z${f(Z)}`;
      if (s.length <= 2) continue;
      if (kind !== RAPID && feed !== fr) { s += ` F${Math.round(feed)}`; fr = feed; }
      L.push(s);
      x = X; y = Y; z = Z;
    }
  });
  L.push("", "M5", ...(setup.coolant ? ["M9"] : []), `G0 Z${f(safe)}`, flavor === "fanuc" ? "G28 G91 Z0" : "", flavor === "fanuc" ? "G90" : "", "M30", flavor === "fanuc" ? "%" : "");
  return { result: L.filter((l, i) => !(l === "" && L[i - 1] === "")).join("\n") + "\n" };
}

// stock heightmap of the part for the simulation's "target" overlay
function partMap({ tris, stock, res }) {
  const H = heightmap(tris, stock.min[0], stock.min[1], stock.max[0], stock.max[1], res, stock.min[2]);
  return { result: H, transfer: [H.hm.buffer] };
}

self.onmessage = (ev) => {
  const { id, cmd, args } = ev.data;
  try {
    const out = cmd === "generate" ? generate(id, args) : cmd === "post" ? post(args) : cmd === "partMap" ? partMap(args) : null;
    if (!out) throw new Error("Unknown command");
    self.postMessage({ id, ok: true, result: out.result }, out.transfer || []);
  } catch (e) {
    self.postMessage({ id, ok: false, error: e.message || String(e) });
  }
};
