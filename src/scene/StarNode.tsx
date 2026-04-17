import { useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

interface StarNodeProps {
  position: [number, number, number];
  brightness: number;
  label: string;
  size?: number;
  onClick?: () => void;
  interactive?: boolean;
  // When provided, the star fades as the reveal ref approaches 1 — used to
  // dim non-selected sky stars while the viewer is zooming into the selected
  // system.
  revealRef?: MutableRefObject<number>;
}

// Below this dim factor the star becomes effectively invisible; we also skip
// pointer interactions so faded stars can't hijack clicks.
const INTERACT_DIM_THRESHOLD = 0.35;

export function StarNode({
  position,
  brightness,
  label,
  size = 0.6,
  onClick,
  interactive = true,
  revealRef,
}: StarNodeProps) {
  const [hovered, setHovered] = useState(false);
  const coreRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  // Soft warm-white that tints slightly with brightness.
  const color = useMemo(() => {
    const base = new THREE.Color("#ffeccc");
    return base.lerp(new THREE.Color("#ffffff"), brightness * 0.6);
  }, [brightness]);

  useFrame((_, delta) => {
    const dim = revealRef ? Math.max(0, 1 - revealRef.current) : 1;
    if (coreRef.current) {
      const material = coreRef.current.material as THREE.MeshBasicMaterial;
      const target = (hovered ? 1 : brightness) * dim;
      material.opacity += (target - material.opacity) * Math.min(1, delta * 6);
    }
    if (haloRef.current) {
      haloRef.current.rotation.z += delta * 0.05;
      const haloMat = haloRef.current.material as THREE.MeshBasicMaterial;
      haloMat.opacity = brightness * 0.12 * dim;
    }
  });

  const isDimmed = () =>
    revealRef ? 1 - revealRef.current < INTERACT_DIM_THRESHOLD : false;

  const pointerProps = interactive
    ? {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          if (isDimmed()) return;
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        },
        onPointerOut: () => {
          if (!hovered) return;
          setHovered(false);
          document.body.style.cursor = "";
        },
        onClick: (e: ThreeEvent<MouseEvent>) => {
          if (isDimmed()) return;
          e.stopPropagation();
          onClick?.();
        },
      }
    : {};

  return (
    <group position={position} {...pointerProps}>
      <mesh ref={coreRef}>
        <sphereGeometry args={[size, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={brightness} />
      </mesh>
      <mesh ref={haloRef}>
        <sphereGeometry args={[size * 2.2, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={brightness * 0.12}
          depthWrite={false}
        />
      </mesh>
      {hovered && interactive && (
        <Billboard position={[0, size * 2.8, 0]}>
          <mesh>
            <planeGeometry args={[label.length * 0.35 + 1.2, 0.9]} />
            <meshBasicMaterial color="#0a0f1c" transparent opacity={0.7} />
          </mesh>
          <StarLabel text={label} />
        </Billboard>
      )}
    </group>
  );
}

function Billboard({
  position,
  children,
}: {
  position: [number, number, number];
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    groupRef.current?.quaternion.copy(camera.quaternion);
  });
  return (
    <group ref={groupRef} position={position}>
      {children}
    </group>
  );
}

function StarLabel({ text }: { text: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e9eef7";
    ctx.font = "500 56px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }, [text]);
  return (
    <mesh position={[0, 0, 0.01]}>
      <planeGeometry args={[text.length * 0.35 + 1, 0.9]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  );
}
