import { create } from "zustand";
import {
  fetchRepo,
  fetchStarredRepos,
  GitHubError,
  searchRepos,
} from "../api/github";
import type { Repo, OwnerSystem, SavedList } from "../types/universe";
import type { GitHubRepoRaw } from "../types/github";
import { groupByOwner, normalizeRepo } from "../utils/normalize";
import { parseRepoInput } from "../utils/parseRepoInput";
import {
  generateSnapshotId,
  loadPersisted,
  loadSavedLists,
  savePersisted,
  saveSavedLists,
} from "../utils/storage";

interface AddRepoStatus {
  loading: boolean;
  error: string | null;
}

interface ImportStatus {
  loading: boolean;
  error: string | null;
  candidates: Repo[];
  username: string | null;
}

interface DiscoverStatus {
  loading: boolean;
  error: string | null;
  lastDiscovered: string | null;
}

interface UniverseState {
  repos: Repo[];
  systems: OwnerSystem[];
  selectedOwner: string | null;
  selectedRepoId: string | null;
  hoveredRepoId: string | null;

  addRepoStatus: AddRepoStatus;
  importStatus: ImportStatus;
  discoverStatus: DiscoverStatus;
  savedLists: SavedList[];

  addRepoByInput: (input: string) => Promise<void>;
  removeRepo: (id: string) => void;
  clearAll: () => void;

  startImport: (username: string) => Promise<void>;
  removeImportCandidate: (id: string) => void;
  confirmImport: () => void;
  cancelImport: () => void;

  discoverOwner: () => Promise<void>;

  saveCurrentList: (name: string) => void;
  loadSavedList: (id: string) => void;
  deleteSavedList: (id: string) => void;

  selectOwner: (owner: string) => void;
  clearSelection: () => void;
  selectRepo: (id: string) => void;
  deselectRepo: () => void;
  focusRepo: (id: string) => void;
  setHoveredRepo: (id: string | null) => void;
}

function refreshSystems(repos: Repo[]): OwnerSystem[] {
  return groupByOwner(repos);
}

function mergeRepo(existing: Repo[], incoming: Repo): Repo[] {
  const idx = existing.findIndex((r) => r.id === incoming.id);
  if (idx === -1) return [...existing, incoming];
  const next = [...existing];
  next[idx] = { ...incoming, addedAt: existing[idx].addedAt };
  return next;
}

function errorMessage(err: unknown): string {
  if (err instanceof GitHubError) {
    if (err.kind === "not_found") return "Repository not found on GitHub.";
    if (err.kind === "rate_limit") return err.message;
    if (err.kind === "network") return "Network error. Check your connection.";
    return err.message;
  }
  return err instanceof Error ? err.message : "Unknown error.";
}

const initialRepos = loadPersisted();

