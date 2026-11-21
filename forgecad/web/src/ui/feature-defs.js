// Data-driven definitions for the feature editing panels.
// Field types: num, seg, select, bool, sketch, sketches, regions, body, bodies, edges, faces, face1, plane, axis, sketchAxis, text, info

const OP = { key: "op", label: "Operation", type: "seg", options: [["new", "New body"], ["join", "Join"], ["cut", "Cut"], ["intersect", "Intersect"]] };
const OP_JOIN = { ...OP, options: [["join", "Join"], ["cut", "Cut"], ["new", "New body"], ["intersect", "Intersect"]] };

export const FEATURE_DEFS = {
  extrude: {
    title: "Extrude", icon: "extrude",
    help: "Pull a closed sketch profile into a solid.",
    fields: [
      { key: "sketch", label: "Sketch", type: "sketch" },
      { key: "regions", label: "Profiles", type: "regions", hint: "Tap regions to choose (default: all outer profiles)" },
      { key: "mode", label: "Direction", type: "seg", options: [["one", "One side"], ["symmetric", "Symmetric"], ["two", "Two sides"]] },
      { key: "distance", label: "Distance", type: "num", unit: "mm", step: 1 },
      { key: "distance2", label: "Other side", type: "num", unit: "mm", step: 1, when: (f) => f.mode === "two" },
      { key: "throughAll", label: "Through all", type: "bool", when: (f) => f.op === "cut" },
      { key: "flip", label: "Flip direction", type: "flip", when: (f) => f.mode !== "symmetric" },
      OP_JOIN,
      { key: "target", label: "Target body", type: "bodyOrAuto", when: (f) => f.op !== "new" },
    ],
    defaults: { mode: "one", distance: "10", distance2: "5", op: "join", regions: "auto", target: "auto" },
  },
  revolve: {
    title: "Revolve", icon: "revolve",
    help: "Spin a sketch profile around an axis.",
    fields: [
      { key: "sketch", label: "Sketch", type: "sketch" },
      { key: "regions", label: "Profiles", type: "regions" },
      { key: "axis", label: "Axis", type: "sketchAxis" },
      { key: "angle", label: "Angle", type: "num", unit: "°", step: 15 },
      OP_JOIN,
      { key: "target", label: "Target body", type: "bodyOrAuto", when: (f) => f.op !== "new" },
    ],
    defaults: { axis: "y", angle: "360", op: "join", regions: "auto", target: "auto" },
  },
  loft: {
    title: "Loft", icon: "loft",
    help: "Blend between two or more profiles on different planes (pick them in order).",
    fields: [
      { key: "sketches", label: "Profiles (in order)", type: "sketches" },
      { key: "ruled", label: "Straight sides", type: "bool" },
      OP_JOIN,
    ],
    defaults: { sketches: [], ruled: false, op: "join" },
  },
  sweep: {
    title: "Sweep", icon: "sweep",
    help: "Move a profile along a path sketch (draw the profile where the path starts).",
    fields: [
      { key: "sketch", label: "Profile sketch", type: "sketch" },
      { key: "regions", label: "Profiles", type: "regions" },
      { key: "path", label: "Path sketch", type: "sketch" },
      { key: "frenet", label: "Follow path twist", type: "bool" },
      OP_JOIN,
    ],
    defaults: { frenet: true, op: "join", regions: "auto" },
  },
  primitive: {
    title: "Primitive", icon: "box",
    fields: [
      { key: "shape", label: "Shape", type: "select", options: [["box", "Box"], ["cylinder", "Cylinder"], ["sphere", "Sphere"], ["cone", "Cone"], ["torus", "Torus"], ["gear", "Spur gear"]] },
      { key: "w", label: "Width (X)", type: "num", unit: "mm", step: 1, when: (f) => f.shape === "box" },
      { key: "d", label: "Depth (Y)", type: "num", unit: "mm", step: 1, when: (f) => f.shape === "box" },
      { key: "h", label: "Height", type: "num", unit: "mm", step: 1, when: (f) => ["box", "cylinder", "cone", "gear"].includes(f.shape) },
      { key: "r", label: "Radius", type: "num", unit: "mm", step: 1, when: (f) => ["cylinder", "sphere", "cone"].includes(f.shape) },
      { key: "r2", label: "Top radius", type: "num", unit: "mm", step: 1, when: (f) => f.shape === "cone" },
      { key: "r", label: "Ring radius", type: "num", unit: "mm", step: 1, when: (f) => f.shape === "torus", alias: true },
      { key: "r2", label: "Tube radius", type: "num", unit: "mm", step: 0.5, when: (f) => f.shape === "torus", alias: true },
      { key: "module", label: "Module", type: "num", unit: "mm", step: 0.25, when: (f) => f.shape === "gear", hint: "Tooth size (pitch Ø = module × teeth)" },
      { key: "teeth", label: "Teeth", type: "num", unit: "", step: 1, when: (f) => f.shape === "gear" },
      { key: "pressure", label: "Pressure angle", type: "num", unit: "°", when: (f) => f.shape === "gear" },
      { key: "bore", label: "Bore Ø", type: "num", unit: "mm", step: 0.5, when: (f) => f.shape === "gear" },
      { key: "x", label: "Position X", type: "num", unit: "mm", step: 5, group: "Placement" },
      { key: "y", label: "Position Y", type: "num", unit: "mm", step: 5 },
      { key: "z", label: "Position Z", type: "num", unit: "mm", step: 5 },
      { key: "rx", label: "Rotate X", type: "num", unit: "°", step: 15 },
      { key: "ry", label: "Rotate Y", type: "num", unit: "°", step: 15 },
      OP,
    ],
    defaults: { shape: "box", w: "40", d: "30", h: "20", r: "10", r2: "4", module: "2", teeth: "20", pressure: "20", bore: "5", x: "0", y: "0", z: "0", rx: "0", ry: "0", op: "new" },
  },
  hole: {
    title: "Hole", icon: "hole",
    help: "Tap a flat face where the hole goes. Tap more spots to add more holes.",
    fields: [
      { key: "at", label: "Position", type: "face1" },
      { key: "kind", label: "Type", type: "seg", options: [["simple", "Simple"], ["counterbore", "Counterbore"], ["countersink", "Countersink"]] },
      { key: "diameter", label: "Diameter", type: "num", unit: "mm", step: 0.5 },
      { key: "through", label: "Through all", type: "bool" },
      { key: "depth", label: "Depth", type: "num", unit: "mm", step: 1, when: (f) => !f.through },
      { key: "cbDiameter", label: "Head Ø", type: "num", unit: "mm", step: 0.5, when: (f) => f.kind !== "simple" },
      { key: "cbDepth", label: "Head depth", type: "num", unit: "mm", step: 0.5, when: (f) => f.kind === "counterbore" },
      { key: "csAngle", label: "Head angle", type: "num", unit: "°", when: (f) => f.kind === "countersink" },
      { key: "tip", label: "Drill point", type: "bool", when: (f) => !f.through },
    ],
    defaults: { kind: "simple", diameter: "5", depth: "10", through: true, cbDiameter: "9", cbDepth: "3", csAngle: "90", tip: true, points: [] },
  },
  fillet: {
    title: "Fillet", icon: "fillet", help: "Tap edges to round them.",
    fields: [{ key: "edges", label: "Edges", type: "edges" }, { key: "radius", label: "Radius", type: "num", unit: "mm", step: 0.5 }],
    defaults: { radius: "2", edges: [] }, picksOnInput: true,
  },
  chamfer: {
    title: "Chamfer", icon: "chamfer", help: "Tap edges to bevel them.",
    fields: [{ key: "edges", label: "Edges", type: "edges" }, { key: "distance", label: "Distance", type: "num", unit: "mm", step: 0.5 }],
    defaults: { distance: "1", edges: [] }, picksOnInput: true,
  },
  shell: {
    title: "Shell", icon: "shell", help: "Tap the faces to open; the rest becomes a wall.",
    fields: [{ key: "faces", label: "Open faces", type: "faces" }, { key: "thickness", label: "Wall", type: "num", unit: "mm", step: 0.5 }, { key: "outside", label: "Wall outside", type: "bool" }],
    defaults: { thickness: "2", faces: [], outside: false }, picksOnInput: true,
  },
  draft: {
    title: "Draft", icon: "draft", help: "Tilt side faces (for moulding). Faces stay put where they meet the neutral plane.",
    fields: [{ key: "faces", label: "Faces", type: "faces" }, { key: "angle", label: "Angle", type: "num", unit: "°", step: 1 }, { key: "plane", label: "Neutral plane", type: "plane" }],
    defaults: { angle: "3", faces: [], plane: "XY" }, picksOnInput: true,
  },
  offsetFace: {
    title: "Offset face", icon: "offsetFace", help: "Push or pull flat faces (negative removes material).",
    fields: [{ key: "faces", label: "Faces", type: "faces" }, { key: "distance", label: "Distance", type: "num", unit: "mm", step: 1 }, { key: "direction", label: "Direction", type: "seg", options: [["normal", "Normal"], ["x", "X"], ["y", "Y"], ["z", "Z"]] }],
    defaults: { distance: "2", faces: [], direction: "normal" }, picksOnInput: true,
  },
  deleteFace: {
    title: "Delete face", icon: "deleteFace", help: "Remove faces (e.g. a hole or pocket) and heal the gap.",
    fields: [{ key: "faces", label: "Faces", type: "faces" }],
    defaults: { faces: [] }, picksOnInput: true,
  },
  mirror: {
    title: "Mirror", icon: "mirror",
    fields: [{ key: "body", label: "Body", type: "body" }, { key: "plane", label: "Mirror plane", type: "plane" }, { key: "op", label: "Result", type: "seg", options: [["join", "Join"], ["new", "New body"]] }],
    defaults: { plane: "YZ", op: "join" },
  },
  linearPattern: {
    title: "Linear pattern", icon: "linearPattern",
    fields: [
      { key: "body", label: "Body", type: "body" },
      { key: "dir", label: "Direction", type: "axis" }, { key: "count", label: "Count", type: "num", unit: "", step: 1, min: 1 }, { key: "spacing", label: "Spacing", type: "num", unit: "mm", step: 1 },
      { key: "dir2", label: "2nd direction", type: "seg", options: [["none", "None"], ["x", "X"], ["y", "Y"], ["z", "Z"]] },
      { key: "count2", label: "Count", type: "num", unit: "", step: 1, min: 1, when: (f) => f.dir2 && f.dir2 !== "none" },
      { key: "spacing2", label: "Spacing", type: "num", unit: "mm", step: 1, when: (f) => f.dir2 && f.dir2 !== "none" },
    ],
    defaults: { dir: "x", count: "3", spacing: "20", dir2: "none", count2: "2", spacing2: "20" },
  },
  circularPattern: {
    title: "Circular pattern", icon: "circularPattern",
    fields: [{ key: "body", label: "Body", type: "body" }, { key: "axis", label: "Axis", type: "axis" }, { key: "count", label: "Count", type: "num", unit: "", step: 1, min: 1 }, { key: "angle", label: "Total angle", type: "num", unit: "°", step: 15 }],
    defaults: { axis: "z", count: "6", angle: "360" },
  },
  move: {
    title: "Move / Align", icon: "move",
    fields: [
      { key: "body", label: "Body", type: "body" },
      { key: "copy", label: "Make a copy", type: "bool" },
      { key: "dx", label: "Move X", type: "num", unit: "mm", step: 1, group: "Translate" }, { key: "dy", label: "Move Y", type: "num", unit: "mm", step: 1 }, { key: "dz", label: "Move Z", type: "num", unit: "mm", step: 1 },
      { key: "rx", label: "Rotate X", type: "num", unit: "°", step: 15, group: "Rotate (about centre point)" }, { key: "ry", label: "Rotate Y", type: "num", unit: "°", step: 15 }, { key: "rz", label: "Rotate Z", type: "num", unit: "°", step: 15 },
      { key: "cx", label: "Centre X", type: "num", unit: "mm" }, { key: "cy", label: "Centre Y", type: "num", unit: "mm" }, { key: "cz", label: "Centre Z", type: "num", unit: "mm" },
      { key: "scale", label: "Scale", type: "num", unit: "×", step: 0.1 },
      { key: "align", label: "Align to body", type: "bool", group: "Align" },
      { key: "alignTo", label: "Reference body", type: "body", when: (f) => f.align },
      { key: "alignX", label: "X", type: "seg", options: [["none", "–"], ["min", "Min"], ["center", "Mid"], ["max", "Max"]], when: (f) => f.align },
      { key: "alignY", label: "Y", type: "seg", options: [["none", "–"], ["min", "Min"], ["center", "Mid"], ["max", "Max"]], when: (f) => f.align },
      { key: "alignZ", label: "Z", type: "seg", options: [["none", "–"], ["min", "Min"], ["center", "Mid"], ["max", "Max"], ["ontop", "On top"]], when: (f) => f.align },
    ],
    defaults: { dx: "0", dy: "0", dz: "0", rx: "0", ry: "0", rz: "0", cx: "0", cy: "0", cz: "0", scale: "1", copy: false, align: false, alignX: "none", alignY: "none", alignZ: "none" },
  },
  split: {
    title: "Split body", icon: "split",
    fields: [{ key: "body", label: "Body", type: "body" }, { key: "plane", label: "Split plane", type: "plane" }, { key: "offset", label: "Offset", type: "num", unit: "mm", step: 1 }],
    defaults: { plane: "XY", offset: "0" },
  },
  boolean: {
    title: "Combine", icon: "combine",
    fields: [{ key: "target", label: "Target body", type: "body" }, { key: "tools", label: "Tool bodies", type: "bodies" }, { key: "op", label: "Operation", type: "seg", options: [["union", "Join"], ["cut", "Cut"], ["intersect", "Intersect"]] }, { key: "keepTools", label: "Keep tools", type: "bool" }],
    defaults: { op: "union", tools: [], keepTools: false },
  },
};

