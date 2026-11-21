// Slicing triangle meshes with horizontal planes (shared by the 3D-print slicer and CAM).
export function weld(tris) {
  const map = new Map();
  const verts = [];
  const idx = new Uint32Array(tris.length / 3);
  for (let i = 0; i < tris.length; i += 3) {
    const k = `${Math.round(tris[i] * 1e4)},${Math.round(tris[i + 1] * 1e4)},${Math.round(tris[i + 2] * 1e4)}`;
    let v = map.get(k);
    if (v === undefined) { v = verts.length / 3; map.set(k, v); verts.push(tris[i], tris[i + 1], tris[i + 2]); }
    idx[i / 3] = v;
  }
  return { v: new Float64Array(verts), f: idx };
}

export function sliceAt(mesh, order, zmins, zmaxs, z) {
  const { v, f } = mesh;
  const segs = new Map(); // startKey -> {a:[x,y], b:[x,y], end:key}
  for (const t of order) {
    if (zmins[t] > z) break;
    if (zmaxs[t] < z) continue;
    const i0 = f[t * 3], i1 = f[t * 3 + 1], i2 = f[t * 3 + 2];
    const ids = [i0, i1, i2];
    const zs = ids.map((i) => v[i * 3 + 2]);
    const pts = [];
    for (let e = 0; e < 3; e++) {
      const a = ids[e], b = ids[(e + 1) % 3];
      const za = zs[e], zb = zs[(e + 1) % 3];
      if ((za < z && zb >= z) || (zb < z && za >= z)) {
        const tt = (z - za) / (zb - za);
        pts.push({ x: v[a * 3] + (v[b * 3] - v[a * 3]) * tt, y: v[a * 3 + 1] + (v[b * 3 + 1] - v[a * 3 + 1]) * tt, key: a < b ? a + "_" + b : b + "_" + a });
      }
    }
    if (pts.length !== 2) continue;
    // orientation from triangle normal: material on the left of the segment
    const ax = v[i1 * 3] - v[i0 * 3], ay = v[i1 * 3 + 1] - v[i0 * 3 + 1], az = v[i1 * 3 + 2] - v[i0 * 3 + 2];
    const bx = v[i2 * 3] - v[i0 * 3], by = v[i2 * 3 + 1] - v[i0 * 3 + 1], bz = v[i2 * 3 + 2] - v[i0 * 3 + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz;
    let [p, q] = pts;
    if ((q.x - p.x) * -ny + (q.y - p.y) * nx < 0) [p, q] = [q, p];
    if (p.key === q.key) continue;
    segs.set(p.key, { a: p, b: q });
  }
  // chain
  const loops = [];
  const used = new Set();
  for (const [k0, s0] of segs) {
    if (used.has(k0)) continue;
    const loop = [];
    let k = k0, s = s0, guard = 0;
    while (s && !used.has(k) && guard++ < 1e6) {
      used.add(k);
      loop.push([s.a.x, s.a.y]);
      k = s.b.key;
      s = segs.get(k);
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}


// weld + per-triangle z ranges + triangles sorted by lowest z
export function prepareMesh(tris) {
  const mesh = weld(tris);
  const nT = mesh.f.length / 3;
  const zmins = new Float64Array(nT), zmaxs = new Float64Array(nT);
  let zmin = Infinity, zmax = -Infinity;
  for (let t = 0; t < nT; t++) {
    const a = mesh.v[mesh.f[t * 3] * 3 + 2], b = mesh.v[mesh.f[t * 3 + 1] * 3 + 2], c = mesh.v[mesh.f[t * 3 + 2] * 3 + 2];
    zmins[t] = Math.min(a, b, c); zmaxs[t] = Math.max(a, b, c);
    if (zmins[t] < zmin) zmin = zmins[t];
    if (zmaxs[t] > zmax) zmax = zmaxs[t];
  }
  const order = Array.from({ length: nT }, (_, i) => i).sort((a, b) => zmins[a] - zmins[b]);
  return { mesh, zmins, zmaxs, order, zmin, zmax, slice: (z) => sliceAt(mesh, order, zmins, zmaxs, z) };
}
