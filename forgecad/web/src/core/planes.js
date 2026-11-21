// Standard sketch planes: origin o, x-direction x, normal n (sketch y = n × x).
export const STD_PLANES = {
  XY: { o: [0, 0, 0], x: [1, 0, 0], n: [0, 0, 1] },
  XZ: { o: [0, 0, 0], x: [1, 0, 0], n: [0, -1, 0] },
  YZ: { o: [0, 0, 0], x: [0, 1, 0], n: [1, 0, 0] },
};
export const PLANE_LABELS = { XY: "Top (XY)", XZ: "Front (XZ)", YZ: "Right (YZ)" };
