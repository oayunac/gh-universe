import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OwnerSystem } from "../types/universe";
import {
  ownerStarPosition,
  planetLayout,
  SKY_RADIUS,
  SYSTEM_NEAR_RADIUS,
  type PlanetLayout,
  type StarPosition,
} from "../utils/layout";
import { ownerSpectral, type SpectralInfo } from "../utils/spectralColor";
import { StarNode } from "./StarNode";
import { BackgroundStars } from "./BackgroundStars";
import { SystemPreview } from "./SystemPreview";

// Sky look-around tunables
const MAX_PITCH = (80 * Math.PI) / 180;
const YAW_SENSITIVITY = 0.0025;
const PITCH_SENSITIVITY = 0.0025;
const DRAG_YAW_DIRECTION = -1;
const DRAG_PITCH_DIRECTION = 1;
const ROTATION_LERP = 6;
const MIN_FOV = 18;
const MAX_FOV = 70;
const DEFAULT_FOV = 55;
const FOV_LERP = 8;
const WHEEL_SENSITIVITY = 0.035;

// Reveal curve — maps zoom depth (narrowing FOV) onto a smoothstep so the
// system begins emerging once the user has clearly committed to zooming in.
// Shifted earlier so other stars fade sooner and planets reach full brightness
// well before the user hits maximum zoom.
const REVEAL_START = 0.1;
const REVEAL_END = 0.5;

// FOV used by double-click on a star — narrow enough to feel zoomed in, wide
// enough that a typical system's outer planets still fit.
const DEEP_ZOOM_FOV = 34;

// Minimal imperative handle for UI chrome (HUD) that needs to read the live
// camera orientation or nudge zoom through the existing FOV lerp.
export interface CameraControlHandle {
  getYaw(): number;
  getPitch(): number;
  getFov(): number;
  zoomBy(deltaFov: number): void;
}

interface UniverseSceneProps {
  systems: OwnerSystem[];
  selectedOwner: string | null;
  onSelect: (owner: string) => void;
  selectedRepoId: string | null;
  onSelectRepo: (id: string) => void;
  onDeselectRepo: () => void;
  hoveredRepoId: string | null;
  onHoverRepo: (id: string | null) => void;
  cameraControlRef?: MutableRefObject<CameraControlHandle | null>;
  // Owners with totalStars below this threshold are hidden from the sky. The
  // selected owner is always shown so the user can't lose their selection by
  // sliding the threshold above it.
  visibilityThreshold: number;
}

interface StarEntry {
  system: OwnerSystem;
  position: StarPosition;
  direction: THREE.Vector3;
  spectral: SpectralInfo;
}

