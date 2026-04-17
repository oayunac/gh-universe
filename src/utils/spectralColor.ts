import { hashString } from "./hash";

// Per-owner deterministic spectral classification.
//
// Pipeline:
//   normalized owner name
//     -> 32-bit FNV-1a hash (namespaced channel)
//     -> normalized to u ∈ [0, 1)
//     -> weighted bucket lookup
//     -> spectral class (M / K / G / F / A / B)
//     -> palette color
//
// Same owner → same class → same color across runs and across views.
//
// Distribution is deliberately non-uniform; it loosely echoes a real stellar
// population so red/orange stars dominate and blue-white stars stay rare:
//
//   M (red)         40%   u ∈ [0.00, 0.40)
//   K (orange)      25%   u ∈ [0.40, 0.65)
//   G (yellow)      15%   u ∈ [0.65, 0.80)
//   F (yellow-white)10%   u ∈ [0.80, 0.90)
//   A (white)        7%   u ∈ [0.90, 0.97)
//   B (blue-white)   3%   u ∈ [0.97, 1.00)
//
// Color encodes spectral class only. Brightness (size + opacity) stays driven
// by the existing popularity-based brightness logic, so the two visual axes
// remain independent.

export type SpectralClass = "M" | "K" | "G" | "F" | "A" | "B";

export interface SpectralInfo {
  spectralClass: SpectralClass;
  /** Hex color string for the star core. */
  color: string;
  /** Plain-language label, e.g. "yellow-white". */
  label: string;
}

// Restrained palette tuned for the calm dark-sky look — warm reds through
// cool blue-whites without veering into neon/cartoon territory. Each color is
// already light enough to read at low opacity, so we don't need to brighten
// it further when a star's brightness is high.
const SPECTRAL_PALETTE: Record<
  SpectralClass,
  { color: string; label: string }
> = {
  M: { color: "#ff9a73", label: "red" },
  K: { color: "#ffc28a", label: "orange" },
  G: { color: "#ffe9a8", label: "yellow" },
  F: { color: "#fff7d6", label: "yellow-white" },
  A: { color: "#eef2ff", label: "white" },
  B: { color: "#bccdff", label: "blue-white" },
};

// Cumulative upper bounds for the weighted distribution above. Ordered M→B
// so the lookup short-circuits on the first bucket that contains u.
const SPECTRAL_BUCKETS: Array<{ cls: SpectralClass; max: number }> = [
  { cls: "M", max: 0.4 },
  { cls: "K", max: 0.65 },
  { cls: "G", max: 0.8 },
  { cls: "F", max: 0.9 },
  { cls: "A", max: 0.97 },
  { cls: "B", max: 1.0 },
];

// GitHub usernames are case-insensitive for identity, so `Facebook` and
// `facebook` must land in the same spectral bucket. Match the same
// normalization used elsewhere for owner-derived hashes.
function normalizeOwner(owner: string): string {
  return owner.trim().toLowerCase();
}

// Namespaced hash channel — the prefix decorrelates this output from the
// positional hashes in layout.ts (azimuth/elevation/depth) so a star's color
// is independent of where it sits in the sky.
function spectralHash(owner: string): number {
  return hashString(`owner-spectral\u0001${normalizeOwner(owner)}`);
}

export function ownerSpectral(owner: string): SpectralInfo {
  const u = spectralHash(owner) / 2 ** 32;
  const bucket =
    SPECTRAL_BUCKETS.find((b) => u < b.max) ??
    SPECTRAL_BUCKETS[SPECTRAL_BUCKETS.length - 1];
  const palette = SPECTRAL_PALETTE[bucket.cls];
  return {
    spectralClass: bucket.cls,
    color: palette.color,
    label: palette.label,
  };
}

// Convenience: just the color, for call sites that don't need the metadata.
export function ownerStarColor(owner: string): string {
  return ownerSpectral(owner).color;
}
