const MIN_BRIGHTNESS = 0.18;
const MAX_BRIGHTNESS = 1.0;

// Log-compressed brightness for an individual repo.
export function repoBrightness(stars: number): number {
  const normalized = Math.log10(Math.max(stars, 0) + 1) / 6;
  const clamped = Math.min(1, Math.max(0, normalized));
  return MIN_BRIGHTNESS + clamped * (MAX_BRIGHTNESS - MIN_BRIGHTNESS);
}

// Owner brightness aggregates repo star counts before the log step.
export function ownerBrightness(totalStars: number, repoCount: number): number {
  if (repoCount === 0) return MIN_BRIGHTNESS;
  const normalized = Math.log10(totalStars + 1) / 6.5;
  const clamped = Math.min(1, Math.max(0, normalized));
  return MIN_BRIGHTNESS + clamped * (MAX_BRIGHTNESS - MIN_BRIGHTNESS);
}
