import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OwnerSystem } from "../types/universe";
import { ownerStarPosition, type StarPosition } from "../utils/layout";
import { StarNode } from "./StarNode";
import { BackgroundStars } from "./BackgroundStars";
import type { TransitionOverlayHandle } from "../components/TransitionOverlay";

// Sky look-around tunables
const MAX_PITCH = (80 * Math.PI) / 180;
const YAW_SENSITIVITY = 0.0025;
const PITCH_SENSITIVITY = 0.0025;
const ROTATION_LERP = 6;
const MIN_FOV = 18;
const MAX_FOV = 70;
const DEFAULT_FOV = 55;
const FOV_LERP = 8;
const WHEEL_SENSITIVITY = 0.035;

// Zoom-driven entry heuristics
// Trigger only when the user has explicitly narrowed the FOV AND a star is
// well-centered in the frustum for at least ENTRY_DWELL seconds — this avoids
// accidental entry while casually exploring.
const ENTRY_FOV = 22;
const ENTRY_ANGLE_RATIO = 0.28;
const ENTRY_DWELL = 0.15;

// Transition animation tunables
const TRANSITION_DURATION = 0.9;
const TRANSITION_FADE_START = 0.55;
const TRANSITION_FOV = 8;
const EMERGE_FADE_DURATION = 0.5;

interface UniverseSceneProps {
  systems: OwnerSystem[];
  onFocus: (owner: string) => void;
  transitionRef: RefObject<TransitionOverlayHandle | null>;
}

interface StarEntry {
  system: OwnerSystem;
  position: StarPosition;
  direction: THREE.Vector3;
}

