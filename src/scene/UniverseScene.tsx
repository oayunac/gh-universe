import { useEffect, useMemo, useRef } from "react";
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

// Tunables for the sky dome look-around.
const MAX_PITCH = (80 * Math.PI) / 180;
const YAW_SENSITIVITY = 0.0025;
const PITCH_SENSITIVITY = 0.0025;
const ROTATION_LERP = 6;
const MIN_FOV = 25;
const MAX_FOV = 70;
const DEFAULT_FOV = 55;
const FOV_LERP = 8;
const WHEEL_SENSITIVITY = 0.035;

export function UniverseScene({ systems, onFocus }: UniverseSceneProps) {
  const stars = useMemo(() => {
    return systems.map((system) => ({
      system,
      position: ownerStarPosition(system.owner),
    }));
  }, [systems]);

  return (
    <>
      <SkyControls />
      <BackgroundStars count={500} radius={260} />
      {stars.map(({ system, position }) => (
        <StarNode
          key={system.owner}
          position={[position.x, position.y, position.z]}
          brightness={system.brightness}
          label={system.owner}
          size={0.7 + system.brightness * 0.5}
          onClick={() => onFocus(system.owner)}
        />
      ))}
    </>
  );
}

// Head-rotation camera: the camera sits at the origin and spins via yaw/pitch.
// Horizontal drag rotates yaw without bound; vertical drag tilts pitch with a
// clamp. Wheel adjusts FOV so zoom feels like narrowing your gaze, not scaling.
function SkyControls() {
  const { camera, gl } = useThree();
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const targetYawRef = useRef(0);
  const targetPitchRef = useRef(0);
  const targetFovRef = useRef(DEFAULT_FOV);
  const draggingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });
  const lookTargetRef = useRef(new THREE.Vector3());

  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = "none";
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = DEFAULT_FOV;
      camera.updateProjectionMatrix();
    }
    targetFovRef.current = DEFAULT_FOV;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      draggingRef.current = true;
      lastRef.current = { x: e.clientX, y: e.clientY };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Pointer capture is a nice-to-have; ignore failures.
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - lastRef.current.x;
      const dy = e.clientY - lastRef.current.y;
      lastRef.current = { x: e.clientX, y: e.clientY };
      targetYawRef.current += dx * YAW_SENSITIVITY;
      targetPitchRef.current -= dy * PITCH_SENSITIVITY;
      targetPitchRef.current = Math.max(
        -MAX_PITCH,
        Math.min(MAX_PITCH, targetPitchRef.current)
      );
    };

    const stopDragging = (e: PointerEvent) => {
      draggingRef.current = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // Nothing to release.
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetFovRef.current = Math.max(
        MIN_FOV,
        Math.min(MAX_FOV, targetFovRef.current + e.deltaY * WHEEL_SENSITIVITY)
      );
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", stopDragging);
    el.addEventListener("pointercancel", stopDragging);
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", stopDragging);
      el.removeEventListener("pointercancel", stopDragging);
      el.removeEventListener("wheel", onWheel);
    };
  }, [camera, gl]);

  useFrame((_, delta) => {
    const rotLerp = 1 - Math.exp(-ROTATION_LERP * delta);
    yawRef.current += (targetYawRef.current - yawRef.current) * rotLerp;
    pitchRef.current += (targetPitchRef.current - pitchRef.current) * rotLerp;

    // Keep the viewer at the center of the sky sphere; only orientation changes.
    camera.position.set(0, 0, 0);
    const cp = Math.cos(pitchRef.current);
    const sp = Math.sin(pitchRef.current);
    const cy = Math.cos(yawRef.current);
    const sy = Math.sin(yawRef.current);
    lookTargetRef.current.set(cp * sy, sp, -cp * cy);
    camera.lookAt(lookTargetRef.current);

    if (camera instanceof THREE.PerspectiveCamera) {
      const fovLerp = 1 - Math.exp(-FOV_LERP * delta);
      const nextFov = camera.fov + (targetFovRef.current - camera.fov) * fovLerp;
      if (Math.abs(nextFov - camera.fov) > 0.01) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }
    }
  });

  return null;
}
