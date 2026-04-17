import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OwnerSystem } from "../types/universe";
import { planetLayout, SKY_RADIUS } from "../utils/layout";
import { StarNode } from "./StarNode";
import { OrbitRing } from "./OrbitRing";
import { PlanetNode } from "./PlanetNode";

// Distance from the viewer at full reveal. Orbits of radius 3–15 fill a
// comfortable portion of the view at this distance, which makes the system
// feel approachable without visibly exiting the sky sphere.
const NEAR_RADIUS = 18;

interface SystemPreviewProps {
  system: OwnerSystem;
  direction: THREE.Vector3;
  revealRef: MutableRefObject<number>;
  hoveredRepoId: string | null;
  onHoverRepo: (id: string | null) => void;
  onStarClick: () => void;
}

// Renders the selected owner's star system in-place at the owner's sky
// direction. As the reveal ref rises, the group is pulled from sky distance
// toward the viewer and orbital rings + planets fade in — a continuous
// approach rather than a mode switch.
export function SystemPreview({
  system,
  direction,
  revealRef,
  hoveredRepoId,
  onHoverRepo,
  onStarClick,
}: SystemPreviewProps) {
  const planets = useMemo(
    () =>
      system.repos.map((repo, index) => ({
        repo,
        layout: planetLayout(system.owner, repo.fullName, index),
      })),
    [system]
  );

  // Orient the group so the orbital plane is perpendicular to the direction
  // from the viewer — orbits always look circular, never edge-on.
  const quaternion = useMemo(() => {
    const worldUp = new THREE.Vector3(0, 1, 0);
    return new THREE.Quaternion().setFromUnitVectors(worldUp, direction);
  }, [direction]);

  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const reveal = revealRef.current;
    const distance = SKY_RADIUS * (1 - reveal) + NEAR_RADIUS * reveal;
    if (groupRef.current) {
      groupRef.current.position.set(
        direction.x * distance,
        direction.y * distance,
        direction.z * distance
      );
    }
  });

  const starSize = 0.7 + system.brightness * 0.5;
  // Keep the central star at least fairly bright so the selected anchor reads
  // clearly even for owners with modest totals.
  const starBrightness = Math.max(system.brightness, 0.7);

  return (
    <group ref={groupRef} quaternion={quaternion}>
      <StarNode
        position={[0, 0, 0]}
        brightness={starBrightness}
        label={system.owner}
        size={starSize}
        onClick={onStarClick}
      />
      {planets.map(({ repo, layout }) => (
        <OrbitRing
          key={`ring-${repo.id}`}
          radius={layout.radius}
          tilt={layout.tilt}
          revealRef={revealRef}
        />
      ))}
      {planets.map(({ repo, layout }) => (
        <PlanetNode
          key={repo.id}
          repo={repo}
          layout={layout}
          hovered={hoveredRepoId === repo.id}
          onHoverChange={onHoverRepo}
          revealRef={revealRef}
        />
      ))}
    </group>
  );
}
