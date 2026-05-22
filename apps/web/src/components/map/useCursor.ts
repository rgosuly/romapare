import { useRef, useState, useEffect, useMemo } from "react";
import { CENTER_LNG, CENTER_LAT, GRID_W, GRID_H } from "./constants";
import type { GridPt } from "./types";

export type CursorTarget = {
  i: number; j: number;  // grid cell
  dx: number; dy: number; // terrain-space coords
};

export type CursorHandle = {
  /** Where the cursor is heading — mutated by arrow keys, read by the RAF loop */
  targetRef: React.MutableRefObject<CursorTarget | null>;
  /** Current smoothly-interpolated position — mutated by the RAF loop */
  animRef: React.MutableRefObject<{ dx: number; dy: number } | null>;
  /** World-space [lng, lat, z] of the visible dot — mutated by the RAF loop */
  dot: Float32Array;
  /** True once the cursor has been placed on the highest peak */
  ready: boolean;
};

const ARROW_DIRS: Record<string, [number, number]> = {
  ArrowLeft:  [-1,  0],
  ArrowRight: [ 1,  0],
  ArrowUp:    [ 0, -1],
  ArrowDown:  [ 0,  1],
};

/**
 * Manages the movable cursor that sits on the terrain surface.
 *
 * - Initialises at the highest-elevation grid point.
 * - Listens for arrow-key presses and updates `targetRef` (no re-render triggered).
 * - The RAF loop in Map.tsx reads `targetRef` and lerps `animRef` + `dot` toward it.
 */
export function useCursor(pts: GridPt[], indexMap: Int32Array): CursorHandle {
  const targetRef = useRef<CursorTarget | null>(null);
  const animRef   = useRef<{ dx: number; dy: number } | null>(null);
  // Stable Float32Array; mutated in-place by the RAF loop each frame
  const dot       = useMemo(() => new Float32Array([CENTER_LNG, CENTER_LAT, 0]), []);
  const [ready, setReady] = useState(false);

  // Place the cursor at the highest peak once the grid is available
  useEffect(() => {
    let maxZ = -Infinity;
    let best = pts[0];
    for (const pt of pts) {
      if (pt.baseZ > maxZ) { maxZ = pt.baseZ; best = pt; }
    }
    targetRef.current = { i: best.gridI, j: best.gridJ, dx: best.dx, dy: best.dy };
    animRef.current   = { dx: best.dx, dy: best.dy };
    setReady(true);
  }, [pts]);

  // Arrow-key handler — only mutates the target ref, never triggers a re-render
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const dir = ARROW_DIRS[e.key];
      if (!dir) return;
      e.preventDefault();

      const cur = targetRef.current;
      if (!cur) return;

      const [di, dj] = dir;
      // Step up to 20 cells until we land on a valid (non-empty) grid point
      for (let s = 1; s <= 20; s++) {
        const ni = Math.max(0, Math.min(GRID_W - 1, cur.i + di * s));
        const nj = Math.max(0, Math.min(GRID_H - 1, cur.j + dj * s));
        const idx = indexMap[nj * GRID_W + ni];
        if (idx !== -1) {
          targetRef.current = { i: ni, j: nj, dx: pts[idx].dx, dy: pts[idx].dy };
          break;
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [indexMap, pts]);

  return { targetRef, animRef, dot, ready };
}
