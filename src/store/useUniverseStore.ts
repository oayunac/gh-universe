import { create } from "zustand";
import {
  fetchRepo,
  fetchStarredRepos,
  GitHubError,
  searchRepos,
} from "../api/github";
import type { Repo, OwnerSystem } from "../types/universe";
import type { GitHubRepoRaw } from "../types/github";
import { createStubRepo, groupByOwner, normalizeRepo } from "../utils/normalize";
import { parseOwnerOrRepoInput } from "../utils/parseRepoInput";
import { loadPersisted, savePersisted } from "../utils/storage";
import type { ParsedShare } from "../utils/shareCodec";

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

interface ShareImportStatus {
  loading: boolean;
  error: string | null;
  // One-shot note shown after a successful import. Cleared on the next
  // mutation so it doesn't hang around indefinitely.
  note: string | null;
}

// Tracks which repo ids have an in-flight hydration fetch so a flurry of
// re-selections can't duplicate requests. Kept outside the zustand state
// because it's transient and doesn't need to drive re-renders.
const hydrationInFlight = new Set<string>();

interface UniverseState {
  repos: Repo[];
  systems: OwnerSystem[];
  selectedOwner: string | null;
  selectedRepoId: string | null;
  hoveredRepoId: string | null;
  // Minimum total-star count an owner must have to render in the sky. The
  // selected owner is exempt so the user can't lose track of their selection
  // by sliding the threshold above it.
  visibilityThreshold: number;

  addRepoStatus: AddRepoStatus;
  importStatus: ImportStatus;
  discoverStatus: DiscoverStatus;
  shareImportStatus: ShareImportStatus;

  // Decoded share payload waiting for a user decision (or waiting for the
  // auto-apply path when the local universe is empty). The URL hash is
  // cleared as soon as the payload lands in the store, so a refresh won't
  // re-prompt.
  pendingShare: ParsedShare | null;

  addRepoByInput: (input: string) => Promise<void>;
  removeRepo: (id: string) => void;
  clearAll: () => void;
  replaceRepos: (repos: Repo[]) => void;

  startImport: (username: string) => Promise<void>;
  removeImportCandidate: (id: string) => void;
  confirmImport: () => void;
  cancelImport: () => void;

  discoverOwner: () => Promise<void>;

  receivePendingShare: (payload: ParsedShare) => void;
  dismissPendingShare: () => void;
  applyPendingShare: () => Promise<void>;
  clearShareImportNote: () => void;

  // Lazy-hydrate a single repo or all of an owner's repos. Both are no-ops
  // when the repo/owner is already hydrated or has a fetch in flight, so
  // callers can invoke them freely from selection side effects.
  hydrateRepo: (id: string) => Promise<void>;
  hydrateOwner: (owner: string) => Promise<void>;

  selectOwner: (owner: string) => void;
  clearSelection: () => void;
  selectRepo: (id: string) => void;
  deselectRepo: () => void;
  focusRepo: (id: string) => void;
  setHoveredRepo: (id: string | null) => void;

  setVisibilityThreshold: (threshold: number) => void;
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
  visibilityThreshold: 0,

  addRepoStatus: { loading: false, error: null },
  importStatus: { loading: false, error: null, candidates: [], username: null },
  discoverStatus: { loading: false, error: null, lastDiscovered: null },
  shareImportStatus: { loading: false, error: null, note: null },
  pendingShare: null,

