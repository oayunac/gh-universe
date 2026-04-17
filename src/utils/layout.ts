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

const UNIVERSE_RADIUS = 80;

// Deterministic owner position in 3D space — stable across refreshes.
export function ownerStarPosition(owner: string): StarPosition {
  const rng = seededRandom(hashString(`owner:${owner}`));
  // Rejection-sampled disc with subtle vertical spread for a calm distribution.
  const r = Math.sqrt(rng()) * UNIVERSE_RADIUS;
  const theta = rng() * Math.PI * 2;
  const y = (rng() - 0.5) * 12;
  return {
    x: Math.cos(theta) * r,
    y,
    z: Math.sin(theta) * r,
  };
}

// Deterministic planet orbit parameters for a given repo within an owner system.
export function planetLayout(owner: string, repoFullName: string, index: number): PlanetLayout {
  const rng = seededRandom(hashString(`planet:${repoFullName}`));
  const radius = 3 + index * 1.6 + rng() * 0.6;
  const angle = rng() * Math.PI * 2;
  const speed = 0.08 + rng() * 0.12;
  const tilt = (rng() - 0.5) * 0.25;
  void owner;
  return { radius, angle, speed, tilt };
}
