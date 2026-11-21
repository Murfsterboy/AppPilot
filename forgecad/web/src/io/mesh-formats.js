// STL and OBJ reading/writing. Meshes are flat Float32Arrays of triangle vertices (x,y,z × 3 per triangle).

export function parseSTL(buf) {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  if (u8.length >= 84) {
    const n = dv.getUint32(80, true);
    if (84 + n * 50 === u8.length) {
      const out = new Float32Array(n * 9);
      for (let i = 0; i < n; i++) {
        const o = 84 + i * 50 + 12;
        for (let k = 0; k < 9; k++) out[i * 9 + k] = dv.getFloat32(o + k * 4, true);
      }
      return out;
    }
  }
  const txt = new TextDecoder().decode(u8);
  const nums = [];
  const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
  let m;
  while ((m = re.exec(txt))) nums.push(+m[1], +m[2], +m[3]);
  if (!nums.length) throw new Error("Not a valid STL file");
  return new Float32Array(nums);
}

export function writeSTL(tris, name = "forgecad") {
  const n = Math.floor(tris.length / 9);
  const buf = new ArrayBuffer(84 + n * 50);
  const dv = new DataView(buf);
  const header = `ForgeCAD ${name}`.slice(0, 79);
  for (let i = 0; i < header.length; i++) dv.setUint8(i, header.charCodeAt(i));
  dv.setUint32(80, n, true);
  for (let i = 0; i < n; i++) {
    const p = i * 9;
    const ax = tris[p + 3] - tris[p], ay = tris[p + 4] - tris[p + 1], az = tris[p + 5] - tris[p + 2];
    const bx = tris[p + 6] - tris[p], by = tris[p + 7] - tris[p + 1], bz = tris[p + 8] - tris[p + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz) || 1;
    const o = 84 + i * 50;
    dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true);
    for (let k = 0; k < 9; k++) dv.setFloat32(o + 12 + k * 4, tris[p + k], true);
  }
  return buf;
}

export function parseOBJ(text) {
  const v = [];
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim().split(/\s+/);
    if (t[0] === "v") v.push([+t[1], +t[2], +t[3]]);
    else if (t[0] === "f") {
      const idx = t.slice(1).map((s) => { const i = parseInt(s.split("/")[0], 10); return i < 0 ? v.length + i : i - 1; });
      for (let i = 1; i + 1 < idx.length; i++) {
        for (const j of [idx[0], idx[i], idx[i + 1]]) { const p = v[j]; if (!p) throw new Error("Bad OBJ face index"); out.push(p[0], p[1], p[2]); }
      }
    }
  }
  if (!out.length) throw new Error("No faces found in OBJ file");
  return new Float32Array(out);
}

export function writeOBJ(tris, name = "forgecad") {
  // weld identical vertices to keep the file small
  const map = new Map();
  const verts = [];
  const faces = [];
  const key = (i) => `${tris[i].toFixed(5)},${tris[i + 1].toFixed(5)},${tris[i + 2].toFixed(5)}`;
  for (let i = 0; i < tris.length; i += 9) {
    const f = [];
    for (let k = 0; k < 3; k++) {
      const kk = key(i + k * 3);
      let id = map.get(kk);
      if (id === undefined) { id = verts.length + 1; map.set(kk, id); verts.push(kk.replace(/,/g, " ")); }
      f.push(id);
    }
    faces.push(f.join(" "));
  }
  return `# ForgeCAD export\no ${name}\n` + verts.map((s) => "v " + s).join("\n") + "\n" + faces.map((s) => "f " + s).join("\n") + "\n";
}
