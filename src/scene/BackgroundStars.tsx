import { useMemo } from "react";
import * as THREE from "three";
import { seededRandom } from "../utils/hash";

interface BackgroundStarsProps {
  count?: number;
  radius?: number;
}

// A calm, deterministic starfield far behind the scene. Not interactive.
export function BackgroundStars({ count = 400, radius = 260 }: BackgroundStarsProps) {
  const { geometry, material } = useMemo(() => {
    const rng = seededRandom(0xbada55);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      const r = radius * (0.8 + rng() * 0.2);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: "#9aa6bd",
      size: 0.7,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    return { geometry: geo, material: mat };
  }, [count, radius]);

  return <points geometry={geometry} material={material} />;
}
