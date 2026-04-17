import { useUniverseStore } from "../store/useUniverseStore";

export function RepoList() {
  const systems = useUniverseStore((s) => s.systems);
  const selectedOwner = useUniverseStore((s) => s.selectedOwner);
  const selectOwner = useUniverseStore((s) => s.selectOwner);
  const removeRepo = useUniverseStore((s) => s.removeRepo);
  const clearAll = useUniverseStore((s) => s.clearAll);

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

  const totalRepos = systems.reduce((sum, s) => sum + s.repos.length, 0);

  return (
    <div className="panel-section">
      <div className="panel-label-row">
        <span className="panel-label">
          Your universe — {systems.length} star
          {systems.length === 1 ? "" : "s"}, {totalRepos} planet
          {totalRepos === 1 ? "" : "s"}
        </span>
        <button type="button" className="ghost-button tiny" onClick={clearAll}>
          Clear
        </button>
      </div>
      <ul className="repo-list">
        {systems.map((system) => (
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
                  <span className="repo-sublist-name" title={repo.description ?? ""}>
                    {repo.name}
                  </span>
                  <span className="repo-sublist-meta">
                    <span>★ {repo.stars.toLocaleString()}</span>
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
    </div>
  );
}
