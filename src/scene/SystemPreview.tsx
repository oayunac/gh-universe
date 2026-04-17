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

// How quickly the group position tracks toward its target. A softer value
// lets the "send to middle" motion feel smooth while still keeping up with a
// moving selected planet.
const GROUP_TRACK_RATE = 6;

interface SystemPreviewProps {
  system: OwnerSystem;
  direction: THREE.Vector3;
  revealRef: MutableRefObject<number>;
  hoveredRepoId: string | null;
  onHoverRepo: (id: string | null) => void;
  selectedRepoId: string | null;
  onSelectRepo: (id: string) => void;
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
  selectedRepoId,
  onSelectRepo,
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
  const targetGroupPos = useRef(new THREE.Vector3());
  const basePos = useRef(new THREE.Vector3());
  const localOffset = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const reveal = revealRef.current;
    const distance = SKY_RADIUS * (1 - reveal) + NEAR_RADIUS * reveal;

    basePos.current
      .copy(direction)
      .multiplyScalar(distance);

    // When a planet is selected, offset the whole group so that planet's
    // current orbit position lands on basePos. The star and the other planets
    // then visibly move around the pinned selection.
    if (selectedRepoId) {
      const selected = planets.find((p) => p.repo.id === selectedRepoId);
      if (selected) {
        const t = state.clock.getElapsedTime();
        const angle = selected.layout.angle + t * selected.layout.speed;
        localOffset.current.set(
          Math.cos(angle) * selected.layout.radius,
          0,
          Math.sin(angle) * selected.layout.radius
        );
        localOffset.current.applyAxisAngle(
          new THREE.Vector3(1, 0, 0),
          selected.layout.tilt
        );
        localOffset.current.applyQuaternion(quaternion);
        targetGroupPos.current.copy(basePos.current).sub(localOffset.current);
      } else {
        targetGroupPos.current.copy(basePos.current);
      }
    } else {
      targetGroupPos.current.copy(basePos.current);
    }

    if (groupRef.current) {
      const alpha = 1 - Math.exp(-GROUP_TRACK_RATE * delta);
      groupRef.current.position.lerp(targetGroupPos.current, alpha);
    }
  });

  const starSize = 0.25 + system.brightness * 0.2;
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
          selected={selectedRepoId === repo.id}
          onSelect={onSelectRepo}
          revealRef={revealRef}
        />
      ))}
    </group>
  );
}
