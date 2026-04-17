import { useMemo, useRef, useState } from "react";
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
}

export function PlanetNode({ repo, layout, onHoverChange, hovered }: PlanetNodeProps) {
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
      const target = hovered || localHover ? 1 : brightness;
      material.opacity += (target - material.opacity) * 0.12;
    }
  });

  const size = 0.22 + brightness * 0.32;

  return (
    <group>
      <group rotation={[layout.tilt, 0, 0]}>
        <group ref={groupRef}>
          <mesh
            ref={meshRef}
            onPointerOver={(e) => {
              e.stopPropagation();
              setLocalHover(true);
              onHoverChange(repo.id);
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              setLocalHover(false);
              onHoverChange(null);
              document.body.style.cursor = "";
            }}
            onClick={(e) => {
              e.stopPropagation();
              window.open(repo.url, "_blank", "noopener,noreferrer");
            }}
          >
            <sphereGeometry args={[size, 20, 20]} />
            <meshBasicMaterial color={color} transparent opacity={brightness} />
          </mesh>
          <mesh>
            <sphereGeometry args={[size * 1.8, 12, 12]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={brightness * 0.1}
              depthWrite={false}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
