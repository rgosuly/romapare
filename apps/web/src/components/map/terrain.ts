import {
  CENTER_LNG, CENTER_LAT,
  MAX_HEIGHT, GRID_W, GRID_H, RANGE_W, RANGE_H,
  cosR, sinR, HEIGHT_THRESHOLD,
  PEAKS, COLOR_STOPS, CROSS_HALF,
} from "./constants";
import type { GridPt, MeshSeg, CrossSeg } from "./types";

// ── Height field ──────────────────────────────────────────────────────────────

/**
 * Sum of asymmetric Gaussian lobes rotated to the ridge axis,
 * minus a gorge cut, plus high-frequency roughness.
 */
export function terrainHeight(dx: number, dy: number): number {
  // Rotate to ridge-aligned coordinates
  const l =  dx * cosR + dy * sinR;
  const w = -dx * sinR + dy * cosR;

  // Accumulate peak contributions
  let z = 0;
  for (const p of PEAKS) {
    const dl = l - p.l;
    const dw = w - p.w;
    // Asymmetric sigma: steeper on the NE cliff, gentler on the SW slope
    const sw = dw > 0 ? p.sne : p.ssw;
    z = Math.max(
      z,
      MAX_HEIGHT * p.h *
        Math.exp(-(dl * dl) / (2 * p.sl * p.sl) - (dw * dw) / (2 * sw * sw)),
    );
  }

  // Gorge — narrow cut perpendicular to the ridge near the main peak
  const dl_gorge = l - 0.10;
  z *= 1 - 0.88 * Math.exp(-(dl_gorge * dl_gorge) / (2 * 0.12 * 0.12));

  // Small-scale roughness (two octaves of sine noise)
  const rough =
    Math.sin(dx * 26 + dy * 20) * Math.cos(dy * 24 - dx * 17.5) * 0.09 +
    Math.sin(dx * 72 + dy * 56) * Math.cos(dy * 65 - dx * 47)   * 0.04;

  return Math.max(0, z * (1 + rough));
}

// ── Colour mapping ────────────────────────────────────────────────────────────

/** Interpolate a colour from COLOR_STOPS given a normalised height t ∈ [0, 1] */
export function heightColor(t: number): [number, number, number, number] {
  let si = COLOR_STOPS.length - 2;
  for (let s = 0; s < COLOR_STOPS.length - 1; s++) {
    if (t <= COLOR_STOPS[s + 1][0]) { si = s; break; }
  }
  const [t0, r0, g0, b0] = COLOR_STOPS[si];
  const [t1, r1, g1, b1] = COLOR_STOPS[si + 1];
  const f = Math.min(1, (t - t0) / (t1 - t0));
  return [
    Math.round(r0 + (r1 - r0) * f),
    Math.round(g0 + (g1 - g0) * f),
    Math.round(b0 + (b1 - b0) * f),
    220,
  ];
}

// ── Boundary helpers ──────────────────────────────────────────────────────────

function insidePolygon(px: number, py: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Random convex-ish polygon that clips the grid to an organic mountain outline */
function generateBoundaryPolygon(vertexCount = 11): [number, number][] {
  const verts: [number, number][] = [];
  for (let i = 0; i < vertexCount; i++) {
    const angle = (i / vertexCount) * Math.PI * 2;
    const rx = RANGE_W * 0.5 * (0.50 + Math.random() * 0.55);
    const ry = RANGE_H * 0.5 * (0.50 + Math.random() * 0.55);
    verts.push([rx * Math.cos(angle), ry * Math.sin(angle)]);
  }
  return verts;
}

// ── Grid builders ─────────────────────────────────────────────────────────────

export type GridData = {
  pts: GridPt[];
  meshSegs: MeshSeg[];
  indexMap: Int32Array; // GRID_W × GRID_H → sequential pt index, or -1
};

/**
 * Sample the terrain on a regular grid, clip to the boundary polygon,
 * cull sub-threshold points, and build mesh-edge segments.
 */
export function buildGrid(): GridData {
  const boundary = generateBoundaryPolygon();
  const indexMap = new Int32Array(GRID_W * GRID_H).fill(-1);
  const pts: GridPt[] = [];

  for (let j = 0; j < GRID_H; j++) {
    for (let i = 0; i < GRID_W; i++) {
      const dx = (i / (GRID_W - 1) - 0.5) * RANGE_W;
      const dy = (j / (GRID_H - 1) - 0.5) * RANGE_H;
      const baseZ = terrainHeight(dx, dy);

      if (baseZ < HEIGHT_THRESHOLD || !insidePolygon(dx, dy, boundary)) continue;

      const idx = pts.length;
      indexMap[j * GRID_W + i] = idx;
      pts.push({
        i: idx, gridI: i, gridJ: j,
        dx, dy, baseZ,
        phase: dx * 314.159 + dy * 271.828,
        color: heightColor(baseZ / MAX_HEIGHT),
      });
    }
  }

  // Connect each point to its right and bottom grid-neighbours
  const meshSegs: MeshSeg[] = [];
  for (let j = 0; j < GRID_H; j++) {
    for (let i = 0; i < GRID_W; i++) {
      const ai = indexMap[j * GRID_W + i];
      if (ai === -1) continue;

      if (i < GRID_W - 1) {
        const bi = indexMap[j * GRID_W + i + 1];
        if (bi !== -1) meshSegs.push({ ai, bi, color: pts[ai].color });
      }
      if (j < GRID_H - 1) {
        const bi = indexMap[(j + 1) * GRID_W + i];
        if (bi !== -1) meshSegs.push({ ai, bi, color: pts[ai].color });
      }
    }
  }

  return { pts, meshSegs, indexMap };
}

/**
 * Pre-allocate the position buffer with fixed XY values.
 * Only the Z channel (index 2 of each triple) is updated each animation frame,
 * which guarantees mesh edges can never cross.
 */
export function buildPosBuf(pts: GridPt[]): Float32Array {
  const buf = new Float32Array(pts.length * 3);
  for (let i = 0; i < pts.length; i++) {
    buf[i * 3]     = CENTER_LNG + pts[i].dx; // fixed
    buf[i * 3 + 1] = CENTER_LAT + pts[i].dy; // fixed
    buf[i * 3 + 2] = pts[i].baseZ;           // overwritten each frame
  }
  return buf;
}

/**
 * Build the × marker segment pairs.
 * Endpoint XY is baked in at construction; only Z is fetched from posBuf per frame.
 * Each point produces two CrossSegs (the two diagonals of the ×).
 */
export function buildCrossSegs(pts: GridPt[]): CrossSeg[] {
  const result: CrossSeg[] = new Array(pts.length * 2);
  for (let k = 0; k < pts.length; k++) {
    const pt  = pts[k];
    const lng = CENTER_LNG + pt.dx;
    const lat = CENTER_LAT + pt.dy;
    const base = { ai: pt.i, dx: pt.dx, dy: pt.dy, color: pt.color };
    result[k * 2]     = { ...base, srcX: lng - CROSS_HALF, srcY: lat - CROSS_HALF, tgtX: lng + CROSS_HALF, tgtY: lat + CROSS_HALF }; // ↗
    result[k * 2 + 1] = { ...base, srcX: lng - CROSS_HALF, srcY: lat + CROSS_HALF, tgtX: lng + CROSS_HALF, tgtY: lat - CROSS_HALF }; // ↘
  }
  return result;
}
