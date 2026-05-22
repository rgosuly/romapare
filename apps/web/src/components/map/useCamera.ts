import { useRef, useState } from "react";
import type { MapViewState } from "deck.gl";
import { INTRO_START, INTRO_TARGET } from "./constants";

export type CameraHandle = {
  viewState: MapViewState;
  setViewState: React.Dispatch<React.SetStateAction<MapViewState>>;
  /** Set to true on first mouse-drag; used by the RAF loop to cancel the intro */
  userTookControlRef: React.MutableRefObject<boolean>;
  /** Wheel zoom target; the RAF loop lerps the actual zoom toward this value */
  targetZoomRef: React.MutableRefObject<number>;
  /** True while the mouse button is held — used for the grab/grabbing cursor style */
  isDraggingRef: React.MutableRefObject<boolean>;
  handlers: {
    onMouseDown:  (e: React.MouseEvent) => void;
    onMouseMove:  (e: React.MouseEvent) => void;
    onMouseUp:    () => void;
    onMouseLeave: () => void;
    onWheel:      (e: React.WheelEvent) => void;
  };
};

/**
 * Manages orbit-camera state: intro-animation handoff, drag-to-orbit,
 * and smooth mouse-wheel zoom.
 *
 * The RAF loop in Map.tsx drives the intro animation and the zoom lerp by
 * reading/writing `setViewState`, `userTookControlRef`, and `targetZoomRef`.
 */
export function useCamera(): CameraHandle {
  const [viewState, setViewState] = useState<MapViewState>(INTRO_START);

  const userTookControlRef = useRef(false);
  const targetZoomRef      = useRef<number>(INTRO_TARGET.zoom ?? 7);
  const dragOriginRef      = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef      = useRef(false);

  function onMouseDown(e: React.MouseEvent) {
    userTookControlRef.current = true;
    isDraggingRef.current      = true;
    dragOriginRef.current      = { x: e.clientX, y: e.clientY };
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragOriginRef.current) return;
    const dx = e.clientX - dragOriginRef.current.x;
    const dy = e.clientY - dragOriginRef.current.y;
    dragOriginRef.current = { x: e.clientX, y: e.clientY };

    setViewState(vs => ({
      ...vs,
      bearing: (vs.bearing ?? 0)  - dx * 0.4,
      pitch:   Math.max(5, Math.min(85, (vs.pitch ?? 60) - dy * 0.3)),
    }));
  }

  function onMouseUp() {
    dragOriginRef.current = null;
    isDraggingRef.current = false;
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    targetZoomRef.current = Math.max(7, Math.min(16, targetZoomRef.current - e.deltaY * 0.005));
  }

  return {
    viewState,
    setViewState,
    userTookControlRef,
    targetZoomRef,
    isDraggingRef,
    handlers: { onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp, onWheel },
  };
}