export function UniverseScene({
  systems,
  selectedOwner,
  onSelect,
  selectedRepoId,
  onSelectRepo,
  onDeselectRepo,
  hoveredRepoId,
  onHoverRepo,
  cameraControlRef,
  visibilityThreshold,
}: UniverseSceneProps) {
  const stars = useMemo<StarEntry[]>(
    () =>
      systems
        .filter(
          (system) =>
            system.totalStars >= visibilityThreshold ||
            system.owner === selectedOwner
        )
        .map((system) => {
          const position = ownerStarPosition(system.owner);
          const direction = new THREE.Vector3(position.x, position.y, position.z).normalize();
          const spectral = ownerSpectral(system.owner);
          return { system, position, direction, spectral };
        }),
    [systems, visibilityThreshold, selectedOwner]
  );

  const selectedEntry = useMemo(
    () =>
      selectedOwner
        ? stars.find((s) => s.system.owner === selectedOwner) ?? null
        : null,
    [stars, selectedOwner]
  );

  // Precomputed layout for every repo of the currently selected owner, so the
  // frame loop can find the selected planet's orbit parameters in O(n).
  const selectedPlanetLayouts = useMemo<
    Array<{ repoId: string; layout: PlanetLayout }> | null
  >(() => {
    if (!selectedEntry) return null;
    return selectedEntry.system.repos.map((repo, index) => ({
      repoId: repo.id,
      layout: planetLayout(selectedEntry.system.owner, repo.fullName, index),
    }));
  }, [selectedEntry]);

  // Stable ref to the selected-planet quaternion, aligned to the owner's sky
  // direction — mirrors the orientation used inside SystemPreview.
  const selectedQuatRef = useRef(new THREE.Quaternion());
  useEffect(() => {
    if (selectedEntry) {
      const worldUp = new THREE.Vector3(0, 1, 0);
      selectedQuatRef.current.setFromUnitVectors(worldUp, selectedEntry.direction);
    }
  }, [selectedEntry]);

  const { camera, gl } = useThree();

  // Look state
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const targetYawRef = useRef(0);
  const targetPitchRef = useRef(0);
  const targetFovRef = useRef(DEFAULT_FOV);

  // Drag state
  const draggingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });

  // Mutable handle for the deselect callback so the drag listener (bound once)
  // can always reach the latest store-backed implementation.
  const onDeselectRepoRef = useRef(onDeselectRepo);
  useEffect(() => {
    onDeselectRepoRef.current = onDeselectRepo;
  }, [onDeselectRepo]);

  // Reveal value — read every frame by SystemPreview / OrbitRing / PlanetNode.
  const revealRef = useRef(0);

  const lookTargetRef = useRef(new THREE.Vector3());
  const planetWorldRef = useRef(new THREE.Vector3());
  const planetLocalRef = useRef(new THREE.Vector3());
  const TILT_AXIS = useRef(new THREE.Vector3(1, 0, 0)).current;

  // Click-to-select: aim the camera at the star using the standard idle lerp
  // and update the selection in the store. No FOV change — zooming reveals.
  const selectAndCenter = useCallback(
    (owner: string) => {
      const star = stars.find((s) => s.system.owner === owner);
      if (!star) return;

      const dir = star.direction;
      const targetPitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
      // Unwrap the atan2 result so the lerp takes the short way around.
      const rawYaw = Math.atan2(dir.x, -dir.z);
      const currentYaw = yawRef.current;
      const twoPi = Math.PI * 2;
      const delta =
        (((rawYaw - currentYaw) % twoPi) + twoPi * 1.5) % twoPi - Math.PI;
      targetYawRef.current = currentYaw + delta;
      targetPitchRef.current = targetPitch;

      onSelect(owner);
    },
    [stars, onSelect]
  );

  // Double-click a star: select and center it (like a normal click) and
  // simultaneously pull the camera into a full-reveal FOV so all of its
  // planets are immediately visible.
  const zoomIntoSystem = useCallback(
    (owner: string) => {
      selectAndCenter(owner);
      targetFovRef.current = DEEP_ZOOM_FOV;
    },
    [selectAndCenter]
  );

  // Reset FOV back to neutral when the user clears the selection (returns to
  // the universe). Cross-selection between owners preserves the current zoom
  // so double-click zoom doesn't get clobbered by the effect.
  useEffect(() => {
    if (selectedOwner === null) {
      targetFovRef.current = DEFAULT_FOV;
    }
  }, [selectedOwner]);

  // Any owner selection — scene click, sidebar click, or save-list load —
  // pans the camera toward that star. In-scene clicks set yaw/pitch before
  // dispatching, so this is a redundant no-op for them; for store-driven
  // paths (sidebar, etc.) it's the thing that actually moves the camera.
  useEffect(() => {
    if (!selectedOwner) return;
    const star = stars.find((s) => s.system.owner === selectedOwner);
    if (!star) return;
    const dir = star.direction;
    const targetPitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    const rawYaw = Math.atan2(dir.x, -dir.z);
    const currentYaw = yawRef.current;
    const twoPi = Math.PI * 2;
    const delta =
      (((rawYaw - currentYaw) % twoPi) + twoPi * 1.5) % twoPi - Math.PI;
    targetYawRef.current = currentYaw + delta;
    targetPitchRef.current = targetPitch;
  }, [selectedOwner, stars]);

  // When a repo is selected from outside the scene (e.g. the sidebar), the
  // user is probably still at a wide FOV. Pull the camera into deep zoom so
  // the planet is actually visible when we aim at it.
  useEffect(() => {
    if (selectedRepoId && targetFovRef.current > DEEP_ZOOM_FOV) {
      targetFovRef.current = DEEP_ZOOM_FOV;
    }
  }, [selectedRepoId]);

  // Publish a small imperative handle so external UI (HUD, etc.) can read the
  // live camera orientation and nudge zoom without duplicating this logic.
  useEffect(() => {
    if (!cameraControlRef) return;
    cameraControlRef.current = {
      getYaw: () => yawRef.current,
      getPitch: () => pitchRef.current,
      // Horizontal FOV derived from the vertical FOV and the current aspect
      // ratio. r3f updates camera.aspect on canvas resize, so this reacts to
      // browser size changes — the HUD wedge then reflects how much of the
      // sky the user actually sees left-to-right.
      getFov: () => {
        if (!(camera instanceof THREE.PerspectiveCamera)) return DEFAULT_FOV;
        const vFovRad = (camera.fov * Math.PI) / 180;
        const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * camera.aspect);
        return (hFovRad * 180) / Math.PI;
      },
      zoomBy: (delta: number) => {
        targetFovRef.current = Math.max(
          MIN_FOV,
          Math.min(MAX_FOV, targetFovRef.current + delta)
        );
      },
    };
    return () => {
      cameraControlRef.current = null;
    };
  }, [camera, cameraControlRef]);

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
      if (dx === 0 && dy === 0) return;
      lastRef.current = { x: e.clientX, y: e.clientY };
      // An actual drag gesture releases any centered planet — the user is
      // explicitly asking to look elsewhere.
      onDeselectRepoRef.current();
      targetYawRef.current += dx * YAW_SENSITIVITY * DRAG_YAW_DIRECTION;
      targetPitchRef.current += dy * PITCH_SENSITIVITY * DRAG_PITCH_DIRECTION;
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

  useFrame((state, delta) => {
    // If a planet is selected, retarget the camera at its current orbit
    // position each frame. The system itself (and therefore the host star)
    // stays fixed in world space — only the camera's aim follows the planet.
    if (selectedEntry && selectedRepoId && selectedPlanetLayouts) {
      const match = selectedPlanetLayouts.find(
        (p) => p.repoId === selectedRepoId
      );
      if (match) {
        const t = state.clock.getElapsedTime();
        const angle = match.layout.angle + t * match.layout.speed;
        const distance =
          SKY_RADIUS * (1 - revealRef.current) +
          SYSTEM_NEAR_RADIUS * revealRef.current;

        planetLocalRef.current
          .set(
            Math.cos(angle) * match.layout.radius,
            0,
            Math.sin(angle) * match.layout.radius
          )
          .applyAxisAngle(TILT_AXIS, match.layout.tilt)
          .applyQuaternion(selectedQuatRef.current);
        planetWorldRef.current
          .copy(selectedEntry.direction)
          .multiplyScalar(distance)
          .add(planetLocalRef.current);

        const len = planetWorldRef.current.length() || 1;
        const nx = planetWorldRef.current.x / len;
        const ny = planetWorldRef.current.y / len;
        const nz = planetWorldRef.current.z / len;
        const targetPitch = Math.asin(THREE.MathUtils.clamp(ny, -1, 1));
        const rawYaw = Math.atan2(nx, -nz);
        // Unwrap so the idle lerp always takes the short way around.
        const currentYaw = yawRef.current;
        const twoPi = Math.PI * 2;
        const yawDelta =
          (((rawYaw - currentYaw) % twoPi) + twoPi * 1.5) % twoPi - Math.PI;
        targetYawRef.current = currentYaw + yawDelta;
        targetPitchRef.current = THREE.MathUtils.clamp(
          targetPitch,
          -MAX_PITCH,
          MAX_PITCH
        );
      }
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

      // Reveal only applies when a star is selected — unselected zoom is just
      // a narrower gaze with no system emergence.
      if (selectedEntry) {
        const zoomDepth = Math.max(
          0,
          Math.min(1, (DEFAULT_FOV - camera.fov) / (DEFAULT_FOV - MIN_FOV))
        );
        const t = Math.max(
          0,
          Math.min(1, (zoomDepth - REVEAL_START) / (REVEAL_END - REVEAL_START))
        );
        revealRef.current = t * t * (3 - 2 * t);
      } else if (revealRef.current !== 0) {
        // Ease back to zero smoothly when selection goes away mid-frame.
        revealRef.current *= Math.exp(-6 * delta);
        if (revealRef.current < 0.001) revealRef.current = 0;
      }
    }
  });

  return (
    <>
      <BackgroundStars count={500} radius={260} />

      {stars.map(({ system, position, spectral }) =>
        system.owner === selectedOwner ? null : (
          <StarNode
            key={system.owner}
            position={[position.x, position.y, position.z]}
            brightness={system.brightness}
            label={system.owner}
            color={spectral.color}
            size={0.25 + system.brightness * 0.2}
            onClick={() => selectAndCenter(system.owner)}
            onDoubleClick={() => zoomIntoSystem(system.owner)}
            revealRef={revealRef}
          />
        )
      )}

      {selectedEntry && (
        <SystemPreview
          key={selectedEntry.system.owner}
          system={selectedEntry.system}
          direction={selectedEntry.direction}
          spectralColor={selectedEntry.spectral.color}
          revealRef={revealRef}
          hoveredRepoId={hoveredRepoId}
          onHoverRepo={onHoverRepo}
          selectedRepoId={selectedRepoId}
          onSelectRepo={onSelectRepo}
          onStarClick={() => selectAndCenter(selectedEntry.system.owner)}
          onStarDoubleClick={() => zoomIntoSystem(selectedEntry.system.owner)}
        />
      )}
    </>
  );
}
