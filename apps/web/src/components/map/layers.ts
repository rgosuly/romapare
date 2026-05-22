import { LineLayer, PointCloudLayer } from "deck.gl";
import { blendToCursor } from "./noise";
import { CURSOR_COLOR, CURSOR_RADIUS, CURSOR_RADIUS_SQ } from "./constants";
import type { GridPt, MeshSeg, CrossSeg } from "./types";

// Stable single-element array for the cursor dot layer (never re-allocated)
const CURSOR_DATUM = [0];

/**
 * Build all deck.gl layers for one render frame.
 *
 * Called inside the Map component render; `frame` is used as the update-trigger
 * value so deck.gl re-evaluates position/colour accessors every frame.
 */
export function buildLayers(
  pts: GridPt[],
  meshSegs: MeshSeg[],
  crossSegs: CrossSeg[],
  posBuf: Float32Array,
  cursorAnim: { dx: number; dy: number } | null,
  cursorDot: Float32Array,
  cursorReady: boolean,
  frame: number,
) {
  /**
   * Return `base` colour or blend it toward purple if the point is inside the
   * cursor glow radius.  Uses dist² to avoid sqrt for the common (outside) case.
   */
  function cursorColor(
    dx: number,
    dy: number,
    base: [number, number, number, number],
  ): [number, number, number, number] {
    if (!cursorAnim) return base;
    const dist2 = (dx - cursorAnim.dx) ** 2 + (dy - cursorAnim.dy) ** 2;
    if (dist2 >= CURSOR_RADIUS_SQ) return base;
    return blendToCursor(base, 1 - Math.sqrt(dist2) / CURSOR_RADIUS);
  }

  return [
    // Grid mesh — only Z moves, so edges form a planar graph and can never cross
    new LineLayer<MeshSeg>({
      id: "mesh-lines",
      data: meshSegs,
      getSourcePosition: (d) => [posBuf[d.ai * 3], posBuf[d.ai * 3 + 1], posBuf[d.ai * 3 + 2]],
      getTargetPosition: (d) => [posBuf[d.bi * 3], posBuf[d.bi * 3 + 1], posBuf[d.bi * 3 + 2]],
      getColor: (d) => cursorColor(pts[d.ai].dx, pts[d.ai].dy, d.color),
      getWidth: 1,
      updateTriggers: { getSourcePosition: frame, getTargetPosition: frame, getColor: frame },
    }),

    // × markers — XY endpoints baked in; only Z fetched from posBuf per frame
    new LineLayer<CrossSeg>({
      id: "cross-marks",
      data: crossSegs,
      getSourcePosition: (d) => [d.srcX, d.srcY, posBuf[d.ai * 3 + 2]],
      getTargetPosition: (d) => [d.tgtX, d.tgtY, posBuf[d.ai * 3 + 2]],
      getColor: (d) => cursorColor(d.dx, d.dy, d.color),
      getWidth: 2,
      updateTriggers: { getSourcePosition: frame, getTargetPosition: frame, getColor: frame },
    }),

    // Cursor dot — bright purple, floats above the surface
    new PointCloudLayer<number>({
      id: "cursor-point",
      data: cursorReady ? CURSOR_DATUM : [],
      getPosition: () => [cursorDot[0], cursorDot[1], cursorDot[2]],
      getColor: () => CURSOR_COLOR,
      pointSize: 9,
      updateTriggers: { getPosition: frame },
    }),
  ];
}
