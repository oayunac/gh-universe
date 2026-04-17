import { useUniverseStore } from "../store/useUniverseStore";
import { RepoInput } from "./RepoInput";
import { StarredImport } from "./StarredImport";
import { RepoList } from "./RepoList";

export function ControlPanel() {
  const viewMode = useUniverseStore((s) => s.viewMode);
  const focusedOwner = useUniverseStore((s) => s.focusedOwner);
  const returnToUniverse = useUniverseStore((s) => s.returnToUniverse);

  return (
    <aside className="control-panel">
      <header className="panel-header">
        <h1>GitHub Universe</h1>
        <p className="panel-tagline">Explore repos as stars and planets.</p>
      </header>

      {viewMode === "system" && focusedOwner && (
        <div className="panel-section focus-banner">
          <div>
            <div className="panel-label">Viewing system</div>
            <div className="focus-owner">{focusedOwner}</div>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={returnToUniverse}
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
