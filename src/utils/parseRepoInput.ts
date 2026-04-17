export interface ParsedRepo {
  owner: string;
  name: string;
  fullName: string;
}

const OWNER_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_NAME = /^[A-Za-z0-9._-]{1,100}$/;

export function parseRepoInput(input: string): ParsedRepo | null {
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

  return { owner, name, fullName: `${owner}/${name}` };
}
