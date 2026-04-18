import { useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Repo } from "../types/universe";
import type { PlanetLayout } from "../utils/layout";
import { repoBrightness } from "../utils/brightness";
import { SelectionRing } from "./SelectionRing";
import { SceneLabel } from "./SceneLabel";

interface PlanetNodeProps {
  repo: Repo;
  layout: PlanetLayout;
  onHoverChange: (id: string | null) => void;
  hovered: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  revealRef: MutableRefObject<number>;
  // Shared drag/pinch suppression flag. When true at pointerup, the planet
  // treats the event as a trailing gesture instead of a tap.
  didDragRef?: MutableRefObject<boolean>;
}

// Planets only become interactive once the system has revealed enough — this
// prevents accidental hovers/clicks while the star is still far away.
const INTERACT_THRESHOLD = 0.35;
const HIT_RADIUS_MULTIPLIER = 2.6;

export function PlanetNode({
  repo,
  layout,
  onHoverChange,
  hovered,
  selected,
  onSelect,
  revealRef,
  didDragRef,
}: PlanetNodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [localHover, setLocalHover] = useState(false);

  const brightness = useMemo(() => repoBrightness(repo.stars), [repo.stars]);
  const color = useMemo(() => {
    const base = new THREE.Color("#7da9ff");
    return base.lerp(new THREE.Color("#ffffff"), brightness * 0.5);
  }, [brightness]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const angle = layout.angle + t * layout.speed;
    const reveal = revealRef.current;

    if (groupRef.current) {
      groupRef.current.position.set(
        Math.cos(angle) * layout.radius,
        0,
        Math.sin(angle) * layout.radius
      );
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.003;
      const material = meshRef.current.material as THREE.MeshBasicMaterial;
      const base = hovered || localHover || selected ? 1 : brightness;
      const target = base * reveal;
      material.opacity += (target - material.opacity) * 0.15;
    }
  });

  // Kept strictly smaller than the host-star size so a bright planet can never
  // out-scale a dim-owner's star.
  const size = 0.08 + brightness * 0.12;
  const hitRadius = size * HIT_RADIUS_MULTIPLIER;

  return (
    <group rotation={[layout.tilt, 0, 0]}>
      <group ref={groupRef}>
        <mesh
          ref={meshRef}
          onPointerOver={(e) => {
            if (revealRef.current < INTERACT_THRESHOLD) return;
            e.stopPropagation();
            setLocalHover(true);
            onHoverChange(repo.id);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            if (!localHover) return;
            setLocalHover(false);
            onHoverChange(null);
            document.body.style.cursor = "";
          }}
          onClick={(e) => {
            if (revealRef.current < INTERACT_THRESHOLD) return;
            if (didDragRef?.current) return;
            e.stopPropagation();
            // First click: select and center. Second click on the already
            // selected planet opens the repo on GitHub.
            if (selected) {
              window.open(repo.url, "_blank", "noopener,noreferrer");
            } else {
              onSelect(repo.id);
            }
          }}
        >
          <sphereGeometry args={[size, 20, 20]} />
          <meshBasicMaterial color={color} transparent opacity={0} />
        </mesh>
        <mesh>
          <sphereGeometry args={[hitRadius, 10, 10]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {selected && (
          // Selection marker fades in with the system reveal so it can't
          // appear before the planet itself does.
          <SelectionRing radius={size * 2.4} revealRef={revealRef} />
        )}
        {/* Persistent repo name below each planet. Tracks the system reveal so
            labels don't crowd the sky view before the system has emerged. */}
        <SceneLabel
          text={repo.name}
          screenOffset={[0, -(size * 2.6 + 0.4), 0]}
          height={0.42}
          revealRef={revealRef}
        />
      </group>
    </group>
  );
}
