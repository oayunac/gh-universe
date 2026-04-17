import { useEffect, useRef, type MutableRefObject } from "react";
import type { CameraControlHandle } from "../scene/UniverseScene";

interface CameraHudProps {
  cameraControlRef: MutableRefObject<CameraControlHandle | null>;
}

// Yaw=0 aims at world -Z (north); +π/2 aims at +X (east). Matches the look
// direction construction inside UniverseScene.
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
const ZOOM_STEP = 5;

// Small, live navigation readout. Angles are read every frame from the scene
// handle and written imperatively to the DOM so the HUD never causes a React
// re-render during camera motion.
export function CameraHud({ cameraControlRef }: CameraHudProps) {
  const directionRef = useRef<HTMLSpanElement>(null);
  const azimuthRef = useRef<HTMLSpanElement>(null);
  const pitchRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const handle = cameraControlRef.current;
      if (handle) {
        const yawRad = handle.getYaw();
        const pitchRad = handle.getPitch();
        const azimuthDeg =
          (((yawRad * 180) / Math.PI) % 360 + 360) % 360;
        const pitchDeg = (pitchRad * 180) / Math.PI;
        const compassIdx = Math.round(azimuthDeg / 45) % 8;
        if (directionRef.current) {
          directionRef.current.textContent = COMPASS[compassIdx];
        }
        if (azimuthRef.current) {
          azimuthRef.current.textContent = `${Math.round(azimuthDeg)}°`;
        }
        if (pitchRef.current) {
          const rounded = Math.round(pitchDeg);
          pitchRef.current.textContent =
            rounded > 0 ? `+${rounded}°` : `${rounded}°`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cameraControlRef]);

  const zoomIn = () => cameraControlRef.current?.zoomBy(-ZOOM_STEP);
  const zoomOut = () => cameraControlRef.current?.zoomBy(ZOOM_STEP);

  return (
    <div className="camera-hud" aria-label="Camera HUD">
      <div className="camera-hud-row">
        <span className="camera-hud-direction" ref={directionRef}>
          N
        </span>
        <span className="camera-hud-value" ref={azimuthRef}>
          0°
        </span>
      </div>
      <div className="camera-hud-row">
        <span className="camera-hud-label">Pitch</span>
        <span className="camera-hud-value" ref={pitchRef}>
          0°
        </span>
      </div>
      <div className="camera-hud-zoom">
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={zoomOut}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in"
          onClick={zoomIn}
        >
          +
        </button>
      </div>
    </div>
  );
}
