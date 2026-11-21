// Geometry worker: rebuilds the parametric feature history with the OpenCascade kernel (via replicad)
// and sends back triangle meshes, edge lines and face/edge metadata for picking.
import opencascade from "replicad-opencascadejs";
import * as R from "replicad";
import { findRegions, selectRegions, chainPath, pointMap } from "../sketch/profiles.js";
import { solveSketch } from "../sketch/solver.js";
import { resolveParams, evaluate } from "../core/expr.js";
import { gearSegments } from "../core/gear.js";
import { STD_PLANES } from "../core/planes.js";

let ready = null;
function init() {
  if (!ready) {
    ready = opencascade({ locateFile: () => "occt.wasm" }).then((oc) => { R.setOC(oc); self.oc = oc; return true; });
  }
  return ready;
}

// ---------- helpers ----------
const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
};
const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };


function planeYDir(pl) { return V.cross(pl.n, pl.x); }
function to3D(pl, u, v) { const y = planeYDir(pl); return V.add(pl.o, V.add(V.mul(pl.x, u), V.mul(y, v))); }
function makePlane(pl, offset = 0) { return new R.Plane(V.add(pl.o, V.mul(pl.n, offset)), pl.x, pl.n); }
function tup(v) { return v.toTuple ? v.toTuple() : [v.x, v.y, v.z]; }

class FeatureError extends Error {}

function loopDrawing(loop) {
  if (loop.circle) return R.drawCircle(loop.circle.r).translate(loop.circle.c[0], loop.circle.c[1]);
  const segs = loop.segments;
  let pen = R.draw(segs[0].a);
  for (const s of segs) {
    if (s.type === "line") pen = pen.lineTo(s.b);
    else if (s.type === "arc") pen = pen.threePointsArcTo(s.b, s.mid);
    else if (s.type === "bezier") pen = pen.cubicBezierCurveTo(s.b, s.c1, s.c2);
  }
  return pen.close();
}

function regionDrawing(region) {
  let d = loopDrawing(region.outer);
  for (const h of region.holes) d = d.cut(loopDrawing(h));
  return d;
}

function pathDrawing(path) {
  if (path.circle) return R.drawCircle(path.circle.r).translate(path.circle.c[0], path.circle.c[1]);
  const segs = path.segments;
  let pen = R.draw(segs[0].a);
  for (const s of segs) {
    if (s.type === "line") pen = pen.lineTo(s.b);
    else if (s.type === "arc") pen = pen.threePointsArcTo(s.b, s.mid);
    else if (s.type === "bezier") pen = pen.cubicBezierCurveTo(s.b, s.c1, s.c2);
  }
  return path.closed ? pen.close() : pen.done();
}

// ---------- regeneration ----------
let cache = []; // [{key, bodies: Map, sketches: Map}]

function overlaps(a, b) {
  const A = a.boundingBox.bounds, B = b.boundingBox.bounds;
  const e = 1e-6;
  return A[0][0] <= B[1][0] + e && A[1][0] >= B[0][0] - e && A[0][1] <= B[1][1] + e && A[1][1] >= B[0][1] - e && A[0][2] <= B[1][2] + e && A[1][2] >= B[0][2] - e;
}

function edgeSig(e) {
  const p = tup(e.pointAt(0.5));
  let d = [0, 0, 0];
  try { d = tup(e.tangentAt(0.5)); } catch (_) {}
  return { p, d, type: e.geomType };
}
function faceSig(f) {
  const p = tup(f.center);
  let n = [0, 0, 1];
  try { n = tup(f.normalAt()); } catch (_) {}
  return { p, n, type: f.geomType };
}

