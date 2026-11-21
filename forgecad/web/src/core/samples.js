// Example projects built from real parametric features.
import { newDoc, uid } from "./doc.js";
import { STD_PLANES } from "./planes.js";

function sketch(name, planeKey, offset = 0) {
  return {
    id: uid("f"), type: "sketch", name, plane: { ...STD_PLANES[planeKey] }, planeRef: planeKey, offset,
    points: [{ id: "O", x: 0, y: 0, keep: true }], entities: [], constraints: [{ id: uid("k"), type: "fix", a: "O", x: 0, y: 0, hidden: true }],
  };
}
function pt(sk, x, y) { const id = uid("p"); sk.points.push({ id, x, y }); return id; }
function line(sk, a, b, construction = false) { const id = uid("e"); sk.entities.push({ id, type: "line", p1: a, p2: b, construction }); return id; }
function con(sk, c) { sk.constraints.push({ id: uid("k"), ...c }); }

// rectangle; centred on the origin when cx/cy are null
function rect(sk, x0, y0, x1, y1, { wExpr, hExpr, centred = false } = {}) {
  const ids = [pt(sk, x0, y0), pt(sk, x1, y0), pt(sk, x1, y1), pt(sk, x0, y1)];
  const L = [0, 1, 2, 3].map((i) => line(sk, ids[i], ids[(i + 1) % 4]));
  con(sk, { type: "horizontal", a: L[0] }); con(sk, { type: "horizontal", a: L[2] });
  con(sk, { type: "vertical", a: L[1] }); con(sk, { type: "vertical", a: L[3] });
  if (wExpr) con(sk, { type: "length", a: L[0], value: Math.abs(x1 - x0), expr: wExpr });
  if (hExpr) con(sk, { type: "length", a: L[1], value: Math.abs(y1 - y0), expr: hExpr });
  if (centred) {
    const d = line(sk, ids[0], ids[2], true);
    con(sk, { type: "midpoint", a: "O", b: d });
  }
  return { ids, L };
}
function circle(sk, x, y, r, dExpr) {
  const c = pt(sk, x, y);
  const id = uid("e");
  sk.entities.push({ id, type: "circle", c, r });
  if (dExpr) con(sk, { type: "diameter", a: id, value: 2 * r, expr: dExpr });
  return { c, id };
}

function bracket() {
  const doc = newDoc("Mounting bracket");
  doc.params = [{ name: "W", expr: "80" }, { name: "D", expr: "50" }, { name: "T", expr: "6" }, { name: "H", expr: "40" }];
  const s1 = sketch("Base plate", "XY");
  rect(s1, -40, -25, 40, 25, { wExpr: "W", hExpr: "D", centred: true });
  for (const [x, y] of [[-30, -15], [30, -15]]) {
    const c = circle(s1, x, y, 3, "6");
    con(s1, { type: "hdistance", a: "O", b: c.c, value: 30, expr: "W/2-10" });
    con(s1, { type: "vdistance", a: "O", b: c.c, value: 15, expr: "D/2-10" });
  }
  const e1 = { id: uid("f"), type: "extrude", name: "Extrude 1", sketch: s1.id, regions: "auto", mode: "one", distance: "T", op: "new" };
  const s2 = sketch("Wall", "XZ", -25);
  rect(s2, -40, 0, 40, 40, { wExpr: "W", hExpr: "H" });
  con(s2, { type: "symmetric", a: s2.points[1].id, b: s2.points[2].id, line: (() => { const a = pt(s2, 0, -5), b = pt(s2, 0, 50); const id = line(s2, a, b, true); con(s2, { type: "vertical", a: id }); con(s2, { type: "pointOnLine", a: "O", b: id }); return id; })() });
  con(s2, { type: "pointOnLine", a: s2.points[1].id, b: (() => { const a = pt(s2, -50, 0), b = pt(s2, 50, 0); const id = line(s2, a, b, true); con(s2, { type: "horizontal", a: id }); con(s2, { type: "pointOnLine", a: "O", b: id }); return id; })() });
  const e2 = { id: uid("f"), type: "extrude", name: "Extrude 2", sketch: s2.id, regions: "auto", mode: "one", distance: "T", op: "join", target: "auto" };
  const fil = { id: uid("f"), type: "fillet", name: "Fillet 1", body: e1.id, edges: [{ p: [0, 19, 6], type: "LINE" }], radius: "5" };
  const hole = { id: uid("f"), type: "hole", name: "Hole 1", body: e1.id, at: { p: [0, 19, 26], n: [0, -1, 0] }, kind: "counterbore", diameter: "8", through: true, cbDiameter: "14", cbDepth: "2", points: [] };
  const ch = { id: uid("f"), type: "chamfer", name: "Chamfer 1", body: e1.id, edges: [{ p: [0, -25, 6], type: "LINE" }], distance: "1.5" };
  doc.features.push(s1, e1, s2, e2, fil, hole, ch);
  return doc;
}

