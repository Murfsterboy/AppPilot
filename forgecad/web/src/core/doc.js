// Project document: parameters, feature history (sketches + 3D features), body appearance,
// plus print and CNC setups. Plain JSON so it can be saved, undone and sent to workers.

export function uid(prefix = "id") {
  return prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
}

export const FEATURE_LABELS = {
  sketch: "Sketch", extrude: "Extrude", revolve: "Revolve", loft: "Loft", sweep: "Sweep",
  primitive: "Primitive", hole: "Hole", fillet: "Fillet", chamfer: "Chamfer", shell: "Shell", draft: "Draft",
  offsetFace: "Offset face", deleteFace: "Delete face", mirror: "Mirror", linearPattern: "Linear pattern",
  circularPattern: "Circular pattern", move: "Move", split: "Split body", boolean: "Combine",
  import: "Imported", mesh: "Mesh", deleteBody: "Remove body",
};

export const BODY_COLORS = ["#8aa4c8", "#c8a06a", "#7fb38a", "#c27f8f", "#9b8ac8", "#c8c06a", "#6abfc8", "#b0b0b0"];

export const DEFAULT_PRINT = {
  printer: "Generic 220×220", bedX: 220, bedY: 220, bedZ: 250, origin: "corner",
  nozzle: 0.4, filament: 1.75, material: "PLA", density: 1.24,
  layerHeight: 0.2, firstLayerHeight: 0.24, adaptive: false, adaptiveMin: 0.08, adaptiveMax: 0.28,
  lineWidth: 0.44, walls: 3, topLayers: 4, bottomLayers: 3,
  infill: 20, infillPattern: "grid", outerFirst: false,
  supports: false, supportAngle: 55, supportDensity: 15, supportGap: 0.6, supportZGap: 1,
  adhesion: "skirt", brimWidth: 5, skirtDistance: 4, raftLayers: 3, raftMargin: 4,
  printSpeed: 60, outerSpeed: 35, infillSpeed: 80, firstLayerSpeed: 25, travelSpeed: 150, supportSpeed: 60,
  nozzleTemp: 210, bedTemp: 60, firstLayerNozzleTemp: 215,
  fan: 100, fanFirstLayers: 1, minLayerTime: 6,
  retract: 0.8, retractSpeed: 35, zHop: 0.2, retractMinTravel: 1.5,
  flow: 100,
  startGcode: "G28 ; home\nG1 Z5 F3000\nG92 E0",
  endGcode: "M104 S0\nM140 S0\nM107\nG91\nG1 Z10 F600\nG90\nG28 X Y\nM84",
};

export const MATERIALS = {
  PLA: { nozzleTemp: 210, firstLayerNozzleTemp: 215, bedTemp: 60, fan: 100, density: 1.24 },
  PETG: { nozzleTemp: 240, firstLayerNozzleTemp: 240, bedTemp: 80, fan: 40, density: 1.27 },
  ABS: { nozzleTemp: 245, firstLayerNozzleTemp: 245, bedTemp: 100, fan: 0, density: 1.04 },
  ASA: { nozzleTemp: 250, firstLayerNozzleTemp: 250, bedTemp: 100, fan: 20, density: 1.07 },
  TPU: { nozzleTemp: 225, firstLayerNozzleTemp: 225, bedTemp: 50, fan: 60, density: 1.21 },
  Nylon: { nozzleTemp: 255, firstLayerNozzleTemp: 255, bedTemp: 80, fan: 0, density: 1.14 },
};

export const PRINTERS = {
  "Generic 220×220": { bedX: 220, bedY: 220, bedZ: 250, origin: "corner" },
  "Small 180×180": { bedX: 180, bedY: 180, bedZ: 180, origin: "corner" },
  "Medium 256×256": { bedX: 256, bedY: 256, bedZ: 256, origin: "corner" },
  "Large 300×300": { bedX: 300, bedY: 300, bedZ: 400, origin: "corner" },
  "Delta Ø200 (centre origin)": { bedX: 200, bedY: 200, bedZ: 300, origin: "center" },
};

