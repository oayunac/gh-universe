import type { PersistedState, Repo, SavedList } from "../types/universe";

const STORAGE_KEY = "github-universe:v1";
const SAVED_LISTS_KEY = "github-universe:saved-lists:v1";
const CURRENT_VERSION = 1;

interface SavedListsDoc {
  version: number;
  lists: SavedList[];
}

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

// Named list snapshots live under their own key so the existing persisted
// state schema is untouched. Schema is versioned independently; bad or
// missing data simply yields an empty list.
export function loadSavedLists(): SavedList[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_LISTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedListsDoc;
    if (!parsed || parsed.version !== CURRENT_VERSION) return [];
    if (!Array.isArray(parsed.lists)) return [];
    return parsed.lists.filter(
      (l): l is SavedList =>
        typeof l?.id === "string" &&
        typeof l?.name === "string" &&
        Array.isArray(l?.repos)
    );
  } catch {
    return [];
  }
}

export function saveSavedLists(lists: SavedList[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: SavedListsDoc = { version: CURRENT_VERSION, lists };
    window.localStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded — fail silently.
  }
}

export function generateSnapshotId(): string {
  const g = globalThis as unknown as { crypto?: Crypto };
  if (g.crypto && typeof g.crypto.randomUUID === "function") {
    return g.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
