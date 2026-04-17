import { useUniverseStore } from "../store/useUniverseStore";
import { RepoInput } from "./RepoInput";
import { StarredImport } from "./StarredImport";
import { RepoList } from "./RepoList";

export function ControlPanel() {
  const selectedOwner = useUniverseStore((s) => s.selectedOwner);
  const clearSelection = useUniverseStore((s) => s.clearSelection);

  return (
    <aside className="control-panel">
      <header className="panel-header">
        <h1>GitHub Universe</h1>
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
      <RepoList />

      <footer className="panel-footer">
        <span>Data from public GitHub. Stored locally.</span>
      </footer>
    </aside>
  );
}