export const DEFAULT_TOOLS = [
  { id: "t1", number: 1, name: "6 mm flat end mill", type: "flat", diameter: 6, flutes: 2, length: 20, rpm: 18000, feed: 1200, plunge: 300 },
  { id: "t2", number: 2, name: "3 mm flat end mill", type: "flat", diameter: 3, flutes: 2, length: 12, rpm: 20000, feed: 800, plunge: 200 },
  { id: "t3", number: 3, name: "6 mm ball end mill", type: "ball", diameter: 6, flutes: 2, length: 20, rpm: 18000, feed: 1000, plunge: 250 },
  { id: "t4", number: 4, name: "3 mm ball end mill", type: "ball", diameter: 3, flutes: 2, length: 12, rpm: 20000, feed: 700, plunge: 200 },
  { id: "t5", number: 5, name: "60° V-bit", type: "vbit", diameter: 6, angle: 60, flutes: 1, length: 10, rpm: 18000, feed: 600, plunge: 150 },
  { id: "t6", number: 6, name: "3 mm drill", type: "drill", diameter: 3, angle: 118, flutes: 2, length: 25, rpm: 5000, feed: 200, plunge: 120 },
  { id: "t7", number: 7, name: "12 mm face mill", type: "flat", diameter: 12, flutes: 3, length: 15, rpm: 12000, feed: 1500, plunge: 300 },
];

export const DEFAULT_CAM = {
  stockMode: "box", stockMargin: 2, stockTopOffset: 1, stockX: 0, stockY: 0, stockZ: 0,
  origin: "top-corner", safeZ: 5, retractZ: 2, post: "grbl", coolant: false,
  bodies: null, tools: DEFAULT_TOOLS, ops: [],
};

export function newDoc(name = "Untitled") {
  return {
    format: "forgecad", version: 1, name, units: "mm",
    params: [],
    features: [],
    rollback: null,
    bodies: {},
    print: { ...DEFAULT_PRINT },
    cam: JSON.parse(JSON.stringify(DEFAULT_CAM)),
    created: Date.now(), updated: Date.now(),
  };
}

export function nextName(doc, type) {
  const base = FEATURE_LABELS[type] || type;
  let n = 1;
  const names = new Set(doc.features.map((f) => f.name));
  while (names.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

export function bodyMeta(doc, id, index = 0) {
  if (!doc.bodies[id]) doc.bodies[id] = { name: `Body ${Object.keys(doc.bodies).length + 1}`, color: BODY_COLORS[index % BODY_COLORS.length], visible: true };
  return doc.bodies[id];
}

export class History {
  constructor(limit = 80) { this.limit = limit; this.undoStack = []; this.redoStack = []; }
  push(snapshot) {
    const s = JSON.stringify(snapshot);
    if (this.undoStack[this.undoStack.length - 1] === s) return;
    this.undoStack.push(s);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
  }
  undo(current) {
    if (!this.undoStack.length) return null;
    this.redoStack.push(JSON.stringify(current));
    return JSON.parse(this.undoStack.pop());
  }
  redo(current) {
    if (!this.redoStack.length) return null;
    this.undoStack.push(JSON.stringify(current));
    return JSON.parse(this.redoStack.pop());
  }
  clear() { this.undoStack.length = 0; this.redoStack.length = 0; }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
}

export function migrate(doc) {
  doc.params = doc.params || [];
  doc.features = doc.features || [];
  doc.bodies = doc.bodies || {};
  doc.print = { ...DEFAULT_PRINT, ...(doc.print || {}) };
  doc.cam = { ...JSON.parse(JSON.stringify(DEFAULT_CAM)), ...(doc.cam || {}) };
  if (!doc.cam.tools || !doc.cam.tools.length) doc.cam.tools = JSON.parse(JSON.stringify(DEFAULT_TOOLS));
  return doc;
}
