import { useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { SceneLabel } from "./SceneLabel";

interface StarNodeProps {
  position: [number, number, number];
  brightness: number;
  label: string;
  // Hex color for the star core. Owners get this from their spectral class
  // (see utils/spectralColor.ts); when omitted we fall back to a neutral cream
  // so non-owner uses keep the original look.
  color?: string;
  size?: number;
  onClick?: () => void;
  onDoubleClick?: () => void;
  interactive?: boolean;
  // Whether to render a transient label on hover. Default true. Host stars in
  // the system view set this to false so their parent can render a persistent
  // label below the star instead.
  hoverLabel?: boolean;
  // When provided, the star fades as the reveal ref approaches 1 — used to
  // dim non-selected sky stars while the viewer is zooming into the selected
  // system.
  revealRef?: MutableRefObject<number>;
  // When provided, a truthy value here suppresses click activation so a pan
  // or pinch gesture that happens to end over a star can't accidentally
  // select it on touch devices.
  didDragRef?: MutableRefObject<boolean>;
}

// Below this dim factor the star becomes effectively invisible; we also skip
// pointer interactions so faded stars can't hijack clicks.
const INTERACT_DIM_THRESHOLD = 0.35;

// The visible disc is intentionally small and crisp. The hit proxy is a
// larger invisible sphere that keeps hover/click usable without a glow.
const HIT_RADIUS_MULTIPLIER = 3.2;

// Hover label sizing — generous height so usernames read clearly even when a
// sky star sits at SKY_RADIUS distance from the camera.
const HOVER_LABEL_HEIGHT = 2.0;

export function StarNode({
  position,
  brightness,
  label,
  color = "#ffeccc",
  size = 0.3,
  onClick,
  onDoubleClick,
  interactive = true,
  hoverLabel = true,
  revealRef,
  didDragRef,
}: StarNodeProps) {
  const [hovered, setHovered] = useState(false);
  const coreRef = useRef<THREE.Mesh>(null);

  // Color carries spectral class only; brightness is conveyed separately via
  // opacity (below) and size (set by the caller). We deliberately don't lerp
  // toward white as brightness rises, so a bright M-class red stays red.
  const starColor = useMemo(() => new THREE.Color(color), [color]);

  useFrame((_, delta) => {
    const dim = revealRef ? Math.max(0, 1 - revealRef.current) : 1;
    if (coreRef.current) {
      const material = coreRef.current.material as THREE.MeshBasicMaterial;
      const target = (hovered ? 1 : brightness) * dim;
      material.opacity += (target - material.opacity) * Math.min(1, delta * 6);
    }
  });

  const isDimmed = () =>
    revealRef ? 1 - revealRef.current < INTERACT_DIM_THRESHOLD : false;

  const pointerProps = interactive
    ? {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          if (isDimmed()) return;
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        },
        onPointerOut: () => {
          if (!hovered) return;
          setHovered(false);
          document.body.style.cursor = "";
        },
        onClick: (e: ThreeEvent<MouseEvent>) => {
          if (isDimmed()) return;
          if (didDragRef?.current) return;
          e.stopPropagation();
          onClick?.();
        },
        onDoubleClick: (e: ThreeEvent<MouseEvent>) => {
          if (isDimmed()) return;
          if (didDragRef?.current) return;
          e.stopPropagation();
          onDoubleClick?.();
        },
      }
    : {};

  const hitRadius = size * HIT_RADIUS_MULTIPLIER;

  return (
    <group position={position} {...pointerProps}>
      <mesh ref={coreRef}>
        <sphereGeometry args={[size, 20, 20]} />
        <meshBasicMaterial color={starColor} transparent opacity={brightness} />
      </mesh>
      {interactive && (
        <mesh>
          <sphereGeometry args={[hitRadius, 12, 12]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      )}
      {hoverLabel && hovered && interactive && (
        <SceneLabel
          text={label}
          screenOffset={[0, Math.max(size, 0.4) * 2.4, 0]}
          height={HOVER_LABEL_HEIGHT}
        />
      )}
    </group>
  );
}
