// Polygon boolean/offset helpers on top of Clipper (integer coordinates, 1 unit = 1 µm).
import ClipperLib from "clipper-lib";
export const S = 1000;
const C = ClipperLib;

export const toPath = (pts) => pts.map(([x, y]) => ({ X: Math.round(x * S), Y: Math.round(y * S) }));
export const fromPath = (p) => p.map((q) => [q.X / S, q.Y / S]);

function run(type, subj, clip, fill = C.PolyFillType.pftNonZero) {
  const c = new C.Clipper();
  c.AddPaths(subj, C.PolyType.ptSubject, true);
  if (clip && clip.length) c.AddPaths(clip, C.PolyType.ptClip, true);
  const out = new C.Paths();
  c.Execute(type, out, fill, fill);
  return out;
}
export const union = (a, b = [], fill) => run(C.ClipType.ctUnion, a, b, fill);
export const diff = (a, b) => (b && b.length ? run(C.ClipType.ctDifference, a, b) : a);
export const inter = (a, b) => (a.length && b.length ? run(C.ClipType.ctIntersection, a, b) : []);
export const xor = (a, b) => run(C.ClipType.ctXor, a, b);

export function offset(paths, delta, join = "miter") {
  if (!paths.length) return [];
  const co = new C.ClipperOffset(2, 0.012 * S);
  co.AddPaths(paths, join === "round" ? C.JoinType.jtRound : join === "square" ? C.JoinType.jtSquare : C.JoinType.jtMiter, C.EndType.etClosedPolygon);
  const out = new C.Paths();
  co.Execute(out, delta * S);
  return out;
}

export function offsetOpen(paths, delta) {
  const co = new C.ClipperOffset(2, 25);
  co.AddPaths(paths, C.JoinType.jtRound, C.EndType.etOpenRound);
  const out = new C.Paths();
  co.Execute(out, delta * S);
  return out;
}

// clip open polylines by a region → list of open paths
export function clipLines(lines, region) {
  if (!lines.length || !region.length) return [];
  const c = new C.Clipper();
  c.AddPaths(lines, C.PolyType.ptSubject, false);
  c.AddPaths(region, C.PolyType.ptClip, true);
  const tree = new C.PolyTree();
  c.Execute(C.ClipType.ctIntersection, tree, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
  return C.Clipper.OpenPathsFromPolyTree(tree);
}

export function clean(paths, dist = 0.005) { return C.Clipper.CleanPolygons(paths, dist * S); }
export function simplify(paths, fill = C.PolyFillType.pftNonZero) { return C.Clipper.SimplifyPolygons(paths, fill); }
export const EVENODD = C.PolyFillType.pftEvenOdd;
export const NONZERO = C.PolyFillType.pftNonZero;
export function area(p) { return C.Clipper.Area(p) / (S * S); }
export function totalArea(paths) { return paths.reduce((s, p) => s + area(p), 0); }
export function orientation(p) { return C.Clipper.Orientation(p); }
export function bounds(paths) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths) for (const q of p) { if (q.X < minX) minX = q.X; if (q.X > maxX) maxX = q.X; if (q.Y < minY) minY = q.Y; if (q.Y > maxY) maxY = q.Y; }
  return { minX, minY, maxX, maxY };
}

// parallel lines at angle (deg) covering bounds, spacing in mm → Clipper open paths
export function hatch(b, angleDeg, spacing, phase = 0) {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a), dy = Math.sin(a);
  const nx = -dy, ny = dx;
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  const R = Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2 + spacing * S;
  const sp = spacing * S;
  const out = [];
  // align lines to a global grid so layers line up
  const proj = cx * nx + cy * ny;
  const start = Math.floor((proj - R) / sp) * sp + phase * sp;
  for (let t = start; t <= proj + R; t += sp) {
    const ox = nx * t + dx * ((cx * dx + cy * dy)), oy = ny * t + dy * ((cx * dx + cy * dy));
    out.push([{ X: Math.round(ox - dx * R), Y: Math.round(oy - dy * R) }, { X: Math.round(ox + dx * R), Y: Math.round(oy + dy * R) }]);
  }
  return out;
}

// split polytree into polygons with holes
export function polyTree(paths) {
  const c = new C.Clipper();
  c.AddPaths(paths, C.PolyType.ptSubject, true);
  const tree = new C.PolyTree();
  c.Execute(C.ClipType.ctUnion, tree, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
  return C.JS.PolyTreeToExPolygons(tree);
}