function matchEdges(shape, sigs) {
  const edges = shape.edges;
  const info = edges.map(edgeSig);
  const out = [];
  for (const s of sigs || []) {
    let best = -1, bd = Infinity;
    info.forEach((e, i) => {
      let d = V.dist(e.p, s.p);
      if (s.type && e.type !== s.type) d += 0.5;
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0 && bd < 2.5 && !out.includes(edges[best])) out.push(edges[best]);
  }
  return out;
}
function matchFaces(shape, sigs) {
  const faces = shape.faces;
  const info = faces.map(faceSig);
  const out = [];
  for (const s of sigs || []) {
    let best = -1, bd = Infinity;
    info.forEach((f, i) => {
      let d = V.dist(f.p, s.p) + (s.n ? (1 - Math.abs(V.dot(f.n, s.n))) * 5 : 0);
      if (s.type && f.type !== s.type) d += 1;
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0 && bd < 5 && !out.includes(faces[best])) out.push(faces[best]);
  }
  return out;
}

function planeFromRef(ref, bodies, num) {
  // ref: "XY" | "XZ" | "YZ" | {body, face: sig}
  if (typeof ref === "string" && STD_PLANES[ref]) return STD_PLANES[ref];
  if (ref && ref.face) {
    const body = bodies.get(ref.body);
    if (!body) throw new FeatureError("Reference body is missing");
    const [f] = matchFaces(body, [ref.face]);
    if (!f || f.geomType !== "PLANE") throw new FeatureError("Reference face is missing or not flat");
    const n = V.norm(tup(f.normalAt()));
    const o = tup(f.center);
    const x = Math.abs(n[2]) > 0.9 ? V.norm(V.cross([0, 1, 0], n)) : V.norm(V.cross(n, [0, 0, 1]));
    return { o, x: Math.abs(n[2]) > 0.9 ? [Math.sign(n[2]) || 1, 0, 0] : V.norm(V.cross([0, 0, 1], n)), n };
  }
  return STD_PLANES.XY;
}

function axisFromRef(ref, bodies) {
  // returns {o, d}
  if (typeof ref === "string" && AXES[ref]) return { o: [0, 0, 0], d: AXES[ref] };
  if (ref && ref.edge) {
    const body = bodies.get(ref.body);
    const [e] = body ? matchEdges(body, [ref.edge]) : [];
    if (!e) throw new FeatureError("Reference edge is missing");
    if (e.geomType === "CIRCLE") {
      // axis of a circular edge: through its centre along the normal
      const a = tup(e.pointAt(0)), b = tup(e.pointAt(0.25)), c = tup(e.pointAt(0.5));
      const n = V.norm(V.cross(V.sub(b, a), V.sub(c, a)));
      const center = V.mul(V.add(a, c), 0.5);
      return { o: center, d: n };
    }
    return { o: tup(e.startPoint), d: V.norm(V.sub(tup(e.endPoint), tup(e.startPoint))) };
  }
  return { o: [0, 0, 0], d: [0, 0, 1] };
}

function sketchOf(ctx, id) {
  const sk = ctx.sketches.get(id);
  if (!sk) throw new FeatureError("Choose a sketch");
  return sk;
}

function profileSolids(ctx, f, build) {
  const sk = sketchOf(ctx, f.sketch);
  const regions = selectRegions(findRegions(sk), f.regions);
  if (!regions.length) throw new FeatureError("The sketch has no closed profile. Close the shape (endpoints must meet) or pick a region.");
  const out = [];
  for (const r of regions) out.push(build(regionDrawing(r), sk, r));
  return out;
}

function fuseAll(shapes) {
  let s = shapes[0];
  for (let i = 1; i < shapes.length; i++) s = s.fuse(shapes[i]);
  return s;
}

function applyOp(ctx, f, tool, n) {
  const op = f.op || "new";
  const bodies = ctx.bodies;
  if (op === "new" || bodies.size === 0) {
    if (op === "cut" || op === "intersect") throw new FeatureError("There is no body to cut. Use New body or Join.");
    bodies.set(f.id, tool);
    ctx.created.push(f.id);
    return;
  }
  let targets;
  if (f.target && f.target !== "auto") {
    if (!bodies.has(f.target)) throw new FeatureError("Target body is missing");
    targets = [f.target];
  } else {
    const ids = [...bodies.keys()].filter((id) => !ctx.meshOnly.has(id));
    targets = ids.filter((id) => overlaps(bodies.get(id), tool));
    if (op === "join") targets = targets.length ? [targets[targets.length - 1]] : [];
  }
  if (!targets.length) {
    if (op === "join") { bodies.set(f.id, tool); ctx.created.push(f.id); return; }
    throw new FeatureError("The tool doesn't touch any body");
  }
  for (const id of targets) {
    const b = bodies.get(id);
    let r;
    if (op === "join") r = b.fuse(tool);
    else if (op === "cut") r = b.cut(tool);
    else if (op === "intersect") r = b.intersect(tool);
    bodies.set(id, r);
  }
}

function bigLength(ctx) {
  let m = 100;
  for (const b of ctx.bodies.values()) {
    try { const bb = b.boundingBox.bounds; m = Math.max(m, V.dist(bb[0], bb[1]) * 2 + V.len(bb[0]) + V.len(bb[1])); } catch (_) {}
  }
  return m;
}

const FEATURES = {
  sketch(ctx, f) {
    // solve with current parameter values for driving dimensions
    const sk = JSON.parse(JSON.stringify(f));
    for (const c of sk.constraints) if (c.expr !== undefined) { try { c.value = evaluate(c.expr, ctx.params); } catch (_) {} }
    solveSketch(sk);
    let plane = sk.plane;
    if (sk.planeRef && sk.planeRef.face) {
      // follow the face if it moved, but keep the sketch origin where it was drawn
      try {
        const fp = planeFromRef(sk.planeRef, ctx.bodies);
        const n = fp.n;
        const o = V.sub(plane.o, V.mul(n, V.dot(V.sub(plane.o, fp.o), n)));
        let x = plane.x;
        if (Math.abs(V.dot(x, n)) > 1e-6) x = fp.x;
        plane = { o, x, n };
      } catch (_) {}
    }
    if (sk.offset) plane = { ...plane, o: V.add(plane.o, V.mul(plane.n, sk.offset)) };
    sk.plane = plane;
    ctx.sketches.set(f.id, sk);
    ctx.sketchOut.push({ id: f.id, plane, points: sk.points, entities: sk.entities });
  },

  extrude(ctx, f) {
    const P = ctx.num;
    let d1 = P(f.distance, 10), d2 = P(f.distance2, 0);
    const mode = f.mode || "one";
    if (f.throughAll) { d1 = bigLength(ctx); d2 = mode === "one" ? 0 : d1; }
    if (f.flip && mode === "one") d1 = -d1;
    if (f.flip && mode === "two") [d1, d2] = [d2, d1];
    const sk = sketchOf(ctx, f.sketch);
    let start = 0, len = d1;
    if (mode === "symmetric") { start = -Math.abs(d1) / 2; len = Math.abs(d1); }
    else if (mode === "two") { start = -d2; len = d1 + d2; }
    if (Math.abs(len) < 1e-9) throw new FeatureError("Distance can't be zero");
    if (len < 0) { start += len; len = -len; }
    const pl = makePlane(sk.plane, start);
    const solids = profileSolids(ctx, f, (drawing) => {
      const opts = {};
      if (f.taper) {
        opts.extrusionProfile = { profile: "linear", endFactor: Math.max(0.01, 1 - (2 * len * Math.tan((P(f.taper, 0) * Math.PI) / 180)) / Math.max(1, ctx.sizeOf(drawing))) };
      }
      return drawing.sketchOnPlane(pl).extrude(len, opts);
    });
    applyOp(ctx, f, fuseAll(solids));
  },

  revolve(ctx, f) {
    const sk = sketchOf(ctx, f.sketch);
    const P = ctx.num;
    const angle = P(f.angle, 360);
    let o, d;
    if (f.axis === "x" || !f.axis) { o = sk.plane.o; d = sk.plane.x; }
    else if (f.axis === "y") { o = sk.plane.o; d = planeYDir(sk.plane); }
    else if (f.axis === "X" || f.axis === "Y" || f.axis === "Z") { o = [0, 0, 0]; d = AXES[f.axis.toLowerCase()]; }
    else {
      const e = sk.entities.find((x) => x.id === f.axis);
      if (!e || e.type !== "line") throw new FeatureError("Pick a line in the sketch as the axis");
      const pts = pointMap(sk);
      const a = pts.get(e.p1), b = pts.get(e.p2);
      o = to3D(sk.plane, a.x, a.y);
      d = V.norm(V.sub(to3D(sk.plane, b.x, b.y), o));
    }
    const solids = profileSolids(ctx, f, (drawing) => drawing.sketchOnPlane(makePlane(sk.plane)).revolve(d, { origin: o, angle }));
    applyOp(ctx, f, fuseAll(solids));
  },

  loft(ctx, f) {
    const ids = f.sketches || [];
    if (ids.length < 2) throw new FeatureError("Pick at least two sketches");
    const sketches = ids.map((id) => {
      const sk = sketchOf(ctx, id);
      const regions = selectRegions(findRegions(sk), "auto");
      if (!regions.length) throw new FeatureError(`Sketch "${sk.name}" has no closed profile`);
      const r = regions.sort((a, b) => b.area - a.area)[0];
      return loopDrawing(r.outer).sketchOnPlane(makePlane(sk.plane));
    });
    const solid = sketches[0].loftWith(sketches.slice(1), { ruled: !!f.ruled });
    applyOp(ctx, f, solid);
  },

  sweep(ctx, f) {
    const prof = sketchOf(ctx, f.sketch);
    const pathSk = sketchOf(ctx, f.path);
    const path = chainPath(pathSk);
    if (!path) throw new FeatureError("The path sketch has no curves");
    const spine = pathDrawing(path).sketchOnPlane(makePlane(pathSk.plane)).wire;
    const solids = profileSolids(ctx, f, (drawing) => {
      const sk = drawing.sketchOnPlane(makePlane(prof.plane));
      const wire = sk.wire || (sk.sketches && sk.sketches[0].wire);
      return R.genericSweep(wire, spine, { frenet: f.frenet !== false, transitionMode: "round" }, false);
    });
    applyOp(ctx, f, fuseAll(solids));
  },

  primitive(ctx, f) {
    const P = ctx.num;
    const pos = [P(f.x, 0), P(f.y, 0), P(f.z, 0)];
    let s;
    switch (f.shape) {
      case "box": {
        const w = P(f.w, 20), d = P(f.d, 20), h = P(f.h, 20);
        s = R.makeBox([-w / 2, -d / 2, 0], [w / 2, d / 2, h]);
        break;
      }
      case "cylinder": s = R.makeCylinder(P(f.r, 10), P(f.h, 20), [0, 0, 0], [0, 0, 1]); break;
      case "sphere": s = R.makeSphere(P(f.r, 10)); break;
      case "cone": {
        const r1 = P(f.r, 10), r2 = P(f.r2, 0), h = P(f.h, 20);
        let pen = R.draw([0, 0]).hLine(r1).lineTo([Math.max(r2, 0), h]).lineTo([0, h]).close();
        if (r2 <= 1e-6) pen = R.draw([0, 0]).hLine(r1).lineTo([0, h]).close();
        s = pen.sketchOnPlane("XZ").revolve([0, 0, 1], { origin: [0, 0, 0] });
        break;
      }
      case "torus": {
        const Rm = P(f.r, 15), rm = P(f.r2, 4);
        s = R.drawCircle(rm).translate(Rm, 0).sketchOnPlane("XZ").revolve([0, 0, 1], { origin: [0, 0, 0] });
        break;
      }
      case "gear": {
        const g = gearSegments({ module: P(f.module, 2), teeth: P(f.teeth, 20), pressureAngle: P(f.pressure, 20), backlash: P(f.backlash, 0.05) });
        let dwg = loopDrawing({ segments: g.segments });
        const bore = P(f.bore, 0);
        if (bore > 0) dwg = dwg.cut(R.drawCircle(bore / 2));
        s = dwg.sketchOnPlane("XY").extrude(P(f.h, 8));
        break;
      }
      default: throw new FeatureError("Unknown primitive");
    }
    if (f.rx) s = s.rotate(P(f.rx, 0), [0, 0, 0], [1, 0, 0]);
    if (f.ry) s = s.rotate(P(f.ry, 0), [0, 0, 0], [0, 1, 0]);
    if (f.rz) s = s.rotate(P(f.rz, 0), [0, 0, 0], [0, 0, 1]);
    s = s.translate(pos);
    applyOp(ctx, f, s);
  },

  hole(ctx, f) {
    const P = ctx.num;
    const body = ctx.body(f.body);
    if (!f.at) throw new FeatureError("Tap a flat face where the hole goes");
    const dia = P(f.diameter, 5), depth = f.through ? bigLength(ctx) : P(f.depth, 10);
    const n = V.norm(f.at.n), o = f.at.p;
    // hole profile in local (r, z) going into the material (-n)
    const pts = [[0, 0.01]];
    let z = 0.01;
    const kind = f.kind || "simple";
    if (kind === "counterbore") {
      const cd = P(f.cbDiameter, dia * 1.8), ch = P(f.cbDepth, dia * 0.6);
      pts.push([cd / 2, 0.01], [cd / 2, -ch], [dia / 2, -ch]);
    } else if (kind === "countersink") {
      const cd = P(f.cbDiameter, dia * 2), ang = P(f.csAngle, 90);
      const h = (cd / 2 - dia / 2) / Math.tan(((ang / 2) * Math.PI) / 180);
      pts.push([cd / 2, 0.01], [cd / 2, 0], [dia / 2, -h]);
    } else pts.push([dia / 2, 0.01]);
    pts.push([dia / 2, -depth]);
    if (!f.through && f.tip !== false) pts.push([0, -depth - (dia / 2) / Math.tan((59 * Math.PI) / 180)]);
    else pts.push([0, -depth]);
    let pen = R.draw(pts[0]);
    for (let i = 1; i < pts.length; i++) pen = pen.lineTo(pts[i]);
    let tool = pen.close().sketchOnPlane("XZ").revolve([0, 0, 1], { origin: [0, 0, 0] });
    // orient local Z to the face normal
    const zA = [0, 0, 1];
    const ax = V.cross(zA, n);
    const ang = (Math.acos(Math.max(-1, Math.min(1, V.dot(zA, n)))) * 180) / Math.PI;
    if (V.len(ax) > 1e-9) tool = tool.rotate(ang, [0, 0, 0], V.norm(ax));
    else if (n[2] < 0) tool = tool.rotate(180, [0, 0, 0], [1, 0, 0]);
    tool = tool.translate(o);
    const extra = (f.points || []).map((p) => tool.clone().translate(V.sub(p, o)));
    let res = body.cut(tool);
    for (const t of extra) res = res.cut(t);
    ctx.bodies.set(f.body, res);
  },

  fillet(ctx, f) {
    const body = ctx.body(f.body);
    const edges = matchEdges(body, f.edges);
    if (!edges.length) throw new FeatureError("Select the edges to round");
    const r = ctx.num(f.radius, 2);
    ctx.bodies.set(f.body, body.fillet(r, (e) => e.inList(edges)));
  },

  chamfer(ctx, f) {
    const body = ctx.body(f.body);
    const edges = matchEdges(body, f.edges);
    if (!edges.length) throw new FeatureError("Select the edges to chamfer");
    const r = ctx.num(f.distance, 1);
    ctx.bodies.set(f.body, body.chamfer(r, (e) => e.inList(edges)));
  },

  shell(ctx, f) {
    const body = ctx.body(f.body);
    const faces = matchFaces(body, f.faces);
    const t = ctx.num(f.thickness, 2);
    if (!faces.length) {
      // closed hollow body: offset inwards and subtract
      throw new FeatureError("Select at least one face to remove (open side)");
    }
    ctx.bodies.set(f.body, body.shell(f.outside ? -t : t, (fc) => fc.inList(faces)));
  },

  draft(ctx, f) {
    const body = ctx.body(f.body);
    const faces = matchFaces(body, f.faces);
    if (!faces.length) throw new FeatureError("Select the faces to draft");
    const pl = planeFromRef(f.plane || "XY", ctx.bodies);
    ctx.bodies.set(f.body, body.draft(ctx.num(f.angle, 3), (fc) => fc.inList(faces), makePlane(pl)));
  },

  offsetFace(ctx, f) {
    const body = ctx.body(f.body);
    const faces = matchFaces(body, f.faces);
    if (!faces.length) throw new FeatureError("Select flat faces to push or pull");
    const dist = ctx.num(f.distance, 2);
    let res = body;
    for (const face of faces) {
      if (face.geomType !== "PLANE") throw new FeatureError("Offset face works on flat faces");
      const n = V.norm(tup(face.normalAt()));
      let vec = f.direction && f.direction !== "normal" ? V.mul(AXES[f.direction], dist) : V.mul(n, dist);
      const outward = V.dot(vec, n) > 0;
      const solid = R.basicFaceExtrusion(face, new R.Vector(vec));
      res = outward ? res.fuse(solid) : res.cut(solid);
    }
    ctx.bodies.set(f.body, res);
  },

  deleteFace(ctx, f) {
    const body = ctx.body(f.body);
    const del = matchFaces(body, f.faces);
    if (!del.length) throw new FeatureError("Select faces to delete");
    const all = body.faces;
    const keep = all.filter((fc) => !del.some((d) => d.isSame(fc)));
    // boundary edges = edges of deleted faces also used by kept faces
    const keptEdges = keep.flatMap((fc) => fc.edges);
    const boundary = [];
    for (const d of del) for (const e of d.edges) {
      if (keptEdges.some((k) => k.isSame(e)) && !boundary.some((b) => b.isSame(e))) boundary.push(e);
    }
    // group into connected loops
    const loops = [];
    const left = boundary.slice();
    const key = (p) => p.map((x) => x.toFixed(4)).join(",");
    while (left.length) {
      const loop = [left.shift()];
      let grew = true;
      while (grew) {
        grew = false;
        const ends = new Set(loop.flatMap((e) => [key(tup(e.startPoint)), key(tup(e.endPoint))]));
        for (let i = left.length - 1; i >= 0; i--) {
          const e = left[i];
          if (ends.has(key(tup(e.startPoint))) || ends.has(key(tup(e.endPoint)))) { loop.push(e); left.splice(i, 1); grew = true; }
        }
      }
      loops.push(loop);
    }
    const patches = [];
    for (const loop of loops) {
      const wire = R.assembleWire(loop);
      let face;
      try { face = R.makeFace(wire); } catch (_) { face = R.makeNonPlanarFace(wire); }
      patches.push(face);
    }
    const shell = R.weldShellsAndFaces([...keep, ...patches]);
    let solid = R.makeSolid([shell]);
    try { solid = solid.simplify(); } catch (_) {}
    ctx.bodies.set(f.body, solid);
  },

  mirror(ctx, f) {
    const body = ctx.body(f.body);
    const pl = planeFromRef(f.plane || "YZ", ctx.bodies);
    const m = body.clone().mirror(makePlane(pl));
    if (f.op === "new") { ctx.bodies.set(f.id, m); ctx.created.push(f.id); }
    else ctx.bodies.set(f.body, body.fuse(m));
  },

  linearPattern(ctx, f) {
    const P = ctx.num;
    const body = ctx.body(f.body);
    const n1 = Math.max(1, Math.round(P(f.count, 3))), s1 = P(f.spacing, 20);
    const d1 = f.dir && AXES[f.dir] ? AXES[f.dir] : axisFromRef(f.dir, ctx.bodies).d;
    const n2 = f.dir2 && f.dir2 !== "none" ? Math.max(1, Math.round(P(f.count2, 1))) : 1;
    const s2 = P(f.spacing2, 20);
    const d2 = n2 > 1 ? (AXES[f.dir2] || axisFromRef(f.dir2, ctx.bodies).d) : [0, 0, 0];
    let res = body;
    for (let i = 0; i < n1; i++) for (let j = 0; j < n2; j++) {
      if (!i && !j) continue;
      res = res.fuse(body.clone().translate(V.add(V.mul(d1, s1 * i), V.mul(d2, s2 * j))));
    }
    ctx.bodies.set(f.body, res);
  },

  circularPattern(ctx, f) {
    const P = ctx.num;
    const body = ctx.body(f.body);
    const n = Math.max(1, Math.round(P(f.count, 6)));
    const total = P(f.angle, 360);
    const ax = axisFromRef(f.axis || "z", ctx.bodies);
    const step = Math.abs(total - 360) < 1e-6 ? 360 / n : total / Math.max(1, n - 1);
    let res = body;
    for (let i = 1; i < n; i++) res = res.fuse(body.clone().rotate(step * i, ax.o, ax.d));
    ctx.bodies.set(f.body, res);
  },

  move(ctx, f) {
    const P = ctx.num;
    const src = ctx.body(f.body);
    let s = src.clone();
    if (f.align && f.alignTo && ctx.bodies.has(f.alignTo)) {
      const a = s.boundingBox.bounds, b = ctx.bodies.get(f.alignTo).boundingBox.bounds;
      const t = [0, 0, 0];
      ["x", "y", "z"].forEach((k, i) => {
        const m = f["align" + k.toUpperCase()] || "none";
        if (m === "min") t[i] = b[0][i] - a[0][i];
        else if (m === "max") t[i] = b[1][i] - a[1][i];
        else if (m === "center") t[i] = (b[0][i] + b[1][i]) / 2 - (a[0][i] + a[1][i]) / 2;
        else if (m === "ontop") t[i] = b[1][i] - a[0][i];
      });
      s = s.translate(t);
    }
    const rc = [P(f.cx, 0), P(f.cy, 0), P(f.cz, 0)];
    if (P(f.rx, 0)) s = s.rotate(P(f.rx, 0), rc, [1, 0, 0]);
    if (P(f.ry, 0)) s = s.rotate(P(f.ry, 0), rc, [0, 1, 0]);
    if (P(f.rz, 0)) s = s.rotate(P(f.rz, 0), rc, [0, 0, 1]);
    const sc = P(f.scale, 1);
    if (Math.abs(sc - 1) > 1e-9) s = s.scale(sc, rc);
    s = s.translate([P(f.dx, 0), P(f.dy, 0), P(f.dz, 0)]);
    if (f.copy) { ctx.bodies.set(f.id, s); ctx.created.push(f.id); }
    else ctx.bodies.set(f.body, s);
  },

  split(ctx, f) {
    const body = ctx.body(f.body);
    const pl = planeFromRef(f.plane || "XY", ctx.bodies);
    const off = ctx.num(f.offset, 0);
    const plane = makePlane(pl, off);
    const a = body.clone().cutPlane(plane, 0, "positive");
    const b = body.clone().cutPlane(plane, 0, "negative");
    if (!a || !b) throw new FeatureError("The plane doesn't cut through the body");
    ctx.bodies.set(f.body, a);
    ctx.bodies.set(f.id, b);
    ctx.created.push(f.id);
  },

  boolean(ctx, f) {
    const target = ctx.body(f.target);
    const tools = (f.tools || []).filter((t) => t !== f.target).map((t) => ctx.body(t));
    if (!tools.length) throw new FeatureError("Choose tool bodies");
    let r = target;
    for (const t of tools) r = f.op === "cut" ? r.cut(t) : f.op === "intersect" ? r.intersect(t) : r.fuse(t);
    ctx.bodies.set(f.target, r);
    if (!f.keepTools) for (const t of f.tools) if (t !== f.target) ctx.bodies.delete(t);
  },

  import(ctx, f) {
    let s = R.deserializeShape(f.brep);
    ctx.bodies.set(f.id, s);
    ctx.created.push(f.id);
  },

  mesh(ctx, f) {
    ctx.meshBodies.set(f.id, f);
    ctx.created.push(f.id);
  },

  deleteBody(ctx, f) {
    for (const id of f.bodies || []) { ctx.bodies.delete(id); ctx.meshBodies.delete(id); }
  },
};

function cloneState(st) {
  return { bodies: new Map(st.bodies), sketches: new Map(st.sketches), meshBodies: new Map(st.meshBodies), meshOnly: new Set(st.meshOnly) };
}

function regenerate(doc, opts = {}) {
  const { values: params } = resolveParams(doc.params);
  const feats = doc.features;
  const end = doc.rollback != null ? Math.min(doc.rollback, feats.length) : feats.length;
  const pkey = JSON.stringify(doc.params || []);
  // reuse cached prefix
  let start = 0;
  let state = { bodies: new Map(), sketches: new Map(), meshBodies: new Map(), meshOnly: new Set() };
  const keys = [];
  let running = pkey;
  for (let i = 0; i < end; i++) { running = hashStr(running + "|" + JSON.stringify(feats[i])); keys.push(running); }
  for (let i = Math.min(end, cache.length) - 1; i >= 0; i--) {
    if (cache[i] && cache[i].key === keys[i]) { start = i + 1; state = cloneState(cache[i].state); break; }
  }
  cache.length = start;
  const errors = {};
  const sketchOut = [];
  const createdBy = {};
  // sketches from cached prefix still need to be reported
  for (let i = 0; i < start; i++) {
    const c = cache[i];
    if (c.sketch) sketchOut.push(c.sketch);
    Object.assign(createdBy, c.createdBy);
    Object.assign(errors, c.errors);
  }
  for (let i = start; i < end; i++) {
    const f = feats[i];
    const ctx = {
      ...state, params, sketchOut: [], created: [],
      num: (x, def) => { if (x === undefined || x === null || x === "") return def; return evaluate(x, params); },
      body: (id) => {
        if (!id) { const ks = [...state.bodies.keys()]; if (ks.length === 1) return state.bodies.get(ks[0]); throw new FeatureError("Choose a body"); }
        if (!state.bodies.has(id)) throw new FeatureError("The body it uses no longer exists");
        return state.bodies.get(id);
      },
      sizeOf: (dwg) => { try { const b = dwg.boundingBox; return Math.max(b.width, b.height); } catch (_) { return 10; } },
    };
    const fe = {};
    if (!f.suppressed) {
      try {
        const fn = FEATURES[f.type];
        if (!fn) throw new FeatureError(`Unknown feature ${f.type}`);
        const tf = performance.now();
        fn(ctx, f);
        if (self.DEBUG_TIMING) console.log("feature", f.id, f.type, Math.round(performance.now() - tf), "ms");
        state.bodies = ctx.bodies; state.sketches = ctx.sketches;
      } catch (e) {
        fe[f.id] = e instanceof FeatureError ? e.message : friendlyError(e);
        errors[f.id] = fe[f.id];
      }
    }
    const cb = {};
    for (const id of ctx.created) cb[id] = f.id;
    Object.assign(createdBy, cb);
    sketchOut.push(...ctx.sketchOut);
    cache[i] = { key: keys[i], state: cloneState(state), sketch: ctx.sketchOut[0] || null, createdBy: cb, errors: fe };
  }
  return { state, errors, sketchOut, createdBy, params };
}

function friendlyError(e) {
  let m = (e && e.message) || String(e);
  if (typeof WebAssembly !== "undefined" && WebAssembly.Exception && e instanceof WebAssembly.Exception) {
    try { const x = self.oc.getExceptionMessage(e); m = Array.isArray(x) ? x.filter(Boolean).join(": ") : String(x); } catch (_) { m = ""; }
    return "The geometry kernel couldn't build this" + (m ? ` (${m})` : "") + ". Try a smaller value or a different selection.";
  }
  if (/^\d+$/.test(m) || /RuntimeError|memory|unreachable/i.test(m)) return "The geometry kernel couldn't build this (try a smaller radius/distance or different selection)";
  return m.length > 160 ? m.slice(0, 160) + "…" : m;
}

function hashStr(s) {
  let h1 = 0x811c9dc5, h2 = 0x1234567;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519); }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + s.length;
}

