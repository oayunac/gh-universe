import { useMemo } from "react";
import { useUniverseStore } from "../store/useUniverseStore";
import { RepoInput } from "./RepoInput";
import { StarredImport } from "./StarredImport";
import { SavedLists } from "./SavedLists";
import { RepoList } from "./RepoList";

function formatThreshold(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return n.toLocaleString();
}

export function ControlPanel() {
  const selectedOwner = useUniverseStore((s) => s.selectedOwner);
  const clearSelection = useUniverseStore((s) => s.clearSelection);
  const systems = useUniverseStore((s) => s.systems);
  const visibilityThreshold = useUniverseStore((s) => s.visibilityThreshold);
  const setVisibilityThreshold = useUniverseStore(
    (s) => s.setVisibilityThreshold
  );

  const maxStars = useMemo(
    () => systems.reduce((m, s) => Math.max(m, s.totalStars), 0),
    [systems]
  );

  // The slider shows whichever is smaller — when systems shrink the slider
  // pins to the new max, while the underlying value in the store is left as-is
  // so re-adding bigger owners restores the prior position.
  const sliderValue = Math.min(visibilityThreshold, maxStars);
  const visibleCount = useMemo(
    () => systems.filter((s) => s.totalStars >= sliderValue).length,
    [systems, sliderValue]
  );

  return (
    <aside className="control-panel">
      <header className="panel-header">
        <h1>
          <a
            className="panel-title-link"
            href="https://github.com/oayunac/gh-universe"
            target="_blank"
            rel="noreferrer"
          >
            gh-universe
          </a>
        </h1>
        <p className="panel-tagline">Explore repos as stars and planets.</p>
      </header>

      {selectedOwner && (
        <div className="panel-section focus-banner">
          <div>
            <div className="panel-label">Selected star</div>
            <div className="focus-owner">{selectedOwner}</div>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={clearSelection}
          >
            Back to universe
          </button>
        </div>
      )}

      <RepoInput />
      <StarredImport />
      <SavedLists />

      {maxStars > 0 && (
        <div className="panel-section">
          <div className="panel-label-row">
            <span className="panel-label">Visibility</span>
            <span className="panel-footnote">
              ≥ {formatThreshold(sliderValue)} ★ · {visibleCount}/{systems.length}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={maxStars}
            step={1}
            value={sliderValue}
            onChange={(e) => setVisibilityThreshold(Number(e.target.value))}
            className="panel-slider"
            aria-label="Hide stars below this many total stars"
          />
        </div>
      )}

      <RepoList />

      <footer className="panel-footer">
        <span>Data from public GitHub. Stored locally.</span>
      </footer>
    </aside>
  );
}
