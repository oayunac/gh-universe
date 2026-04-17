import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OwnerSystem } from "../types/universe";
import { planetLayout } from "../utils/layout";
import { StarNode } from "./StarNode";
import { PlanetNode } from "./PlanetNode";
import { OrbitRing } from "./OrbitRing";
import { BackgroundStars } from "./BackgroundStars";

interface StarSystemSceneProps {
  system: OwnerSystem;
  hoveredRepoId: string | null;
  onHoverRepo: (id: string | null) => void;
}

export function StarSystemScene({
  system,
  hoveredRepoId,
  onHoverRepo,
}: StarSystemSceneProps) {
  const planets = useMemo(() => {
    return system.repos.map((repo, index) => ({
      repo,
      layout: planetLayout(system.owner, repo.fullName, index),
    }));
  }, [system]);

  const maxRadius = useMemo(
    () => planets.reduce((max, p) => Math.max(max, p.layout.radius), 4),
    [planets]
  );

  return (
    <>
      <SystemCamera maxRadius={maxRadius} />
      <BackgroundStars count={320} radius={260} />

      <StarNode
        position={[0, 0, 0]}
        brightness={Math.max(system.brightness, 0.7)}
        label={system.owner}
        size={1.2}
        interactive={false}
      />

      {planets.map(({ repo, layout }) => (
        <OrbitRing key={`ring-${repo.id}`} radius={layout.radius} tilt={layout.tilt} />
      ))}

      {planets.map(({ repo, layout }) => (
        <PlanetNode
          key={repo.id}
          repo={repo}
          layout={layout}
          hovered={hoveredRepoId === repo.id}
          onHoverChange={onHoverRepo}
        />
      ))}
    </>
  );
}

const SYSTEM_FOV = 45;

function SystemCamera({ maxRadius }: { maxRadius: number }) {
  const { camera } = useThree();
  const target = useRef<THREE.Vector3>(new THREE.Vector3());
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = SYSTEM_FOV;
      camera.updateProjectionMatrix();
    }
  }, [camera]);
  useFrame((_, delta) => {
    const distance = Math.max(14, maxRadius * 2.2);
    target.current.set(0, distance * 0.55, distance);
    camera.position.x += (target.current.x - camera.position.x) * Math.min(1, delta * 2);
    camera.position.y += (target.current.y - camera.position.y) * Math.min(1, delta * 2);
    camera.position.z += (target.current.z - camera.position.z) * Math.min(1, delta * 2);
    camera.lookAt(0, 0, 0);
  });
  return null;
}
