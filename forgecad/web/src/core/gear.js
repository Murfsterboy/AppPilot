// Involute spur gear outline as a closed loop of segments (bezier flanks, arc tips and roots),
// counter-clockwise and centred on the origin. Segment format matches sketch/profiles.js.
export function gearSegments({ module: m = 2, teeth: z = 20, pressureAngle = 20, backlash = 0.05 }) {
  z = Math.max(6, Math.min(200, Math.round(z)));
  const pa = (pressureAngle * Math.PI) / 180;
  const rp = (m * z) / 2, rb = rp * Math.cos(pa), ra = rp + m, rf = Math.max(rp - 1.25 * m, 0.5);
  const inv = (a) => Math.tan(a) - a;
  const halfTooth = Math.PI / (2 * z) - backlash / (2 * rp);
  const base = halfTooth + inv(Math.acos(rb / rp));
  const r0 = Math.max(rb, rf);
  // involute flank in polar form: angle offset from tooth centre at radius r
  const off = (r) => base - inv(Math.acos(Math.min(1, rb / r)));
  const P = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  const pitch = (2 * Math.PI) / z;
  const segs = [];
  // fit a cubic through 4 samples of the flank (Catmull-Rom style tangents)
  const flankBezier = (c, side, up) => {
    const rs = [0, 1 / 3, 2 / 3, 1].map((t) => r0 + (ra - r0) * t);
    const pts = rs.map((r) => P(r, c + side * off(r)));
    const d0 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]];
    const d3 = [pts[3][0] - pts[2][0], pts[3][1] - pts[2][1]];
    let s = { a: pts[0], b: pts[3], c1: [pts[0][0] + d0[0], pts[0][1] + d0[1]], c2: [pts[3][0] - d3[0], pts[3][1] - d3[1]] };
    if (!up) s = { a: s.b, b: s.a, c1: s.c2, c2: s.c1 };
    return { type: "bezier", ...s };
  };
  for (let t = 0; t < z; t++) {
    const c = t * pitch;
    const right = c - off(r0), left = c + off(r0);
    // radial line from root circle to flank start (when base circle is above root)
    if (r0 > rf + 1e-6) segs.push({ type: "line", a: P(rf, right), b: P(r0, right) });
    segs.push(flankBezier(c, -1, true));
    const tipA = c - off(ra), tipB = c + off(ra);
    segs.push({ type: "arc", a: P(ra, tipA), b: P(ra, tipB), mid: P(ra, c) });
    segs.push(flankBezier(c, 1, false));
    if (r0 > rf + 1e-6) segs.push({ type: "line", a: P(r0, left), b: P(rf, left) });
    const nextRight = c + pitch - off(r0);
    segs.push({ type: "arc", a: P(rf, left), b: P(rf, nextRight), mid: P(rf, (left + nextRight) / 2) });
  }
  // stitch exact endpoints
  for (let i = 0; i < segs.length; i++) segs[i].b = segs[(i + 1) % segs.length].a;
  return { segments: segs, pitchDiameter: 2 * rp, tipDiameter: 2 * ra, rootDiameter: 2 * rf };
}
