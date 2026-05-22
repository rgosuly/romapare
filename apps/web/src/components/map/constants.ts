import type { MapViewState } from "deck.gl";
import type { Peak } from "./types";

// ── Geography ─────────────────────────────────────────────────────────────────
// Piatra Secuiului, near Rimetea, Transylvania, Romania
export const CENTER_LNG = 23.669;
export const CENTER_LAT = 46.451;

// ── Terrain generation ────────────────────────────────────────────────────────
export const MAX_HEIGHT = 40_000;

// Grid resolution — more cells = more points and detail
export const GRID_W = 443;
export const GRID_H = 316;

// Geographic spread of the mountain range (degrees)
export const RANGE_W = 4.5; // ~320 km east–west
export const RANGE_H = 3.2; // ~360 km north–south

// The ridge runs NW → SE at 45°
export const RIDGE_ANGLE = -Math.PI / 4;
export const cosR = Math.cos(RIDGE_ANGLE);
export const sinR = Math.sin(RIDGE_ANGLE);

// Points below this elevation are culled from the grid
export const HEIGHT_THRESHOLD = MAX_HEIGHT * 0.11;

// ── Visual ────────────────────────────────────────────────────────────────────
// Height-based colour gradient: [normalised-height, r, g, b]
export const COLOR_STOPS: [number, number, number, number][] = [
  [0.00,   0, 255,  80], // neon green (low)
  [0.40,  80, 255, 120], // lime
  [0.70, 255, 180,   0], // amber
  [1.00, 255,   0,   0], // red (peak)
];

// × marker half-size in degrees.  Grid step ≈ 0.010 °, so 0.004 ° fills ~40 % of a cell.
export const CROSS_HALF = 0.004;

// ── Noise animation ───────────────────────────────────────────────────────────
// Amplitude of the Z-only noise (metres equivalent)
export const NOISE_Z_AMPLITUDE = 350;

// ── Cursor ────────────────────────────────────────────────────────────────────
export const CURSOR_COLOR: [number, number, number, number] = [200, 0, 255, 255];

// Glow radius in terrain-coordinate degrees (total range is 4.5 × 3.2)
export const CURSOR_RADIUS    = 0.15;
export const CURSOR_RADIUS_SQ = CURSOR_RADIUS ** 2;

// Exponential-lerp speed per frame (~95 % closed in 24 frames at 60 fps)
export const CURSOR_LERP = 0.12;

// How far above the terrain surface the cursor dot floats
export const CURSOR_ELEVATION = 400;

// ── Camera intro animation ────────────────────────────────────────────────────
export const INTRO_START: MapViewState = {
  longitude: CENTER_LNG, latitude: CENTER_LAT,
  zoom: 2, pitch: 5, bearing: 0,
};
export const INTRO_TARGET: MapViewState = {
  longitude: CENTER_LNG, latitude: CENTER_LAT,
  zoom: 7, pitch: 58, bearing: 35,
};
export const INTRO_DURATION = 5; // seconds

// ── Mountain peaks ────────────────────────────────────────────────────────────
// Each peak is a Gaussian lobe; asymmetric sigmas produce the steep NE cliff
// and the gentler SW slope characteristic of Piatra Secuiului.
export const PEAKS: Peak[] = [
  { l: -1.40, w:  0.08, h: 0.58, sl: 0.65, sne: 0.22, ssw: 0.65 },
  { l: -0.90, w:  0.05, h: 0.78, sl: 0.70, sne: 0.24, ssw: 0.78 },
  { l: -0.40, w:  0.02, h: 0.94, sl: 0.75, sne: 0.22, ssw: 0.88 },
  { l:  0.10, w: -0.03, h: 1.00, sl: 0.75, sne: 0.22, ssw: 0.92 }, // highest point
  { l:  0.60, w: -0.06, h: 0.91, sl: 0.72, sne: 0.24, ssw: 0.86 },
  { l:  1.10, w: -0.10, h: 0.75, sl: 0.68, sne: 0.24, ssw: 0.76 },
  { l:  1.58, w: -0.14, h: 0.58, sl: 0.62, sne: 0.22, ssw: 0.65 },
  { l:  1.98, w: -0.17, h: 0.42, sl: 0.55, sne: 0.20, ssw: 0.55 },
  { l: -0.65, w:  0.03, h: 0.70, sl: 0.92, sne: 0.22, ssw: 0.76 },
  { l:  0.35, w: -0.05, h: 0.85, sl: 0.92, sne: 0.22, ssw: 0.82 },
  { l:  0.85, w: -0.08, h: 0.73, sl: 0.88, sne: 0.24, ssw: 0.72 },
  { l: -0.15, w:  1.12, h: 0.34, sl: 1.55, sne: 0.72, ssw: 0.72 },
  { l:  0.85, w:  1.18, h: 0.27, sl: 1.35, sne: 0.65, ssw: 0.65 },
  { l: -0.55, w: -0.98, h: 0.25, sl: 1.85, sne: 0.92, ssw: 0.92 },
  { l:  0.65, w: -0.98, h: 0.23, sl: 1.72, sne: 0.86, ssw: 0.86 },
  { l: -2.50, w: -0.20, h: 0.19, sl: 1.00, sne: 0.70, ssw: 0.70 },
  { l:  2.85, w:  0.12, h: 0.17, sl: 1.00, sne: 0.65, ssw: 0.65 },
];
