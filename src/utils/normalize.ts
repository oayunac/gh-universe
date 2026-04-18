import type { GitHubRepoRaw } from "../types/github";
import type { OwnerSystem, Repo } from "../types/universe";
import { ownerBrightness, PENDING_OWNER_BRIGHTNESS } from "./brightness";

export function normalizeRepo(raw: GitHubRepoRaw, addedAt = Date.now()): Repo {
  return {
    id: raw.full_name.toLowerCase(),
    fullName: raw.full_name,
    name: raw.name,
    owner: raw.owner.login,
    url: raw.html_url,
    description: raw.description,
    stars: raw.stargazers_count ?? 0,
    forks: raw.forks_count ?? 0,
    language: raw.language,
    pushedAt: raw.pushed_at,
    addedAt,
    hydrated: true,
  };
}

// Build a placeholder Repo from just the `owner/name` pair known at share
// time. Intentionally cheap — no API call — so large share payloads can
// land without spending the GitHub rate budget. The `hydrated` flag tells
// downstream code that stars/forks/description/etc. are defaults, not truth.
export function createStubRepo(
  owner: string,
  name: string,
  addedAt = Date.now()
): Repo {
  return {
    id: `${owner}/${name}`.toLowerCase(),
    fullName: `${owner}/${name}`,
    name,
    owner,
    url: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    description: null,
    stars: 0,
    forks: 0,
    language: null,
    pushedAt: "",
    addedAt,
    hydrated: false,
  };
}

export function groupByOwner(repos: Repo[]): OwnerSystem[] {
  const buckets = new Map<string, Repo[]>();
  for (const repo of repos) {
    const key = repo.owner;
    const list = buckets.get(key);
    if (list) list.push(repo);
    else buckets.set(key, [repo]);
  }

  // First pass: assemble each system without brightness so we can establish
  // the population maximum used to normalize the brightness curve.
  const partials = Array.from(buckets, ([owner, repoList]) => {
    const sorted = [...repoList].sort((a, b) => b.stars - a.stars);
    const totalStars = sorted.reduce((sum, r) => sum + r.stars, 0);
    return { owner, repos: sorted, totalStars };
  });
  const maxTotalStars = partials.reduce((m, p) => Math.max(m, p.totalStars), 0);

  const systems: OwnerSystem[] = partials.map((p) => {
    // A system whose repos are all still stubs has a true totalStars of 0,
    // which would collapse it onto the minimum brightness alongside any
    // hydrated-but-starless owner. Pin these to a deterministic mid-range
    // brightness so the sky stays informative while hydration is pending.
    const anyHydrated = p.repos.some((r) => r.hydrated !== false);
    const brightness = anyHydrated
      ? ownerBrightness(p.totalStars, p.repos.length, maxTotalStars)
      : PENDING_OWNER_BRIGHTNESS;
    return { ...p, brightness };
  });
  return systems.sort((a, b) => a.owner.localeCompare(b.owner));
}
