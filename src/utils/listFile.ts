import type { Repo } from "../types/universe";

const FILE_FORMAT = "gh-github-list";
const FILE_VERSION = 1;

interface UniverseListFile {
  format: typeof FILE_FORMAT;
  version: number;
  exportedAt: number;
  repos: Repo[];
}

export function downloadUniverseList(repos: Repo[], suggestedName?: string): void {
  if (typeof window === "undefined") return;
  const payload: UniverseListFile = {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    exportedAt: Date.now(),
    repos,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedName ?? defaultFilename();
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Let the click complete before the URL is revoked on some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function readUniverseListFile(file: File): Promise<Repo[]> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("File isn't valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("File doesn't contain a universe list.");
  }
  const obj = parsed as Partial<UniverseListFile>;
  if (obj.format !== FILE_FORMAT) {
    throw new Error("This doesn't look like a saved universe list.");
  }
  if (!Array.isArray(obj.repos)) {
    throw new Error("Saved file has no repos.");
  }
  const repos = obj.repos.filter(isRepoLike);
  if (repos.length === 0) {
    throw new Error("Saved file has no recognisable repos.");
  }
  return repos;
}

function defaultFilename(): string {
  const iso = new Date().toISOString().slice(0, 10);
  return `gh-github-${iso}.json`;
}

function isRepoLike(value: unknown): value is Repo {
  if (!value || typeof value !== "object") return false;
  const r = value as Partial<Repo>;
  return (
    typeof r.id === "string" &&
    typeof r.fullName === "string" &&
    typeof r.name === "string" &&
    typeof r.owner === "string" &&
    typeof r.url === "string" &&
    typeof r.stars === "number"
  );
}
