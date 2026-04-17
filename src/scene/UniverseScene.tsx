import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OwnerSystem } from "../types/universe";
import { ownerStarPosition } from "../utils/layout";
import { StarNode } from "./StarNode";
import { BackgroundStars } from "./BackgroundStars";

interface UniverseSceneProps {
  systems: OwnerSystem[];
  onFocus: (owner: string) => void;
}

export function UniverseScene({ systems, onFocus }: UniverseSceneProps) {
  const stars = useMemo(() => {
    return systems.map((system) => ({
      system,
      position: ownerStarPosition(system.owner),
    }));
  }, [systems]);

  return (
    <>
      <CameraReset />
      <BackgroundStars count={400} radius={260} />
      {stars.map(({ system, position }) => (
        <StarNode
          key={system.owner}
          position={[position.x, position.y, position.z]}
          brightness={system.brightness}
          label={system.owner}
          size={0.6 + system.brightness * 0.5}
          onClick={() => onFocus(system.owner)}
        />
      ))}
    </>
  );
}

function CameraReset() {
  const { camera } = useThree();
  const targetRef = useRef<[number, number, number]>([0, 28, 90]);
  useFrame((_, delta) => {
    const [tx, ty, tz] = targetRef.current;
    camera.position.x += (tx - camera.position.x) * Math.min(1, delta * 2);
    camera.position.y += (ty - camera.position.y) * Math.min(1, delta * 2);
    camera.position.z += (tz - camera.position.z) * Math.min(1, delta * 2);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
  });
  return null;
}