function gears() {
  const doc = newDoc("Gear pair");
  doc.params = [{ name: "m", expr: "2" }, { name: "z1", expr: "24" }, { name: "z2", expr: "12" }, { name: "t", expr: "8" }];
  doc.features.push(
    { id: uid("f"), type: "primitive", name: "Gear 1", shape: "gear", module: "m", teeth: "z1", pressure: "20", bore: "6", h: "t", x: "0", y: "0", z: "0", op: "new" },
    { id: uid("f"), type: "primitive", name: "Gear 2", shape: "gear", module: "m", teeth: "z2", pressure: "20", bore: "5", h: "t", x: "m*(z1+z2)/2", y: "0", z: "0", rz: "180/z2", op: "new" },
  );
  return doc;
}

function enclosure() {
  const doc = newDoc("Electronics enclosure");
  doc.params = [{ name: "L", expr: "80" }, { name: "Wd", expr: "60" }, { name: "Ht", expr: "30" }, { name: "wall", expr: "2" }];
  const box = { id: uid("f"), type: "primitive", name: "Box 1", shape: "box", w: "L", d: "Wd", h: "Ht", x: "0", y: "0", z: "0", op: "new" };
  const fil = { id: uid("f"), type: "fillet", name: "Fillet 1", body: box.id, edges: [[40, 30], [-40, 30], [40, -30], [-40, -30]].map(([x, y]) => ({ p: [x, y, 15], type: "LINE" })), radius: "6" };
  const sh = { id: uid("f"), type: "shell", name: "Shell 1", body: box.id, faces: [{ p: [0, 0, 30], n: [0, 0, 1], type: "PLANE" }], thickness: "wall", outside: false };
  const h1 = { id: uid("f"), type: "hole", name: "Hole 1", body: box.id, at: { p: [-20, -30, 15], n: [0, -1, 0] }, kind: "simple", diameter: "8", through: false, depth: "4", tip: false, points: [[0, -30, 15]] };
  doc.features.push(box, fil, sh, h1);
  return doc;
}

function knob() {
  const doc = newDoc("Revolved knob");
  const s = sketch("Profile", "XZ");
  const P = [[0, 0], [15, 0], [15, 4], [12, 6], [12, 18], [8, 20], [0, 20]].map(([x, y]) => pt(s, x, y));
  for (let i = 0; i < P.length; i++) line(s, P[i], P[(i + 1) % P.length]);
  const ax = line(s, pt(s, 0, -5), pt(s, 0, 25), true);
  const rev = { id: uid("f"), type: "revolve", name: "Revolve 1", sketch: s.id, regions: "auto", axis: ax, angle: "360", op: "new" };
  const grip = { id: uid("f"), type: "primitive", name: "Grip cut", shape: "cylinder", r: "2", h: "14", x: "13.2", y: "0", z: "5", op: "cut" };
  const pat = { id: uid("f"), type: "circularPattern", name: "Circular pattern 1", body: grip.id, axis: "z", count: "12", angle: "360" };
  doc.features.push(s, rev);
  // pattern the cut by cutting with a patterned set of cylinders
  const cyl = { ...grip, op: "new", name: "Grip tool" };
  pat.body = cyl.id;
  const comb = { id: uid("f"), type: "boolean", name: "Combine 1", target: rev.id, tools: [cyl.id], op: "cut", keepTools: false };
  doc.features.push(cyl, pat, comb);
  return doc;
}

export const SAMPLES = [
  { name: "Mounting bracket", desc: "Sketches, extrudes, fillet, counterbored hole, chamfer, parameters", icon: "extrude", build: bracket },
  { name: "Gear pair", desc: "Two meshing spur gears driven by parameters", icon: "gear", build: gears },
  { name: "Electronics enclosure", desc: "Box, rounded corners, shell and holes", icon: "shell", build: enclosure },
  { name: "Revolved knob", desc: "Revolve with a patterned grip", icon: "revolve", build: knob },
];
