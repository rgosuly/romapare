import { useMemo, useEffect, useRef, useReducer } from "react";
import DeckGL from "@deck.gl/react";

import { buildGrid, buildPosBuf, buildCrossSegs, terrainHeight } from "./map/terrain";
import { noiseZ, easeOutExpo } from "./map/noise";
import { useCursor } from "./map/useCursor";
import { useCamera } from "./map/useCamera";
import { buildLayers } from "./map/layers";
import {
  CENTER_LNG, CENTER_LAT,
  CURSOR_LERP, CURSOR_ELEVATION,
  NOISE_Z_AMPLITUDE,
  INTRO_START, INTRO_TARGET, INTRO_DURATION,
} from "./map/constants";

export default function Map() {
  // ── Static terrain data (built once) ───────────────────────────────────────
  const { pts, meshSegs, indexMap } = useMemo(() => buildGrid(), []);
  const posBuf    = useMemo(() => buildPosBuf(pts),    [pts]);
  const crossSegs = useMemo(() => buildCrossSegs(pts), [pts]);

  // ── Per-frame counter (cheap re-render trigger for deck.gl update triggers) ─
  const [frame, incFrame] = useReducer((n: number) => n + 1, 0);

  // ── Sub-system hooks ────────────────────────────────────────────────────────
  const cursor = useCursor(pts, indexMap);
  const camera = useCamera();

  // ── RAF animation loop ──────────────────────────────────────────────────────
  const rafRef   = useRef<number>(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    function tick(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const t = (ts - startRef.current) / 1000; // seconds since mount

      animateIntroCamera(t);
      updateTerrainZ(t);
      animateCursorDot(t);
      animateWheelZoom(t);

      incFrame();
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [pts, posBuf]); // eslint-disable-line react-hooks/exhaustive-deps
  // Remaining deps (camera refs, cursor refs, setViewState) are stable by identity.

  // ── Helpers called inside the RAF tick ─────────────────────────────────────

  function animateIntroCamera(t: number) {
    if (camera.userTookControlRef.current || t >= INTRO_DURATION) return;
    const p = easeOutExpo(t / INTRO_DURATION);
    camera.setViewState({
      longitude: CENTER_LNG,
      latitude:  CENTER_LAT,
      zoom:    INTRO_START.zoom    + (INTRO_TARGET.zoom    - INTRO_START.zoom)    * p,
      pitch:   (INTRO_START.pitch   ?? 5)  + ((INTRO_TARGET.pitch   ?? 58) - (INTRO_START.pitch   ?? 5))  * p,
      bearing: (INTRO_START.bearing ?? 0)  + ((INTRO_TARGET.bearing ?? 35) - (INTRO_START.bearing ?? 0))  * p,
    });
  }

  function updateTerrainZ(t: number) {
    // Only Z changes — XY stays fixed, so mesh edges can never cross
    for (let i = 0; i < pts.length; i++) {
      posBuf[i * 3 + 2] = Math.max(0, pts[i].baseZ + noiseZ(pts[i].phase, t) * NOISE_Z_AMPLITUDE);
    }
  }

  function animateCursorDot(t: number) {
    const tgt  = cursor.targetRef.current;
    const anim = cursor.animRef.current;
    if (!tgt || !anim) return;

    // Exponential lerp toward the target grid point
    anim.dx += (tgt.dx - anim.dx) * CURSOR_LERP;
    anim.dy += (tgt.dy - anim.dy) * CURSOR_LERP;

    // Place the dot on the terrain surface (same noise as surrounding points) + elevation offset
    const ph = anim.dx * 314.159 + anim.dy * 271.828;
    cursor.dot[0] = CENTER_LNG + anim.dx;
    cursor.dot[1] = CENTER_LAT + anim.dy;
    cursor.dot[2] = Math.max(0, terrainHeight(anim.dx, anim.dy) + noiseZ(ph, t) * NOISE_Z_AMPLITUDE) + CURSOR_ELEVATION;
  }

  function animateWheelZoom(t: number) {
    if (!camera.userTookControlRef.current && t < INTRO_DURATION) return;
    camera.setViewState(vs => {
      const delta = (camera.targetZoomRef.current - (vs.zoom ?? 7)) * 0.1;
      return Math.abs(delta) < 0.0001 ? vs : { ...vs, zoom: (vs.zoom ?? 7) + delta };
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const layers = buildLayers(
    pts, meshSegs, crossSegs,
    posBuf,
    cursor.animRef.current,
    cursor.dot,
    cursor.ready,
    frame,
  );

  return (
    <div
      style={{
        width: "100%", height: "100%",
        background: "#080c14",
        cursor: camera.isDraggingRef.current ? "grabbing" : "grab",
      }}
      {...camera.handlers}
    >
      <DeckGL
        viewState={camera.viewState}
        controller={false}
        layers={layers}
        style={{ width: "100%", height: "100%", pointerEvents: "none" }}
      />
    </div>
  );
}
