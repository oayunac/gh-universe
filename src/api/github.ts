import type { GitHubRepoRaw } from "../types/github";

const API_BASE = "https://api.github.com";

export class GitHubError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly kind: "not_found" | "rate_limit" | "network" | "unknown" = "unknown"
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

function parseRateLimit(response: Response): string | null {
  const remaining = response.headers.get("x-ratelimit-remaining");
  const reset = response.headers.get("x-ratelimit-reset");
  if (remaining === "0" && reset) {
    const resetAt = new Date(parseInt(reset, 10) * 1000);
    return `GitHub rate limit reached. Try again after ${resetAt.toLocaleTimeString()}.`;
  }
  return null;
}

async function githubFetch(path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    throw new GitHubError(
      err instanceof Error ? err.message : "Network error",
      undefined,
      "network"
    );
  }

  if (response.status === 403 || response.status === 429) {
    const msg = parseRateLimit(response) ?? "GitHub request was throttled.";
    throw new GitHubError(msg, response.status, "rate_limit");
  }
  if (response.status === 404) {
    throw new GitHubError("Not found on GitHub.", 404, "not_found");
  }
  if (!response.ok) {
    throw new GitHubError(`GitHub request failed (${response.status}).`, response.status);
  }
  return response;
}

export async function fetchRepo(owner: string, name: string): Promise<GitHubRepoRaw> {
  const response = await githubFetch(`/repos/${owner}/${name}`);
  return (await response.json()) as GitHubRepoRaw;
}

// Follows `Link` header pagination; capped to keep the import calm.
export async function fetchStarredRepos(
  username: string,
  options: { maxPages?: number } = {}
): Promise<GitHubRepoRaw[]> {
  const maxPages = options.maxPages ?? 5;
  const results: GitHubRepoRaw[] = [];
  let page = 1;

  while (page <= maxPages) {
    const response = await githubFetch(
      `/users/${encodeURIComponent(username)}/starred?per_page=100&page=${page}`
    );
    const batch = (await response.json()) as GitHubRepoRaw[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    results.push(...batch);

    const link = response.headers.get("link") ?? "";
    if (!/rel="next"/.test(link)) break;
    page += 1;
  }

  return results;
}
