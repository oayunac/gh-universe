import { useEffect, useRef, type MutableRefObject } from "react";
import type { CameraControlHandle } from "../scene/UniverseScene";

interface CameraHudProps {
  cameraControlRef: MutableRefObject<CameraControlHandle | null>;
}

// SVG geometry. viewBox is centered on origin; the circle sits at DIAL_RADIUS
// and the compass labels sit at DIAL_RADIUS + LABEL_OFFSET.
const DIAL_RADIUS = 36;
const LABEL_OFFSET = 10;
const ZOOM_STEP = 5;

// Converts a compass bearing in degrees (0 = N, clockwise) to SVG-space
// radians. SVG's +X points right, +Y points down, so N (up) is at -90°.
function bearingToSvgRad(bearingDeg: number): number {
  return ((bearingDeg - 90) * Math.PI) / 180;
}

// Small, live navigation readout. The V wedge rotates with yaw and opens to
// match the current FOV, giving the viewer a telescope-like sense of how
// much of the sky they're actually seeing. Everything updates via direct DOM
// writes so the HUD never re-renders during camera motion.
export function CameraHud({ cameraControlRef }: CameraHudProps) {
  const wedgeFillRef = useRef<SVGPathElement>(null);
  const wedgeLineRef = useRef<SVGPathElement>(null);
  const azimuthRef = useRef<HTMLSpanElement>(null);
  const pitchRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const handle = cameraControlRef.current;
      if (handle) {
        const yawDeg =
          (((handle.getYaw() * 180) / Math.PI) % 360 + 360) % 360;
        const pitchDeg = (handle.getPitch() * 180) / Math.PI;
        const fovDeg = handle.getFov();
        const halfFov = fovDeg / 2;

        const leftRad = bearingToSvgRad(yawDeg - halfFov);
        const rightRad = bearingToSvgRad(yawDeg + halfFov);
        const x1 = Math.cos(leftRad) * DIAL_RADIUS;
        const y1 = Math.sin(leftRad) * DIAL_RADIUS;
        const x2 = Math.cos(rightRad) * DIAL_RADIUS;
        const y2 = Math.sin(rightRad) * DIAL_RADIUS;

        if (wedgeFillRef.current) {
          wedgeFillRef.current.setAttribute(
            "d",
            `M 0 0 L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${DIAL_RADIUS} ${DIAL_RADIUS} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
          );
        }
        if (wedgeLineRef.current) {
          wedgeLineRef.current.setAttribute(
            "d",
            `M ${x1.toFixed(2)} ${y1.toFixed(2)} L 0 0 L ${x2.toFixed(2)} ${y2.toFixed(2)}`
          );
        }
        if (azimuthRef.current) {
          azimuthRef.current.textContent = `${Math.round(yawDeg)}°`;
        }
        if (pitchRef.current) {
          const p = Math.round(pitchDeg);
          pitchRef.current.textContent = p > 0 ? `+${p}°` : `${p}°`;
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
      <svg
        className="camera-hud-dial"
        viewBox="-54 -54 108 108"
        width="84"
        height="84"
        aria-hidden="true"
      >
        <circle
          cx="0"
          cy="0"
          r={DIAL_RADIUS}
          fill="none"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="1"
        />
        <g stroke="rgba(255, 255, 255, 0.4)" strokeWidth="1">
          <line x1="0" y1={-DIAL_RADIUS} x2="0" y2={-DIAL_RADIUS - 4} />
          <line x1={DIAL_RADIUS} y1="0" x2={DIAL_RADIUS + 4} y2="0" />
          <line x1="0" y1={DIAL_RADIUS} x2="0" y2={DIAL_RADIUS + 4} />
          <line x1={-DIAL_RADIUS} y1="0" x2={-DIAL_RADIUS - 4} y2="0" />
        </g>
        <g
          className="camera-hud-dial-labels"
          fontSize="9"
          textAnchor="middle"
          dominantBaseline="central"
        >
          <text x="0" y={-(DIAL_RADIUS + LABEL_OFFSET)}>N</text>
          <text x={DIAL_RADIUS + LABEL_OFFSET} y="0">E</text>
          <text x="0" y={DIAL_RADIUS + LABEL_OFFSET}>S</text>
          <text x={-(DIAL_RADIUS + LABEL_OFFSET)} y="0">W</text>
        </g>
        <path
          ref={wedgeFillRef}
          fill="rgba(255, 210, 122, 0.14)"
          stroke="none"
        />
        <path
          ref={wedgeLineRef}
          fill="none"
          stroke="rgba(255, 210, 122, 0.9)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="miter"
        />
        <circle cx="0" cy="0" r="1.6" fill="rgba(255, 210, 122, 0.95)" />
      </svg>

      <div className="camera-hud-angles">
        <span className="camera-hud-value" ref={azimuthRef}>0°</span>
        <span className="camera-hud-separator">·</span>
        <span className="camera-hud-value" ref={pitchRef}>0°</span>
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
