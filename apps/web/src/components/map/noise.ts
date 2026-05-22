import { CURSOR_COLOR } from "./constants";

/**
 * Z-only noise — XY positions stay fixed so mesh edges can never cross.
 *
 * Four overlapping sine × cosine products at different frequencies give a
 * turbulent, organic pulse without the XY drift that would tangle grid lines.
 */
export function noiseZ(phase: number, t: number): number {
  return (
    Math.sin(phase * 6.11  + t * 0.54) * Math.cos(phase * 14.53 - t * 0.82) * 0.40 +
    Math.sin(phase * 29.37 - t * 1.18) * Math.cos(phase * 8.97  + t * 0.66) * 0.30 +
    Math.sin(phase * 47.71 + t * 1.74) *                                       0.20 +
    Math.cos(phase * 73.03 - t * 2.62) *                                       0.10
  );
}

/** Exponential ease-out: fast start, asymptotic approach to 1 */
export function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Linearly blend an RGBA colour toward CURSOR_COLOR.
 * `blend` = 0 → original colour; `blend` = 1 → full purple.
 * Only called for points that are inside the cursor radius.
 */
export function blendToCursor(
  src: [number, number, number, number],
  blend: number,
): [number, number, number, number] {
  return [
    Math.round(src[0] + (CURSOR_COLOR[0] - src[0]) * blend),
    Math.round(src[1] + (CURSOR_COLOR[1] - src[1]) * blend),
    Math.round(src[2] + (CURSOR_COLOR[2] - src[2]) * blend),
    220,
  ];
}
