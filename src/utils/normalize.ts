import type { GitHubRepoRaw } from "../types/github";
import type { OwnerSystem, Repo } from "../types/universe";
import { ownerBrightness } from "./brightness";

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

  const systems: OwnerSystem[] = [];
  for (const [owner, repoList] of buckets) {
    const sorted = [...repoList].sort((a, b) => b.stars - a.stars);
    const totalStars = sorted.reduce((sum, r) => sum + r.stars, 0);
    systems.push({
      owner,
      repos: sorted,
      totalStars,
      brightness: ownerBrightness(totalStars, sorted.length),
    });
  }
  return systems.sort((a, b) => a.owner.localeCompare(b.owner));
}
