import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface SelectionRingProps {
  radius: number;
  color?: string;
  segments?: number;
  // Dash sizing is expressed as a fraction of the ring radius so dot density
  // stays roughly constant whether the ring surrounds a tiny planet or a
  // larger host star.
  dashScale?: number;
  gapScale?: number;
  // When provided, opacity scales with the reveal value (0..1). Without it,
  // the ring stays at full opacity — appropriate for the host-star marker
  // which must be visible before the user has zoomed into the system.
  revealRef?: MutableRefObject<number>;
}

// Camera-facing dashed ring. Used as the selection marker for owner stars
// and repo planets. The ring sits as a sibling to the object it surrounds,
// sized just outside the object's radius, and billboards in world space so it
// always reads as a crisp dotted circle regardless of how the enclosing
// system is oriented.
export function SelectionRing({
  radius,
  color = "#ffd27a",
  segments = 96,
  dashScale = 0.18,
  gapScale = 0.12,
  revealRef,
}: SelectionRingProps) {
  const groupRef = useRef<THREE.Group>(null);
  const parentQuat = useRef(new THREE.Quaternion());

  const line = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(
        new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0)
      );
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color,
      dashSize: radius * dashScale,
      gapSize: radius * gapScale,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const instance = new THREE.Line(geometry, material);
    // LineDashedMaterial requires per-vertex distances — without this the
    // dashes degenerate into a solid line.
    instance.computeLineDistances();
    return instance;
  }, [radius, segments, color, dashScale, gapScale]);

  useFrame(({ camera }) => {
    const group = groupRef.current;
    if (!group) return;
    // World-space billboard: cancel the parent's world rotation so the ring
    // ends up aligned with the camera even when nested inside transformed
    // groups (e.g. the system's orbital-plane rotation).
    if (group.parent) {
      group.parent.getWorldQuaternion(parentQuat.current);
      group.quaternion
        .copy(camera.quaternion)
        .premultiply(parentQuat.current.invert());
    } else {
      group.quaternion.copy(camera.quaternion);
    }
    if (revealRef) {
      const mat = line.material as THREE.LineDashedMaterial;
      mat.opacity = revealRef.current;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={line} />
    </group>
  );
}