function meshBody(id, shape, quality) {
  const tol = quality === "high" ? 0.02 : quality === "low" ? 0.25 : 0.08;
  const ang = quality === "high" ? 0.15 : quality === "low" ? 0.5 : 0.3;
  const m = shape.mesh({ tolerance: tol, angularTolerance: ang });
  const e = shape.meshEdges({ tolerance: tol, angularTolerance: ang });
  const faces = shape.faces.map((f) => {
    const s = faceSig(f);
    if (f.geomType === "CYLINDRE" || f.geomType === "CYLINDER") {
      try {
        const cyl = f._geomAdaptor().Cylinder();
        const ax = cyl.Axis();
        const loc = ax.Location(), dir = ax.Direction();
        s.radius = cyl.Radius();
        s.axis = { o: [loc.X(), loc.Y(), loc.Z()], d: [dir.X(), dir.Y(), dir.Z()] };
      } catch (_) {}
    }
    return s;
  });
  const edges = shape.edges.map(edgeSig);
  let volume = 0, area = 0, com = [0, 0, 0];
  try { const vp = R.measureShapeVolumeProperties(shape); volume = vp.volume; com = vp.centerOfMass; } catch (_) {}
  try { area = R.measureArea(shape); } catch (_) {}
  const bb = shape.boundingBox.bounds;
  return {
    id, kind: "brep",
    positions: new Float32Array(m.vertices), normals: new Float32Array(m.normals), index: new Uint32Array(m.triangles),
    faceGroups: m.faceGroups.map((g) => [g.start, g.count]),
    lines: new Float32Array(e.lines), edgeGroups: e.edgeGroups.map((g) => [g.start, g.count]),
    faces, edges, volume, area, com, bbox: bb,
  };
}

