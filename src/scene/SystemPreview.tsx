import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OwnerSystem } from "../types/universe";
import { planetLayout, SKY_RADIUS, SYSTEM_NEAR_RADIUS } from "../utils/layout";
import { StarNode } from "./StarNode";
import { OrbitRing } from "./OrbitRing";
import { PlanetNode } from "./PlanetNode";
import { SelectionRing } from "./SelectionRing";
import { SceneLabel } from "./SceneLabel";

interface SystemPreviewProps {
  system: OwnerSystem;
  direction: THREE.Vector3;
  // Spectral-class color for the host star, derived deterministically from the
  // owner name in UniverseScene. Passed in (rather than recomputed here) so
  // the sky and the selected-system view always agree on the same hue.
  spectralColor: string;
  revealRef: MutableRefObject<number>;
  hoveredRepoId: string | null;
  onHoverRepo: (id: string | null) => void;
  selectedRepoId: string | null;
  onSelectRepo: (id: string) => void;
  onStarClick: () => void;
  onStarDoubleClick: () => void;
  // Shared drag/pinch suppression flag forwarded into the interactive scene
  // nodes so a tail-end click from a drag can't accidentally re-select.
  didDragRef?: MutableRefObject<boolean>;
}

// Renders the selected owner's star system at the owner's fixed sky direction.
// The group itself only moves along that direction as the reveal grows — the
// host star sits at the group's origin and therefore keeps a stable position
// in the universe. Selecting a planet does NOT move the star; the camera
// retargets instead (see UniverseScene).
export function SystemPreview({
  system,
  direction,
  spectralColor,
  revealRef,
  hoveredRepoId,
  onHoverRepo,
  selectedRepoId,
  onSelectRepo,
  onStarClick,
  onStarDoubleClick,
  didDragRef,
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
    const distance = SKY_RADIUS * (1 - reveal) + SYSTEM_NEAR_RADIUS * reveal;
    if (groupRef.current) {
      groupRef.current.position.set(
        direction.x * distance,
        direction.y * distance,
        direction.z * distance
      );
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
        color={spectralColor}
        size={starSize}
        onClick={onStarClick}
        onDoubleClick={onStarDoubleClick}
        // Persistent label below replaces the hover label here.
        hoverLabel={false}
        didDragRef={didDragRef}
      />
      {/* Persistent selection marker on the host star — the SystemPreview only
          mounts when an owner is selected, so its presence equals selection. */}
      <SelectionRing radius={starSize * 1.9} />
      {/* Persistent owner name below the star. Fades in with the system reveal
          so it doesn't appear before the star itself comes into view. */}
      <SceneLabel
        text={system.owner}
        screenOffset={[0, -(starSize * 2.4 + 0.6), 0]}
        height={0.7}
        revealRef={revealRef}
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
          didDragRef={didDragRef}
        />
      ))}
    </group>
  );
}
