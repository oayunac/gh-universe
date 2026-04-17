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

// Nominal sphere radius used for sky-dome placement. Each owner's actual star
// ends up within ±DEPTH_JITTER of this radius.
export const SKY_RADIUS = 100;

// Distance from the viewer when the selected system is fully revealed. Used
// by both the scene (to place the system group) and the camera-tracking logic
// to compute a selected planet's world position. Kept just far enough that a
// typical system's outer orbits still fit inside a comfortable FOV.
export const SYSTEM_NEAR_RADIUS = 24;

// Small deterministic radial offset (±DEPTH_JITTER world units) applied per
// owner. It's a fraction of SKY_RADIUS so the celestial-sphere illusion is
// preserved, but it gives each owner its own depth slot so near-angular
// neighbours don't sit at exactly the same apparent screen size.
const DEPTH_JITTER = 3;

// GitHub treats usernames as case-insensitive for identity, so `Facebook` and
// `facebook` must map to the same star.
function normalizeOwner(owner: string): string {
  return owner.trim().toLowerCase();
}

// Three independent 32-bit FNV-1a hash channels for the same normalized name.
// Different prefixes decorrelate the outputs, giving ~96 bits of total entropy
// across the three spatial dimensions. The separator (`\u0001`) guarantees the
// prefix can't accidentally collide with the start of a username, so
// "azimuth" + "depth" + name can never equal "azimuthdepth" + name.
function hashChannel(prefix: string, owner: string): number {
  return hashString(`${prefix}\u0001${normalizeOwner(owner)}`);
}

// Deterministic, username-only placement on the inside surface of the sky
// sphere. The coordinate depends on nothing but the normalized owner name:
// no layout order, no currently-loaded set, no session state.
//
// Strategy:
//   azimuth θ ∈ [0, 2π)        — uniform, driven by an independent hash
//   polar   φ ∈ [0, π]         — phi = acos(2u - 1) gives an equal-area
//                                distribution across the sphere (no pole
//                                clustering)
//   radius  r ≈ SKY_RADIUS ± DEPTH_JITTER  — tiny deterministic depth slot
//
// Collision characterisation:
//   * Each dimension is driven by an independent 32-bit hash (≈4B steps).
//     Two distinct usernames producing the same (azimuth, elevation) pair
//     requires a ≥2^64 collision, which is not a practical concern.
//   * For N owners, expected nearest-neighbour angular distance is
//     O(1/√N) by uniform sphere sampling; that's a property of the space,
//     not the hash. The DEPTH_JITTER channel gives an extra axis of
//     separation so two owners that happen to land at similar angles still
//     end up at slightly different world positions and apparent sizes.
//   * Conflict handling is intentionally kept as a safety net rather than
//     primary mechanism — the raw hash precision is doing the work.
export function ownerStarPosition(owner: string): StarPosition {
  const azU = hashChannel("owner-azimuth", owner) / 2 ** 32;
  const elU = hashChannel("owner-elevation", owner) / 2 ** 32;
  const depthU = hashChannel("owner-depth", owner) / 2 ** 32;

  const theta = azU * Math.PI * 2;
  const phi = Math.acos(2 * elU - 1);
  const radius = SKY_RADIUS + (depthU - 0.5) * 2 * DEPTH_JITTER;

  return {
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

// Deterministic planet orbit parameters for a given repo within an owner's
// system. This is LOCAL to the system view and intentionally separate from
// universe placement — planets belong to their owner and never need an
// absolute sky coordinate.
export function planetLayout(
  owner: string,
  repoFullName: string,
  index: number
): PlanetLayout {
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