export const DESIGN_TOOLS = [
  { cat: "Create", items: [
    { id: "sketch", label: "Sketch", icon: "sketch" }, { id: "extrude", label: "Extrude", icon: "extrude" }, { id: "revolve", label: "Revolve", icon: "revolve" },
    { id: "loft", label: "Loft", icon: "loft" }, { id: "sweep", label: "Sweep", icon: "sweep" }, { id: "hole", label: "Hole", icon: "hole" },
    { id: "prim:box", label: "Box", icon: "box" }, { id: "prim:cylinder", label: "Cylinder", icon: "cylinder" }, { id: "prim:sphere", label: "Sphere", icon: "sphere" },
    { id: "prim:cone", label: "Cone", icon: "cone" }, { id: "prim:torus", label: "Torus", icon: "torus" }, { id: "prim:gear", label: "Gear", icon: "gear" },
  ] },
  { cat: "Modify", items: [
    { id: "fillet", label: "Fillet", icon: "fillet" }, { id: "chamfer", label: "Chamfer", icon: "chamfer" }, { id: "shell", label: "Shell", icon: "shell" },
    { id: "draft", label: "Draft", icon: "draft" }, { id: "offsetFace", label: "Offset face", icon: "offsetFace" }, { id: "deleteFace", label: "Delete face", icon: "deleteFace" },
    { id: "move", label: "Move", icon: "move" }, { id: "split", label: "Split", icon: "split" }, { id: "boolean", label: "Combine", icon: "combine" },
  ] },
  { cat: "Pattern", items: [
    { id: "mirror", label: "Mirror", icon: "mirror" }, { id: "linearPattern", label: "Linear", icon: "linearPattern" }, { id: "circularPattern", label: "Circular", icon: "circularPattern" },
  ] },
  { cat: "Inspect", items: [
    { id: "measure", label: "Measure", icon: "measure" }, { id: "section", label: "Section", icon: "section" }, { id: "properties", label: "Properties", icon: "info" },
    { id: "params", label: "Parameters", icon: "params" },
  ] },
];