export const useUniverseStore = create<UniverseState>((set, get) => ({
  repos: initialRepos,
  systems: refreshSystems(initialRepos),
  selectedOwner: null,
  selectedRepoId: null,
  hoveredRepoId: null,

  addRepoStatus: { loading: false, error: null },
  importStatus: { loading: false, error: null, candidates: [], username: null },
  discoverStatus: { loading: false, error: null, lastDiscovered: null },
  savedLists: loadSavedLists(),

  addRepoByInput: async (input: string) => {
    const parsed = parseRepoInput(input);
    if (!parsed) {
      set({ addRepoStatus: { loading: false, error: "Use `owner/repo` or a GitHub URL." } });
      return;
    }

    const id = `${parsed.owner}/${parsed.name}`.toLowerCase();
    if (get().repos.some((r) => r.id === id)) {
      set({ addRepoStatus: { loading: false, error: "Repo already in your universe." } });
      return;
    }

    set({ addRepoStatus: { loading: true, error: null } });
    try {
      const raw = await fetchRepo(parsed.owner, parsed.name);
      const repo = normalizeRepo(raw);
      const repos = mergeRepo(get().repos, repo);
      savePersisted(repos);
      set({
        repos,
        systems: refreshSystems(repos),
        addRepoStatus: { loading: false, error: null },
      });
    } catch (err) {
      set({ addRepoStatus: { loading: false, error: errorMessage(err) } });
    }
  },

  removeRepo: (id: string) => {
    const repos = get().repos.filter((r) => r.id !== id);
    savePersisted(repos);
    const systems = refreshSystems(repos);
    const selectedOwner = get().selectedOwner;
    const ownerStillPresent = selectedOwner
      ? systems.some((s) => s.owner === selectedOwner)
      : false;
    const selectedRepoId = get().selectedRepoId;
    const repoStillPresent =
      selectedRepoId && repos.some((r) => r.id === selectedRepoId);
    const hoveredRepoId = get().hoveredRepoId;
    set({
      repos,
      systems,
      selectedOwner: ownerStillPresent ? selectedOwner : null,
      selectedRepoId: ownerStillPresent && repoStillPresent ? selectedRepoId : null,
      hoveredRepoId:
        hoveredRepoId && repos.some((r) => r.id === hoveredRepoId)
          ? hoveredRepoId
          : null,
    });
  },

  clearAll: () => {
    savePersisted([]);
    set({
      repos: [],
      systems: [],
      selectedOwner: null,
      selectedRepoId: null,
      hoveredRepoId: null,
    });
  },

  startImport: async (username: string) => {
    const trimmed = username.trim();
    if (!trimmed) {
      set({
        importStatus: {
          loading: false,
          error: "Enter a GitHub username.",
          candidates: [],
          username: null,
        },
      });
      return;
    }
    set({
      importStatus: { loading: true, error: null, candidates: [], username: trimmed },
    });
    try {
      const raws: GitHubRepoRaw[] = await fetchStarredRepos(trimmed);
      if (raws.length === 0) {
        set({
          importStatus: {
            loading: false,
            error: `No starred repos found for @${trimmed}.`,
            candidates: [],
            username: trimmed,
          },
        });
        return;
      }
      const candidates = raws.map((r) => normalizeRepo(r));
      set({
        importStatus: { loading: false, error: null, candidates, username: trimmed },
      });
    } catch (err) {
      set({
        importStatus: {
          loading: false,
          error: errorMessage(err),
          candidates: [],
          username: trimmed,
        },
      });
    }
  },

  removeImportCandidate: (id: string) => {
    const { importStatus } = get();
    set({
      importStatus: {
        ...importStatus,
        candidates: importStatus.candidates.filter((c) => c.id !== id),
      },
    });
  },

  confirmImport: () => {
    const { importStatus, repos } = get();
    if (importStatus.candidates.length === 0) return;
    const merged = importStatus.candidates.reduce(
      (acc, candidate) => mergeRepo(acc, { ...candidate, addedAt: Date.now() }),
      repos
    );
    savePersisted(merged);
    set({
      repos: merged,
      systems: refreshSystems(merged),
      importStatus: { loading: false, error: null, candidates: [], username: null },
    });
  },

  cancelImport: () => {
    set({
      importStatus: { loading: false, error: null, candidates: [], username: null },
    });
  },

  // "Scan the sky" — picks a random page of popular repos, finds the first
  // one whose owner isn't already in the local universe, then pulls that
  // owner's top repos so the system has visible planets. No ranking of its
  // own; GitHub's search sort does the heavy lifting.
  discoverOwner: async () => {
    const prior = get().discoverStatus.lastDiscovered;
    set({
      discoverStatus: { loading: true, error: null, lastDiscovered: prior },
    });
    try {
      const existingOwners = new Set(
        get().systems.map((s) => s.owner.toLowerCase())
      );
      const page = 1 + Math.floor(Math.random() * 20);
      const candidates = await searchRepos({
        q: "stars:>200",
        sort: "stars",
        order: "desc",
        perPage: 50,
        page,
      });
      if (candidates.length === 0) {
        set({
          discoverStatus: {
            loading: false,
            error: "No candidates returned — try again.",
            lastDiscovered: prior,
          },
        });
        return;
      }

      const shuffled = [...candidates].sort(() => Math.random() - 0.5);
      const novel = shuffled.find(
        (r) => !existingOwners.has(r.owner.login.toLowerCase())
      );
      if (!novel) {
        set({
          discoverStatus: {
            loading: false,
            error: "All stars here are already in your universe — try again.",
            lastDiscovered: prior,
          },
        });
        return;
      }
      const ownerLogin = novel.owner.login;

      // Fetch a small cluster of that owner's top repos so the new star has
      // enough planets to feel like a real system.
      let ownerRepos: GitHubRepoRaw[] = [];
      try {
        ownerRepos = await searchRepos({
          q: `user:${ownerLogin}`,
          sort: "stars",
          order: "desc",
          perPage: 5,
          page: 1,
        });
      } catch {
        // Fall back to just the repo that surfaced the owner.
      }
      const pool = ownerRepos.length > 0 ? ownerRepos : [novel];
      const now = Date.now();
      const merged = pool
        .map((r) => normalizeRepo(r, now))
        .reduce((acc, repo) => mergeRepo(acc, repo), get().repos);

      savePersisted(merged);
      set({
        repos: merged,
        systems: refreshSystems(merged),
        selectedOwner: ownerLogin,
        selectedRepoId: null,
        hoveredRepoId: null,
        discoverStatus: {
          loading: false,
          error: null,
          lastDiscovered: ownerLogin,
        },
      });
    } catch (err) {
      set({
        discoverStatus: {
          loading: false,
          error: errorMessage(err),
          lastDiscovered: prior,
        },
      });
    }
  },

  saveCurrentList: (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { repos, savedLists } = get();
    const snapshot: SavedList = {
      id: generateSnapshotId(),
      name: trimmed,
      createdAt: Date.now(),
      repos,
    };
    const next = [...savedLists, snapshot];
    saveSavedLists(next);
    set({ savedLists: next });
  },

  loadSavedList: (id: string) => {
    const list = get().savedLists.find((l) => l.id === id);
    if (!list) return;
    const repos = list.repos;
    savePersisted(repos);
    set({
      repos,
      systems: refreshSystems(repos),
      selectedOwner: null,
      selectedRepoId: null,
      hoveredRepoId: null,
    });
  },

  deleteSavedList: (id: string) => {
    const next = get().savedLists.filter((l) => l.id !== id);
    saveSavedLists(next);
    set({ savedLists: next });
  },

  selectOwner: (owner: string) => {
    if (!get().systems.some((s) => s.owner === owner)) return;
    if (get().selectedOwner === owner) return;
    // Changing owner always clears any centered planet — otherwise the new
    // system would silently inherit a selection that doesn't belong to it.
    set({ selectedOwner: owner, selectedRepoId: null, hoveredRepoId: null });
  },

  clearSelection: () => {
    set({ selectedOwner: null, selectedRepoId: null, hoveredRepoId: null });
  },

  selectRepo: (id: string) => {
    const repo = get().repos.find((r) => r.id === id);
    if (!repo) return;
    // A repo only makes sense to center once its owner is the active system.
    if (get().selectedOwner !== repo.owner) return;
    set({ selectedRepoId: id });
  },

  deselectRepo: () => {
    if (get().selectedRepoId === null) return;
    set({ selectedRepoId: null });
  },

  // Set both selectedOwner and selectedRepoId from any state in one commit —
  // the sidebar uses this to navigate straight to a planet regardless of the
  // current selection. The scene reacts: camera pans to the owner, auto-zoom
  // narrows FOV, and the per-frame retarget homes in on the planet.
  focusRepo: (id: string) => {
    const repo = get().repos.find((r) => r.id === id);
    if (!repo) return;
    set({
      selectedOwner: repo.owner,
      selectedRepoId: id,
      hoveredRepoId: null,
    });
  },

  setHoveredRepo: (id: string | null) => {
    set({ hoveredRepoId: id });
  },
}));
