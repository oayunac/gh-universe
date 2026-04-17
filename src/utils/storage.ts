import type { PersistedState, Repo } from "../types/universe";

const STORAGE_KEY = "gh-universe:v1";
const CURRENT_VERSION = 1;

export function loadPersisted(): Repo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed || parsed.version !== CURRENT_VERSION) return [];
    if (!Array.isArray(parsed.repos)) return [];
    return parsed.repos;
  } catch {
    return [];
  }
}

export function savePersisted(repos: Repo[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedState = { version: CURRENT_VERSION, repos };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage disabled — fail silently, the UI still works.
  }
}