export function UniverseScene({ systems, onFocus, transitionRef }: UniverseSceneProps) {
  const stars = useMemo<StarEntry[]>(
    () =>
      systems.map((system) => {
        const position = ownerStarPosition(system.owner);
        const direction = new THREE.Vector3(position.x, position.y, position.z).normalize();
        return { system, position, direction };
      }),
    [systems]
  );

  const { camera, gl } = useThree();

  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const targetYawRef = useRef(0);
  const targetPitchRef = useRef(0);
  const targetFovRef = useRef(DEFAULT_FOV);

  const draggingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });

  const transRef = useRef({
    active: false,
    target: null as string | null,
    startTime: 0,
    fromYaw: 0,
    toYaw: 0,
    fromPitch: 0,
    toPitch: 0,
    fromFov: DEFAULT_FOV,
    fadeStarted: false,
    finalized: false,
  });

  const dwellOwnerRef = useRef<string | null>(null);
  const dwellStartRef = useRef(0);

  const lookTargetRef = useRef(new THREE.Vector3());
  const lookDirRef = useRef(new THREE.Vector3());

  const requestFocus = useCallback(
    (owner: string) => {
      if (transRef.current.active) return;
      const star = stars.find((s) => s.system.owner === owner);
      if (!star) return;

      const dir = star.direction;
      const targetPitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
      // atan2 gives the yaw in [-PI, PI]; unwrap to the nearest equivalent of the
      // current yaw so the transition takes the short way around.
      const rawYaw = Math.atan2(dir.x, -dir.z);
      const currentYaw = yawRef.current;
      const twoPi = Math.PI * 2;
      const delta =
        (((rawYaw - currentYaw) % twoPi) + twoPi * 1.5) % twoPi - Math.PI;
      const targetYaw = currentYaw + delta;

      const fov =
        camera instanceof THREE.PerspectiveCamera ? camera.fov : DEFAULT_FOV;

      transRef.current = {
        active: true,
        target: owner,
        startTime: performance.now() / 1000,
        fromYaw: currentYaw,
        toYaw: targetYaw,
        fromPitch: pitchRef.current,
        toPitch: targetPitch,
        fromFov: fov,
        fadeStarted: false,
        finalized: false,
      };

      dwellOwnerRef.current = null;
    },
    [stars, camera]
  );

  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = "none";
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = DEFAULT_FOV;
      camera.updateProjectionMatrix();
    }
    targetFovRef.current = DEFAULT_FOV;

    const onPointerDown = (e: PointerEvent) => {
      if (transRef.current.active) return;
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
      if (!draggingRef.current || transRef.current.active) return;
      const dx = e.clientX - lastRef.current.x;
      const dy = e.clientY - lastRef.current.y;
      lastRef.current = { x: e.clientX, y: e.clientY };
      targetYawRef.current += dx * YAW_SENSITIVITY;
      targetPitchRef.current -= dy * PITCH_SENSITIVITY;
      targetPitchRef.current = Math.max(
        -MAX_PITCH,
        Math.min(MAX_PITCH, targetPitchRef.current)
      );
      // Any drag input invalidates zoom-dwell — the user is reframing.
      dwellOwnerRef.current = null;
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
      if (transRef.current.active) return;
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
    const trans = transRef.current;

    if (trans.active) {
      const now = performance.now() / 1000;
      const t = Math.min(1, (now - trans.startTime) / TRANSITION_DURATION);
      const eased = t * t * (3 - 2 * t);

      const yaw = trans.fromYaw + (trans.toYaw - trans.fromYaw) * eased;
      const pitch = trans.fromPitch + (trans.toPitch - trans.fromPitch) * eased;
      const fov = trans.fromFov + (TRANSITION_FOV - trans.fromFov) * eased;

      yawRef.current = yaw;
      pitchRef.current = pitch;
      targetYawRef.current = yaw;
      targetPitchRef.current = pitch;
      targetFovRef.current = fov;

      applyCamera(camera, yaw, pitch, fov, lookTargetRef.current);

      if (!trans.fadeStarted && t >= TRANSITION_FADE_START) {
        trans.fadeStarted = true;
        const fadeTime = TRANSITION_DURATION * (1 - TRANSITION_FADE_START);
        transitionRef.current?.fadeTo(1, fadeTime);
      }

      if (!trans.finalized && t >= 1 && trans.target) {
        trans.finalized = true;
        const owner = trans.target;
        onFocus(owner);
        // Emerge — the scene swaps on the next render; the overlay stays in
        // place and fades back down to reveal the star system underneath.
        transitionRef.current?.fadeTo(0, EMERGE_FADE_DURATION);
      }
      return;
    }

    const rotLerp = 1 - Math.exp(-ROTATION_LERP * delta);
    yawRef.current += (targetYawRef.current - yawRef.current) * rotLerp;
    pitchRef.current += (targetPitchRef.current - pitchRef.current) * rotLerp;

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

    // Zoom-driven entry: once the user has narrowed their gaze on a star,
    // dwell briefly, then trigger the same focus transition as a click.
    if (camera instanceof THREE.PerspectiveCamera && stars.length > 0) {
      if (camera.fov <= ENTRY_FOV) {
        camera.getWorldDirection(lookDirRef.current);

        let bestOwner: string | null = null;
        let bestAngle = Infinity;
        for (const star of stars) {
          const dot = THREE.MathUtils.clamp(
            lookDirRef.current.dot(star.direction),
            -1,
            1
          );
          const angle = Math.acos(dot);
          if (angle < bestAngle) {
            bestAngle = angle;
            bestOwner = star.system.owner;
          }
        }

        const threshold = (camera.fov * Math.PI) / 180 * ENTRY_ANGLE_RATIO;
        if (bestOwner && bestAngle < threshold) {
          const now = performance.now() / 1000;
          if (dwellOwnerRef.current !== bestOwner) {
            dwellOwnerRef.current = bestOwner;
            dwellStartRef.current = now;
          } else if (now - dwellStartRef.current >= ENTRY_DWELL) {
            requestFocus(bestOwner);
          }
        } else {
          dwellOwnerRef.current = null;
        }
      } else {
        dwellOwnerRef.current = null;
      }
    }
  });

  return (
    <>
      <BackgroundStars count={500} radius={260} />
      {stars.map(({ system, position }) => (
        <StarNode
          key={system.owner}
          position={[position.x, position.y, position.z]}
          brightness={system.brightness}
          label={system.owner}
          size={0.7 + system.brightness * 0.5}
          onClick={() => requestFocus(system.owner)}
        />
      ))}
    </>
  );
}

function applyCamera(
  camera: THREE.Camera,
  yaw: number,
  pitch: number,
  fov: number,
  lookTarget: THREE.Vector3
) {
  camera.position.set(0, 0, 0);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  lookTarget.set(cp * sy, sp, -cp * cy);
  camera.lookAt(lookTarget);
  if (camera instanceof THREE.PerspectiveCamera) {
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }
}

