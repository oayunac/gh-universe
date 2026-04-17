import { useUniverseStore } from "../store/useUniverseStore";

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function InfoCard() {
  const hoveredId = useUniverseStore((s) => s.hoveredRepoId);
  const repos = useUniverseStore((s) => s.repos);
  const viewMode = useUniverseStore((s) => s.viewMode);

  if (viewMode !== "system" || !hoveredId) return null;
  const repo = repos.find((r) => r.id === hoveredId);
  if (!repo) return null;

  return (
    <div className="info-card">
      <div className="info-card-title">{repo.fullName}</div>
      {repo.description && (
        <div className="info-card-description">{repo.description}</div>
      )}
      <div className="info-card-stats">
        <span>★ {repo.stars.toLocaleString()}</span>
        <span>⑂ {repo.forks.toLocaleString()}</span>
        {repo.language && <span>{repo.language}</span>}
      </div>
      <div className="info-card-footer">
        Updated {formatDate(repo.pushedAt)}
      </div>
    </div>
  );
}
