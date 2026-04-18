import { useMemo, useState } from "react";
import type { OwnerSystem } from "../types/universe";
import { useUniverseStore } from "../store/useUniverseStore";

export function RepoList() {
  const systems = useUniverseStore((s) => s.systems);
  const selectedOwner = useUniverseStore((s) => s.selectedOwner);
  const selectedRepoId = useUniverseStore((s) => s.selectedRepoId);
  const visibilityThreshold = useUniverseStore((s) => s.visibilityThreshold);
  const selectOwner = useUniverseStore((s) => s.selectOwner);
  const focusRepo = useUniverseStore((s) => s.focusRepo);
  const removeRepo = useUniverseStore((s) => s.removeRepo);
  const clearAll = useUniverseStore((s) => s.clearAll);

  const [filter, setFilter] = useState("");

  const visibleSystems = useMemo<OwnerSystem[]>(() => {
    const q = filter.trim().toLowerCase();
    const thresholdedSystems = systems.filter(
      (system) =>
        system.totalStars >= visibilityThreshold || system.owner === selectedOwner
    );
    if (!q) return thresholdedSystems;
    const out: OwnerSystem[] = [];
    for (const system of thresholdedSystems) {
      const ownerMatches = system.owner.toLowerCase().includes(q);
      if (ownerMatches) {
        out.push(system);
        continue;
      }
      const repos = system.repos.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.fullName.toLowerCase().includes(q)
      );
      if (repos.length > 0) {
        out.push({ ...system, repos });
      }
    }
    return out;
  }, [systems, filter, visibilityThreshold, selectedOwner]);

  if (systems.length === 0) {
    return (
      <div className="panel-section">
        <div className="panel-label">Your universe</div>
        <div className="empty-state">
          Add a repo or import starred repos to begin.
        </div>
      </div>
    );
  }

  const thresholdedSystems = systems.filter(
    (system) =>
      system.totalStars >= visibilityThreshold || system.owner === selectedOwner
  );
  const visibleSystemCount = thresholdedSystems.length;
  const visibleTotalRepos = thresholdedSystems.reduce(
    (sum, s) => sum + s.repos.length,
    0
  );
  const visibleRepos = visibleSystems.reduce((sum, s) => sum + s.repos.length, 0);
  const filtering = filter.trim().length > 0;

  return (
    <div className="panel-section">
      <div className="panel-label-row">
        <span className="panel-label">
          {filtering
            ? `Matches — ${visibleSystems.length} / ${visibleSystemCount} stars, ${visibleRepos} / ${visibleTotalRepos} planets`
            : `Your universe — ${visibleSystemCount} star${visibleSystemCount === 1 ? "" : "s"}, ${visibleTotalRepos} planet${visibleTotalRepos === 1 ? "" : "s"}`}
        </span>
        <button type="button" className="ghost-button tiny" onClick={clearAll}>
          Clear
        </button>
      </div>
      <input
        type="search"
        className="panel-filter"
        placeholder="Filter owners or repos"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        aria-label="Filter owners or repos"
      />
      {visibleSystems.length === 0 ? (
        <div className="empty-state">No matches.</div>
      ) : (
        <ul className="repo-list">
          {visibleSystems.map((system) => (
            <li key={system.owner} className="repo-list-owner">
              <button
                type="button"
                className={`owner-chip ${selectedOwner === system.owner ? "active" : ""}`}
                onClick={() => selectOwner(system.owner)}
              >
                <span className="owner-name">{system.owner}</span>
                <span className="owner-count">{system.repos.length}</span>
              </button>
              <ul className="repo-sublist">
                {system.repos.map((repo) => (
                  <li key={repo.id}>
                    <button
                      type="button"
                      className={`repo-sublist-button${selectedRepoId === repo.id ? " active" : ""}`}
                      onClick={() => focusRepo(repo.id)}
                      title={repo.description ?? repo.fullName}
                    >
                      {repo.name}
                    </button>
                    <span className="repo-sublist-meta">
                      <span>
                        ★ {repo.hydrated === false ? "—" : repo.stars.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        className="ghost-button tiny"
                        onClick={() => removeRepo(repo.id)}
                        aria-label={`Remove ${repo.fullName}`}
                      >
                        ×
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
