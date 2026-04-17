const MIN_BRIGHTNESS = 0.08;
const MAX_BRIGHTNESS = 1.0;

// >1 stretches the gradient: small-star owners stay distinctly dim while only
// the very top of the population approaches max brightness. Tuned by feel —
// big enough that a 100-star owner is clearly dimmer than a 100k-star one,
// small enough that the bottom of the list still glows above the floor.
const CONTRAST_GAMMA = 1.8;

// Log-compressed brightness for an individual repo.
export function repoBrightness(stars: number): number {
  const normalized = Math.log10(Math.max(stars, 0) + 1) / 6;
  const clamped = Math.min(1, Math.max(0, normalized));
  return MIN_BRIGHTNESS + clamped * (MAX_BRIGHTNESS - MIN_BRIGHTNESS);
}

// Owner brightness is population-aware: the brightest owner in the current
// dataset always sits at MAX_BRIGHTNESS, and the rest fan out below in a
// log-then-gamma curve. This guarantees that whatever set of repos the user
// has loaded, the visual gradient uses the full range — a list of small
// projects still has standouts, and a list with a 1M-star giant doesn't
// flatten everything else into the noise.
export function ownerBrightness(
  totalStars: number,
  repoCount: number,
  maxTotalStars: number
): number {
  if (repoCount === 0) return MIN_BRIGHTNESS;
  const logVal = Math.log10(totalStars + 1);
  // Guard against degenerate populations (single owner, all-zero stars).
  const logMax = Math.log10(Math.max(maxTotalStars, totalStars, 1) + 1);
  const t = logMax > 0 ? Math.min(1, logVal / logMax) : 0;
  const curved = Math.pow(t, CONTRAST_GAMMA);
  return MIN_BRIGHTNESS + curved * (MAX_BRIGHTNESS - MIN_BRIGHTNESS);
}
