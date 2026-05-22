/** One Gaussian lobe of the mountain ridge */
export type Peak = {
  l: number;   // along-ridge offset
  w: number;   // across-ridge offset
  h: number;   // relative height (0–1)
  sl: number;  // along-ridge sigma
  sne: number; // across-ridge sigma, NE (cliff) side
  ssw: number; // across-ridge sigma, SW (slope) side
};

/** A visible terrain vertex */
export type GridPt = {
  i: number;     // sequential position-buffer index
  gridI: number; // grid column
  gridJ: number; // grid row
  dx: number;    // terrain-space x offset (degrees)
  dy: number;    // terrain-space y offset (degrees)
  baseZ: number; // static elevation
  phase: number; // noise phase seed
  color: [number, number, number, number];
};

/** A grid-neighbour edge drawn as a line segment */
export type MeshSeg = {
  ai: number;
  bi: number;
  color: [number, number, number, number];
};

/** One arm of the × marker at a grid vertex.
 *  XY endpoints are pre-computed; only Z is read from the position buffer per frame. */
export type CrossSeg = {
  ai: number;    // posBuf index (used for Z lookup)
  dx: number;    // terrain x of the parent point (for cursor-distance check)
  dy: number;    // terrain y of the parent point
  srcX: number;  // pre-computed world lng
  srcY: number;  // pre-computed world lat
  tgtX: number;
  tgtY: number;
  color: [number, number, number, number];
};
