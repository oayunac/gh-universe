export interface ParsedRepoInput {
  kind: "repo";
  owner: string;
  name: string;
  fullName: string;
}

export interface ParsedOwnerInput {
  kind: "owner";
  owner: string;
}

export type ParsedInput = ParsedRepoInput | ParsedOwnerInput;

const OWNER_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_NAME = /^[A-Za-z0-9._-]{1,100}$/;

export function parseRepoInput(input: string): ParsedRepoInput | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  let owner: string;
  let name: string;

  if (trimmed.includes("://") || trimmed.startsWith("github.com")) {
    try {
      const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      if (!/github\.com$/i.test(url.hostname)) return null;
      const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
      if (parts.length < 2) return null;
      [owner, name] = parts;
      name = name.replace(/\.git$/i, "");
    } catch {
      return null;
    }
  } else {
    const parts = trimmed.split("/").filter(Boolean);
    if (parts.length !== 2) return null;
    [owner, name] = parts;
    name = name.replace(/\.git$/i, "");
  }

  if (!OWNER_NAME.test(owner) || !REPO_NAME.test(name)) return null;

  return { kind: "repo", owner, name, fullName: `${owner}/${name}` };
}

// Accepts a bare owner login, an @login form, or a github.com/<login> URL.
// Rejects anything that looks like owner/repo or has extra path segments.
export function parseOwnerInput(input: string): ParsedOwnerInput | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  let candidate = trimmed;

  if (trimmed.startsWith("@")) {
    candidate = trimmed.slice(1);
  } else if (trimmed.includes("://") || trimmed.startsWith("github.com")) {
    try {
      const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      if (!/github\.com$/i.test(url.hostname)) return null;
      const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
      if (parts.length !== 1 || !parts[0]) return null;
      candidate = parts[0];
    } catch {
      return null;
    }
  }

  if (candidate.includes("/")) return null;
  if (!OWNER_NAME.test(candidate)) return null;

  return { kind: "owner", owner: candidate };
}

// Repo form wins when ambiguous (it's more specific). Bare owner is a
// fallback. Returns null if neither interpretation is valid.
export function parseOwnerOrRepoInput(input: string): ParsedInput | null {
  return parseRepoInput(input) ?? parseOwnerInput(input);
}
