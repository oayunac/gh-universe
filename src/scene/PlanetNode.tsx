import { useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Repo } from "../types/universe";
import type { PlanetLayout } from "../utils/layout";
import { repoBrightness } from "../utils/brightness";

interface PlanetNodeProps {
  repo: Repo;
  layout: PlanetLayout;
  onHoverChange: (id: string | null) => void;
  hovered: boolean;
  revealRef: MutableRefObject<number>;
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
  revealRef,
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
      const base = hovered || localHover ? 1 : brightness;
      const target = base * reveal;
      material.opacity += (target - material.opacity) * 0.15;
    }
  });

  const size = 0.14 + brightness * 0.2;
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
            e.stopPropagation();
            window.open(repo.url, "_blank", "noopener,noreferrer");
          }}
        >
          <sphereGeometry args={[size, 20, 20]} />
          <meshBasicMaterial color={color} transparent opacity={0} />
        </mesh>
        <mesh>
          <sphereGeometry args={[hitRadius, 10, 10]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}
