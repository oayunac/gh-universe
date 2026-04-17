import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface SceneLabelProps {
  text: string;
  // Offset applied AFTER the billboard rotation. Because the billboard's local
  // frame ends up aligned with the camera's frame, [0, -1, 0] places the label
  // one world unit below the parent in screen space — independent of how the
  // camera or any enclosing system is oriented.
  screenOffset?: [number, number, number];
  // Plane height in world units. Width is derived from text length so the
  // typeface stays uniform across labels of different lengths.
  height?: number;
  // When supplied, opacity scales with the reveal value (0..1) so labels can
  // fade in alongside the system that owns them.
  revealRef?: MutableRefObject<number>;
}

const FONT_FAMILY = "system-ui, -apple-system, Segoe UI, sans-serif";
const FONT_WEIGHT = "600";
const FONT_PX = 112;
const PADDING_X = 56;
const CANVAS_HEIGHT = 240;
const BG_OPACITY = 0.7;

// Camera-facing label with a dark backdrop. The outer group billboards in
// world space (cancelling parent rotation) so the label reads as upright text
// even when nested inside transformed groups. The inner offset is therefore
// effectively in screen space.
export function SceneLabel({
  text,
  screenOffset = [0, 0, 0],
  height = 1.0,
  revealRef,
}: SceneLabelProps) {
  const billboardRef = useRef<THREE.Group>(null);
  const parentQuat = useRef(new THREE.Quaternion());
  const bgRef = useRef<THREE.Mesh>(null);
  const textRef = useRef<THREE.Mesh>(null);

  const { texture, planeWidth } = useMemo(() => {
    // Measure first so the canvas matches the text exactly — keeps the canvas
    // aspect equal to the plane aspect and prevents horizontal stretch.
    const measure = document.createElement("canvas").getContext("2d")!;
    measure.font = `${FONT_WEIGHT} ${FONT_PX}px ${FONT_FAMILY}`;
    const textWidth = Math.max(1, Math.ceil(measure.measureText(text).width));

    const canvasWidth = textWidth + PADDING_X * 2;
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvasWidth, CANVAS_HEIGHT);
    ctx.fillStyle = "#e9eef7";
    ctx.font = `${FONT_WEIGHT} ${FONT_PX}px ${FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvasWidth / 2, CANVAS_HEIGHT / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;

    const aspect = canvasWidth / CANVAS_HEIGHT;
    return { texture: tex, planeWidth: height * aspect };
  }, [text, height]);

  // CanvasTexture isn't owned by React's lifecycle; release GPU memory when
  // the label unmounts or the texture is replaced.
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(({ camera }) => {
    const group = billboardRef.current;
    if (!group) return;
    if (group.parent) {
      group.parent.getWorldQuaternion(parentQuat.current);
      group.quaternion
        .copy(camera.quaternion)
        .premultiply(parentQuat.current.invert());
    } else {
      group.quaternion.copy(camera.quaternion);
    }
    const reveal = revealRef ? revealRef.current : 1;
    if (bgRef.current) {
      (bgRef.current.material as THREE.MeshBasicMaterial).opacity =
        BG_OPACITY * reveal;
    }
    if (textRef.current) {
      (textRef.current.material as THREE.MeshBasicMaterial).opacity = reveal;
    }
  });

  return (
    <group ref={billboardRef}>
      <group position={screenOffset}>
        <mesh ref={bgRef}>
          <planeGeometry args={[planeWidth, height]} />
          <meshBasicMaterial
            color="#0a0f1c"
            transparent
            opacity={BG_OPACITY}
            depthWrite={false}
          />
        </mesh>
        <mesh ref={textRef} position={[0, 0, 0.001]}>
          <planeGeometry args={[planeWidth, height]} />
          <meshBasicMaterial
            map={texture}
            transparent
            opacity={1}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}