function decodeF32(s) {
  if (typeof s !== "string") return new Float32Array(s);
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Float32Array(u8.buffer);
}

function meshOnlyBody(f) {
  const pos = decodeF32(f.positions);
  let bb = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { bb[0][k] = Math.min(bb[0][k], pos[i + k]); bb[1][k] = Math.max(bb[1][k], pos[i + k]); }
  let vol = 0;
  for (let i = 0; i < pos.length; i += 9) {
    const a = [pos[i], pos[i + 1], pos[i + 2]], b = [pos[i + 3], pos[i + 4], pos[i + 5]], c = [pos[i + 6], pos[i + 7], pos[i + 8]];
    vol += V.dot(a, V.cross(b, c)) / 6;
  }
  return { id: f.id, kind: "mesh", positions: pos, normals: null, index: null, faceGroups: [], lines: new Float32Array(0), edgeGroups: [], faces: [], edges: [], volume: Math.abs(vol), area: 0, com: [0, 0, 0], bbox: bb };
}

let lastState = null;

const API = {
  async init() { await init(); return true; },

  async regenerate({ doc, quality }) {
    await init();
    const t0 = performance.now();
    const { state, errors, sketchOut, createdBy } = regenerate(doc, {});
    lastState = state;
    const bodies = [];
    const transfer = [];
    for (const [id, shape] of state.bodies) {
      try {
        const b = meshBody(id, shape, quality);
        bodies.push(b);
        transfer.push(b.positions.buffer, b.normals.buffer, b.index.buffer, b.lines.buffer);
      } catch (e) {
        errors[createdBy[id] || id] = "Couldn't display this body: " + friendlyError(e);
      }
    }
    for (const [id, f] of state.meshBodies) bodies.push(meshOnlyBody(f));
    return { result: { bodies, errors, sketches: sketchOut, createdBy, ms: Math.round(performance.now() - t0) }, transfer };
  },

  async exportSTEP({ ids }) {
    const list = [...lastState.bodies.entries()].filter(([id]) => !ids || ids.includes(id));
    if (!list.length) throw new Error("Nothing to export (STEP needs solid bodies)");
    const blob = R.exportSTEP(list.map(([id, shape]) => ({ shape, name: id })));
    const buf = await blob.arrayBuffer();
    return { result: buf, transfer: [buf] };
  },

  async exportSTL({ ids, quality }) {
    // returns a flat Float32Array of triangles for all chosen bodies (positions only)
    const tol = quality === "high" ? 0.01 : quality === "low" ? 0.1 : 0.03;
    const tris = [];
    for (const [id, shape] of lastState.bodies) {
      if (ids && !ids.includes(id)) continue;
      const m = shape.mesh({ tolerance: tol, angularTolerance: 0.2 });
      for (let i = 0; i < m.triangles.length; i++) {
        const k = m.triangles[i] * 3;
        tris.push(m.vertices[k], m.vertices[k + 1], m.vertices[k + 2]);
      }
    }
    for (const [id, f] of lastState.meshBodies) {
      if (ids && !ids.includes(id)) continue;
      const p = decodeF32(f.positions);
      for (let i = 0; i < p.length; i++) tris.push(p[i]);
    }
    const arr = new Float32Array(tris);
    return { result: arr, transfer: [arr.buffer] };
  },

  async importSTEP({ bytes }) {
    await init();
    const shape = await R.importSTEP(new Blob([bytes]));
    const parts = shape.solids && shape.solids.length > 1 ? shape.solids : [shape];
    return { result: parts.map((p) => p.serialize()) };
  },

  async meshToSolid({ positions }) {
    await init();
    const p = decodeF32(positions);
    const tri = Math.floor(p.length / 9);
    const buf = new ArrayBuffer(84 + tri * 50);
    const dv = new DataView(buf);
    dv.setUint32(80, tri, true);
    for (let i = 0; i < tri; i++) {
      const o = 84 + i * 50;
      for (let k = 0; k < 9; k++) dv.setFloat32(o + 12 + k * 4, p[i * 9 + k], true);
    }
    const shape = await R.importSTL(new Blob([buf]));
    let solid = shape;
    try { solid = R.makeSolid([shape]); } catch (_) {}
    return { result: solid.serialize() };
  },

  async distance({ a, b }) {
    // minimal distance between two bodies
    const s1 = lastState.bodies.get(a), s2 = lastState.bodies.get(b);
    if (!s1 || !s2) throw new Error("Pick two solid bodies");
    return { result: R.measureDistanceBetween(s1, s2) };
  },

  async section({ id, plane, offset }) {
    // section outline of a body (for CAM pockets / previews)
    const s = lastState.bodies.get(id);
    if (!s) throw new Error("No body");
    const half = s.clone().cutPlane(makePlane(STD_PLANES[plane] || STD_PLANES.XY, offset), 0, "negative");
    return { result: half ? R.measureVolume(half) : 0 };
  },
};

self.onmessage = async (ev) => {
  const { id, cmd, args } = ev.data;
  try {
    const out = await API[cmd](args || {});
    self.postMessage({ id, ok: true, result: out.result }, out.transfer || []);
  } catch (e) {
    console.error(e);
    self.postMessage({ id, ok: false, error: friendlyError(e) });
  }
};
