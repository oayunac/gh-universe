import { create } from "zustand";
import { fetchRepo, fetchStarredRepos, GitHubError } from "../api/github";
import type { Repo, OwnerSystem } from "../types/universe";
import type { GitHubRepoRaw } from "../types/github";
import { groupByOwner, normalizeRepo } from "../utils/normalize";
import { parseRepoInput } from "../utils/parseRepoInput";
import { loadPersisted, savePersisted } from "../utils/storage";

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

interface UniverseState {
  repos: Repo[];
  systems: OwnerSystem[];
  selectedOwner: string | null;
  hoveredRepoId: string | null;

  addRepoStatus: AddRepoStatus;
  importStatus: ImportStatus;

  addRepoByInput: (input: string) => Promise<void>;
  removeRepo: (id: string) => void;
  clearAll: () => void;

  startImport: (username: string) => Promise<void>;
  removeImportCandidate: (id: string) => void;
  confirmImport: () => void;
  cancelImport: () => void;

  selectOwner: (owner: string) => void;
  clearSelection: () => void;
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
  hoveredRepoId: null,

  addRepoStatus: { loading: false, error: null },
  importStatus: { loading: false, error: null, candidates: [], username: null },

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
    const hoveredRepoId = get().hoveredRepoId;
    set({
      repos,
      systems,
      selectedOwner: ownerStillPresent ? selectedOwner : null,
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

  selectOwner: (owner: string) => {
    if (!get().systems.some((s) => s.owner === owner)) return;
    if (get().selectedOwner === owner) return;
    set({ selectedOwner: owner, hoveredRepoId: null });
  },

  clearSelection: () => {
    set({ selectedOwner: null, hoveredRepoId: null });
  },

  setHoveredRepo: (id: string | null) => {
    set({ hoveredRepoId: id });
  },
}));
