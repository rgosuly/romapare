import { useMemo, useEffect, useRef, useReducer, useState } from "react";
import DeckGL from "@deck.gl/react";
import { PointCloudLayer, LineLayer } from "deck.gl";
import type { MapViewState } from "deck.gl";

// Piatra Secuiului — near Rimetea, Transylvania, Romania
const CENTER_LNG = 23.669;
const CENTER_LAT = 46.451;
const MAX_HEIGHT = 40000;

const GRID_W = 443;
const GRID_H = 316;
const RANGE_W = 4.5;
const RANGE_H = 3.2;

const RIDGE_ANGLE = -Math.PI / 4;
const cosR = Math.cos(RIDGE_ANGLE);
const sinR = Math.sin(RIDGE_ANGLE);

const HEIGHT_THRESHOLD = MAX_HEIGHT * 0.11;

type Peak = { l: number; w: number; h: number; sl: number; sne: number; ssw: number };

const PEAKS: Peak[] = [
  { l: -1.40, w:  0.08, h: 0.58, sl: 0.65, sne: 0.22, ssw: 0.65 },
  { l: -0.90, w:  0.05, h: 0.78, sl: 0.70, sne: 0.24, ssw: 0.78 },
  { l: -0.40, w:  0.02, h: 0.94, sl: 0.75, sne: 0.22, ssw: 0.88 },
  { l:  0.10, w: -0.03, h: 1.00, sl: 0.75, sne: 0.22, ssw: 0.92 },
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

function terrainHeight(dx: number, dy: number): number {
  const l =  dx * cosR + dy * sinR;
  const w = -dx * sinR + dy * cosR;
  let z = 0;
  for (const p of PEAKS) {
    const dl = l - p.l;
    const dw = w - p.w;
    const sw = dw > 0 ? p.sne : p.ssw;
    z = Math.max(z,
      MAX_HEIGHT * p.h *
      Math.exp(-(dl * dl) / (2 * p.sl * p.sl) - (dw * dw) / (2 * sw * sw))
    );
  }
  // Gorge: narrow cut perpendicular to ridge at l ≈ 0.10
  const dl_gorge = l - 0.10;
  z *= (1 - 0.88 * Math.exp(-(dl_gorge * dl_gorge) / (2 * 0.12 * 0.12)));

  const rough =
    Math.sin(dx * 26 + dy * 20) * Math.cos(dy * 24 - dx * 17.5) * 0.09 +
    Math.sin(dx * 72 + dy * 56) * Math.cos(dy * 65 - dx * 47)   * 0.04;
  return Math.max(0, z * (1 + rough));
}

const STOPS: [number, number, number, number][] = [
  [0.00,   0, 255,  80],
  [0.40,  80, 255, 120],
  [0.70, 255, 180,   0],
  [1.00, 255,   0,   0],
];

function heightColor(t: number): [number, number, number, number] {
  let si = STOPS.length - 2;
  for (let s = 0; s < STOPS.length - 1; s++) {
    if (t <= STOPS[s + 1][0]) { si = s; break; }
  }
  const [t0, r0, g0, b0] = STOPS[si];
  const [t1, r1, g1, b1] = STOPS[si + 1];
  const f = Math.min(1, (t - t0) / (t1 - t0));
  return [Math.round(r0 + (r1 - r0) * f), Math.round(g0 + (g1 - g0) * f), Math.round(b0 + (b1 - b0) * f), 220];
}

function insidePolygon(px: number, py: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function generateBoundaryPolygon(n = 11): [number, number][] {
  const verts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const rx = RANGE_W * 0.5 * (0.50 + Math.random() * 0.55);
    const ry = RANGE_H * 0.5 * (0.50 + Math.random() * 0.55);
    verts.push([rx * Math.cos(angle), ry * Math.sin(angle)]);
  }
  return verts;
}

// Points carry a sequential index so segments can look them up in the position buffer
type GridPt = {
  i: number;
  dx: number;
  dy: number;
  baseZ: number;
  phase: number;
  color: [number, number, number, number];
};

// Segments reference point indices, not point objects — avoids object chasing in hot path
type Seg = { ai: number; bi: number; color: [number, number, number, number] };

function buildGrid(): { pts: GridPt[]; segs: Seg[] } {
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
      pts.push({ i: idx, dx, dy, baseZ, phase: dx * 314.159 + dy * 271.828, color: heightColor(baseZ / MAX_HEIGHT) });
    }
  }

  const segs: Seg[] = [];
  for (let j = 0; j < GRID_H; j++) {
    for (let i = 0; i < GRID_W; i++) {
      const ai = indexMap[j * GRID_W + i];
      if (ai === -1) continue;
      if (i < GRID_W - 1) { const bi = indexMap[j * GRID_W + i + 1]; if (bi !== -1) segs.push({ ai, bi, color: pts[ai].color }); }
      if (j < GRID_H - 1) { const bi = indexMap[(j + 1) * GRID_W + i]; if (bi !== -1) segs.push({ ai, bi, color: pts[ai].color }); }
    }
  }

  return { pts, segs };
}

