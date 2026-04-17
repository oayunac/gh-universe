import { useMemo, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface OrbitRingProps {
  radius: number;
  tilt?: number;
  segments?: number;
  revealRef: MutableRefObject<number>;
}

// Orbital ring drawn as a THREE.Line. Opacity is driven by the shared reveal
// ref so rings fade in gradually as the system approaches the viewer.
export function OrbitRing({
  radius,
  tilt = 0,
  segments = 96,
  revealRef,
}: OrbitRingProps) {
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
      opacity: 0,
    });
    const instance = new THREE.Line(geometry, material);
    instance.rotation.x = tilt;
    return instance;
  }, [radius, segments, tilt]);

  useFrame(() => {
    const mat = line.material as THREE.LineBasicMaterial;
    mat.opacity = 0.22 * revealRef.current;
  });

  return <primitive object={line} />;
}
