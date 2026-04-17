import { useMemo } from "react";
import * as THREE from "three";

interface OrbitRingProps {
  radius: number;
  tilt?: number;
  opacity?: number;
  segments?: number;
}

export function OrbitRing({
  radius,
  tilt = 0,
  opacity = 0.18,
  segments = 96,
}: OrbitRingProps) {
  // Build a real THREE.Line and attach via <primitive> to sidestep the
  // JSX `<line>` ambiguity with SVG in TypeScript.
  const line = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(
        new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius)
      );
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: "#6b7b99",
      transparent: true,
      opacity,
    });
    const instance = new THREE.Line(geometry, material);
    instance.rotation.x = tilt;
    return instance;
  }, [radius, segments, opacity, tilt]);

  return <primitive object={line} />;
}
