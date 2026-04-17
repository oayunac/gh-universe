import { useUniverseStore } from "../store/useUniverseStore";
import { ownerSpectral } from "../utils/spectralColor";
import type { OwnerSystem, Repo } from "../types/universe";

function formatNumber(n: number): string {
  return n.toLocaleString();
}

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

// Persistent fixed-position card describing whatever the user has currently
// selected. Mirrors the scene's hierarchy:
//   no selection         → renders nothing
//   owner selected       → "STAR" view (spectral class, totals, GitHub link)
//   owner + repo selected → "PLANET" view (repo metadata + GitHub link)
export function SelectionPanel() {
  const selectedOwner = useUniverseStore((s) => s.selectedOwner);
  const selectedRepoId = useUniverseStore((s) => s.selectedRepoId);
  const systems = useUniverseStore((s) => s.systems);
  const repos = useUniverseStore((s) => s.repos);

  if (!selectedOwner) return null;

  const system = systems.find((s) => s.owner === selectedOwner);
  if (!system) return null;

  const spectral = ownerSpectral(selectedOwner);

  if (selectedRepoId) {
    const repo = repos.find((r) => r.id === selectedRepoId);
    if (repo) return <PlanetView repo={repo} owner={selectedOwner} spectralColor={spectral.color} />;
  }

  return <StarView system={system} spectral={spectral} />;
}

function StarView({
  system,
  spectral,
}: {
  system: OwnerSystem;
  spectral: ReturnType<typeof ownerSpectral>;
}) {
  return (
    <section className="selection-panel" aria-label="Selected star">
      <header className="selection-panel-header">
        <span className="selection-panel-kind">Star</span>
        <span className="selection-panel-spectral">
          <span
            className="selection-panel-dot"
            style={{ background: spectral.color }}
            aria-hidden
          />
          {spectral.spectralClass}-class · {spectral.label}
        </span>
      </header>
      <div className="selection-panel-title">{system.owner}</div>
      <div className="selection-panel-stats">
        <span>★ {formatNumber(system.totalStars)} total</span>
        <span>
          {system.repos.length} {system.repos.length === 1 ? "planet" : "planets"}
        </span>
      </div>
      <a
        className="selection-panel-link"
        href={`https://github.com/${encodeURIComponent(system.owner)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        View on GitHub →
      </a>
    </section>
  );
}

function PlanetView({
  repo,
  owner,
  spectralColor,
}: {
  repo: Repo;
  owner: string;
  spectralColor: string;
}) {
  return (
    <section className="selection-panel" aria-label="Selected planet">
      <header className="selection-panel-header">
        <span className="selection-panel-kind">Planet</span>
        <span className="selection-panel-host">
          <span
            className="selection-panel-dot"
            style={{ background: spectralColor }}
            aria-hidden
          />
          {owner}
        </span>
      </header>
      <div className="selection-panel-title">{repo.fullName}</div>
      {repo.description && (
        <p className="selection-panel-description">{repo.description}</p>
      )}
      <div className="selection-panel-stats">
        <span>★ {formatNumber(repo.stars)}</span>
        <span>⑂ {formatNumber(repo.forks)}</span>
        {repo.language && <span>{repo.language}</span>}
      </div>
      <div className="selection-panel-footer">
        Updated {formatDate(repo.pushedAt)}
      </div>
      <a
        className="selection-panel-link"
        href={repo.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        View on GitHub →
      </a>
    </section>
  );
}