/** Noise — all trig, called once per point per frame */
function noise3(phase: number, t: number): [number, number, number] {
  const nx =
    Math.sin(phase * 5.17  + t * 0.46) * Math.cos(phase * 11.3  - t * 0.34) * 0.40 +
    Math.sin(phase * 17.91 - t * 0.76) * Math.cos(phase * 7.43  + t * 0.58) * 0.30 +
    Math.sin(phase * 31.57 + t * 1.22) *                                       0.20 +
    Math.cos(phase * 53.11 - t * 1.94) *                                       0.10;
  const ny =
    Math.cos(phase * 7.29  - t * 0.38) * Math.sin(phase * 13.77 + t * 0.62) * 0.40 +
    Math.cos(phase * 23.43 + t * 0.94) * Math.sin(phase * 9.61  - t * 0.46) * 0.30 +
    Math.cos(phase * 41.83 - t * 1.46) *                                       0.20 +
    Math.sin(phase * 67.19 + t * 2.26) *                                       0.10;
  const nz =
    Math.sin(phase * 6.11  + t * 0.54) * Math.cos(phase * 14.53 - t * 0.82) * 0.40 +
    Math.sin(phase * 29.37 - t * 1.18) * Math.cos(phase * 8.97  + t * 0.66) * 0.30 +
    Math.sin(phase * 47.71 + t * 1.74) *                                       0.20 +
    Math.cos(phase * 73.03 - t * 2.62) *                                       0.10;
  return [nx, ny, nz];
}

// Camera start (intro) and target (final resting) positions
const INTRO_START: MapViewState  = { longitude: CENTER_LNG, latitude: CENTER_LAT, zoom: 2,  pitch: 5,  bearing: 0  };
const INTRO_TARGET: MapViewState = { longitude: CENTER_LNG, latitude: CENTER_LAT, zoom: 7,  pitch: 58, bearing: 35 };
const INTRO_DURATION = 5; // seconds

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export default function Map() {
  const [viewState, setViewState] = useState<MapViewState>(INTRO_START);
  const { pts, segs } = useMemo(() => buildGrid(), []);

  // Pre-allocated position buffer — filled once per frame, read many times by accessors
  const posBuf = useMemo(() => new Float32Array(pts.length * 3), [pts]);

  // Cheap frame counter — triggers re-render without allocating new state values
  const [frame, incFrame] = useReducer((n: number) => n + 1, 0);

  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);
  const userTookControlRef = useRef(false); // set on first drag; cancels intro
  const targetZoomRef = useRef<number>(INTRO_TARGET.zoom ?? 7); // wheel target, lerped each frame

  useEffect(() => {
    function tick(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const t = (ts - startRef.current) / 1000;

      // Intro zoom-in animation
      if (!userTookControlRef.current && t < INTRO_DURATION) {
        const p = easeOutExpo(t / INTRO_DURATION);
        setViewState({
          longitude: CENTER_LNG,
          latitude:  CENTER_LAT,
          zoom:    INTRO_START.zoom    + (INTRO_TARGET.zoom    - INTRO_START.zoom)    * p,
          pitch:   (INTRO_START.pitch   ?? 5)  + ((INTRO_TARGET.pitch   ?? 58) - (INTRO_START.pitch   ?? 5))  * p,
          bearing: (INTRO_START.bearing ?? 0)  + ((INTRO_TARGET.bearing ?? 35) - (INTRO_START.bearing ?? 0))  * p,
        });
      }

      // ONE noise3() call per point — positions written to shared buffer
      const buf = posBuf;
      for (let i = 0; i < pts.length; i++) {
        const { dx, dy, baseZ, phase } = pts[i];
        const [nx, ny, nz] = noise3(phase, t);
        buf[i * 3 + 0] = CENTER_LNG + dx + nx * 0.02;
        buf[i * 3 + 1] = CENTER_LAT + dy + ny * 0.02;
        buf[i * 3 + 2] = Math.max(0, baseZ + nz * 350);
      }

      // Smooth zoom lerp — runs after intro hands off control
      if (userTookControlRef.current || t >= INTRO_DURATION) {
        setViewState(vs => {
          const delta = (targetZoomRef.current - (vs.zoom ?? 7)) * 0.1;
          if (Math.abs(delta) < 0.0001) return vs;
          return { ...vs, zoom: (vs.zoom ?? 7) + delta };
        });
      }

      incFrame();
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [pts, posBuf]);

  // Orbit camera on drag
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  function onMouseDown(e: React.MouseEvent) {
    userTookControlRef.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragStart.current = { x: e.clientX, y: e.clientY };
    setViewState(vs => ({
      ...vs,
      bearing: (vs.bearing ?? 0) - dx * 0.4,
      pitch: Math.max(5, Math.min(85, (vs.pitch ?? 60) - dy * 0.3)),
    }));
  }
  function onMouseUp() { dragStart.current = null; }
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    targetZoomRef.current = Math.max(7, Math.min(16, targetZoomRef.current - e.deltaY * 0.005));
  }

  const buf = posBuf; // stable ref inside render

  const layers = [
    new LineLayer<Seg>({
      id: "mesh-lines",
      data: segs,
      // Accessors are now O(1) buffer reads — no trig per call
      getSourcePosition: (d) => [buf[d.ai * 3], buf[d.ai * 3 + 1], buf[d.ai * 3 + 2]],
      getTargetPosition: (d) => [buf[d.bi * 3], buf[d.bi * 3 + 1], buf[d.bi * 3 + 2]],
      getColor: (d) => d.color,
      getWidth: 1,
      updateTriggers: { getSourcePosition: frame, getTargetPosition: frame },
    }),
    new PointCloudLayer<GridPt>({
      id: "mesh-points",
      data: pts,
      getPosition: (d) => [buf[d.i * 3], buf[d.i * 3 + 1], buf[d.i * 3 + 2]],
      getColor: (d) => d.color,
      pointSize: 2,
      updateTriggers: { getPosition: frame },
    }),
  ];

  return (
    <div
      style={{ width: "100%", height: "100%", background: "#080c14", cursor: dragStart.current ? "grabbing" : "grab" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
    >
      <DeckGL
        viewState={viewState}
        controller={false}
        layers={layers}
        style={{ width: "100%", height: "100%", pointerEvents: "none" }}
      />
    </div>
  );
}
