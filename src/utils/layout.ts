import { hashString, seededRandom } from "./hash";

export interface StarPosition {
  x: number;
  y: number;
  z: number;
}

export interface PlanetLayout {
  radius: number;
  angle: number;
  speed: number;
  tilt: number;
}

// Distance from the viewer to the inner surface of the celestial sphere.
export const SKY_RADIUS = 100;

// Distance from the viewer when the selected system is fully revealed. Used
// by both the scene (to place the system group) and the camera-tracking logic
// to compute a selected planet's world position. Kept just far enough that a
// typical system's outer orbits still fit inside a comfortable FOV.
export const SYSTEM_NEAR_RADIUS = 24;

// Deterministic, uniformly-distributed point on the inside of the sky sphere.
export function ownerStarPosition(owner: string): StarPosition {
  const rng = seededRandom(hashString(`owner:${owner}`));
  const theta = rng() * Math.PI * 2;
  // Uniform on sphere: phi = acos(2u - 1) avoids clustering at poles.
  const phi = Math.acos(2 * rng() - 1);
  return {
    x: SKY_RADIUS * Math.sin(phi) * Math.cos(theta),
    y: SKY_RADIUS * Math.cos(phi),
    z: SKY_RADIUS * Math.sin(phi) * Math.sin(theta),
  };
}

// Deterministic planet orbit parameters for a given repo within an owner system.
export function planetLayout(owner: string, repoFullName: string, index: number): PlanetLayout {
  const rng = seededRandom(hashString(`planet:${repoFullName}`));
  // Tighter orbit spacing so more of a typical system fits in view at once.
  const radius = 3 + index * 1.2 + rng() * 0.4;
  const angle = rng() * Math.PI * 2;
  // Calmer orbital motion — about half the former speed.
  const speed = 0.04 + rng() * 0.06;
  const tilt = (rng() - 0.5) * 0.25;
  void owner;
  return { radius, angle, speed, tilt };
}