  addRepoByInput: async (input: string) => {
    const parsed = parseOwnerOrRepoInput(input);
    if (!parsed) {
      set({
        addRepoStatus: {
          loading: false,
          error: "Use `owner`, `owner/repo`, or a GitHub URL.",
        },
      });
      return;
    }

    if (parsed.kind === "repo") {
      const id = `${parsed.owner}/${parsed.name}`.toLowerCase();
      if (get().repos.some((r) => r.id === id)) {
        set({
          addRepoStatus: {
            loading: false,
            error: `${parsed.fullName} is already in your universe.`,
          },
        });
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
        const message =
          err instanceof GitHubError && err.kind === "not_found"
            ? `${parsed.fullName} isn't on GitHub (deleted or renamed?).`
            : errorMessage(err);
        set({ addRepoStatus: { loading: false, error: message } });
      }
      return;
    }

    // parsed.kind === "owner" — pull a cluster of the owner's top repos so
    // the resulting star actually has planets. Duplicates are harmless:
    // mergeRepo updates in place and leaves the list length unchanged.
    const ownerLogin = parsed.owner;
    set({ addRepoStatus: { loading: true, error: null } });
    try {
      const fetched = await searchRepos({
        q: `user:${ownerLogin}`,
        sort: "stars",
        order: "desc",
        perPage: 5,
      });
      if (fetched.length === 0) {
        set({
          addRepoStatus: {
            loading: false,
            error: `No public repos found for @${ownerLogin}.`,
          },
        });
        return;
      }

      const before = get().repos;
      const beforeIds = new Set(before.map((r) => r.id));
      const now = Date.now();
      const merged = fetched
        .map((r) => normalizeRepo(r, now))
        .reduce((acc, repo) => mergeRepo(acc, repo), before);
      const addedCount = merged.filter((r) => !beforeIds.has(r.id)).length;

      if (addedCount === 0) {
        set({
          addRepoStatus: {
            loading: false,
            error: `@${ownerLogin}'s top repos are already in your universe.`,
          },
        });
        return;
      }

      savePersisted(merged);
      set({
        repos: merged,
        systems: refreshSystems(merged),
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

  // Used by the save/load-from-disk flow: drops the current list in favour
  // of an externally sourced set (validated by the caller), re-groups
  // systems, and clears any stale selection.
  replaceRepos: (repos: Repo[]) => {
    savePersisted(repos);
    set({
      repos,
      systems: refreshSystems(repos),
      selectedOwner: null,
      selectedRepoId: null,
      hoveredRepoId: null,
    });
  },

  receivePendingShare: (payload: ParsedShare) => {
    // No-op if the share is empty — nothing to import, no need to prompt.
    if (!payload || payload.owners.length === 0) return;
    set({
      pendingShare: payload,
      shareImportStatus: { loading: false, error: null, note: null },
    });
  },

  dismissPendingShare: () => {
    set({ pendingShare: null });
  },

  // Materializes the pending share as a set of stub repos without hitting
  // the GitHub API. Stubs carry only the identity known from the URL
  // (owner/name/id/url) — stars, description, etc. are placeholders until
  // the user actually engages with a system, at which point hydrateOwner
  // backfills real metadata. This keeps large shares (dozens+ of repos)
  // from burning the unauthenticated rate budget on initial load.
  applyPendingShare: async () => {
    const pending = get().pendingShare;
    if (!pending || pending.owners.length === 0) return;

    const now = Date.now();
    const imported: Repo[] = [];
    const seen = new Set<string>();
    for (const o of pending.owners) {
      for (const name of o.repos) {
        const stub = createStubRepo(o.owner, name, now);
        if (seen.has(stub.id)) continue;
        seen.add(stub.id);
        imported.push(stub);
      }
    }

    if (imported.length === 0) {
      set({
        pendingShare: null,
        shareImportStatus: {
          loading: false,
          error: "Shared payload contained no valid repositories.",
          note: null,
        },
      });
      return;
    }

    savePersisted(imported);
    set({
      repos: imported,
      systems: refreshSystems(imported),
      selectedOwner: null,
      selectedRepoId: null,
      hoveredRepoId: null,
      pendingShare: null,
      shareImportStatus: {
        loading: false,
        error: null,
        note: `Imported ${imported.length} shared repo${imported.length === 1 ? "" : "s"} — details load when you open them.`,
      },
    });
  },

  clearShareImportNote: () => {
    const status = get().shareImportStatus;
    if (!status.error && !status.note) return;
    set({ shareImportStatus: { loading: false, error: null, note: null } });
  },

  hydrateRepo: async (id: string) => {
    if (hydrationInFlight.has(id)) return;
    const target = get().repos.find((r) => r.id === id);
    if (!target || target.hydrated !== false) return;
    hydrationInFlight.add(id);
    try {
      const raw = await fetchRepo(target.owner, target.name);
      const next = normalizeRepo(raw, target.addedAt);
      const repos = get().repos.map((r) => (r.id === id ? next : r));
      savePersisted(repos);
      set({ repos, systems: refreshSystems(repos) });
    } catch {
      // Leave the stub alone — the user can retry by re-selecting. We
      // deliberately don't surface a toast per failed repo; a whole-owner
      // failure already shows up via hydrateOwner.
    } finally {
      hydrationInFlight.delete(id);
    }
  },

  hydrateOwner: async (owner: string) => {
    const stubs = get().repos.filter(
      (r) =>
        r.owner === owner &&
        r.hydrated === false &&
        !hydrationInFlight.has(r.id)
    );
    if (stubs.length === 0) return;
    stubs.forEach((s) => hydrationInFlight.add(s.id));
    try {
      const results = await Promise.allSettled(
        stubs.map((s) => fetchRepo(s.owner, s.name))
      );
      const updates = new Map<string, Repo>();
      results.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          const stub = stubs[idx];
          updates.set(stub.id, normalizeRepo(result.value, stub.addedAt));
        }
      });
      if (updates.size === 0) return;
      const repos = get().repos.map((r) => updates.get(r.id) ?? r);
      savePersisted(repos);
      set({ repos, systems: refreshSystems(repos) });
    } finally {
      stubs.forEach((s) => hydrationInFlight.delete(s.id));
    }
  },

  selectOwner: (owner: string) => {
    if (!get().systems.some((s) => s.owner === owner)) return;
    if (get().selectedOwner === owner) return;
    // Changing owner always clears any centered planet — otherwise the new
    // system would silently inherit a selection that doesn't belong to it.
    set({ selectedOwner: owner, selectedRepoId: null, hoveredRepoId: null });
    // Fire-and-forget: actually picking a system means the user is about to
    // inspect it, so this is the right moment to spend rate budget on its
    // real metadata. No-op if everything is already hydrated.
    get().hydrateOwner(owner);
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
    // Opening a single planet is the most direct signal the user wants this
    // repo's details. Prioritize hydrating just this one.
    if (repo.hydrated === false) get().hydrateRepo(id);
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
    // Hydrate the requested repo first (fast path for the SelectionPanel),
    // then catch up the rest of its system in the background.
    if (repo.hydrated === false) get().hydrateRepo(id);
    get().hydrateOwner(repo.owner);
  },

  setHoveredRepo: (id: string | null) => {
    set({ hoveredRepoId: id });
  },

  setVisibilityThreshold: (threshold: number) => {
    set({ visibilityThreshold: Math.max(0, Math.floor(threshold)) });
  },
}));
