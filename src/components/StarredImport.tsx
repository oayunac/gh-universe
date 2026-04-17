import { useState, type FormEvent } from "react";
import { useUniverseStore } from "../store/useUniverseStore";

export function StarredImport() {
  const [username, setUsername] = useState("");
  const startImport = useUniverseStore((s) => s.startImport);
  const status = useUniverseStore((s) => s.importStatus);
  const removeImportCandidate = useUniverseStore((s) => s.removeImportCandidate);
  const confirmImport = useUniverseStore((s) => s.confirmImport);
  const cancelImport = useUniverseStore((s) => s.cancelImport);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status.loading) return;
    await startImport(username);
  }

  return (
    <div className="panel-section">
      <form onSubmit={handleSubmit}>
        <label className="panel-label" htmlFor="username-input">
          Import starred by user
        </label>
        <div className="input-row">
          <input
            id="username-input"
            type="text"
            placeholder="github username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            disabled={status.loading}
          />
          <button type="submit" disabled={status.loading || !username.trim()}>
            {status.loading ? "Loading…" : "Fetch"}
          </button>
        </div>
        {status.error && <div className="error-text">{status.error}</div>}
      </form>

      {status.candidates.length > 0 && (
        <div className="import-review">
          <div className="import-review-header">
            <span>
              {status.candidates.length} repo
              {status.candidates.length === 1 ? "" : "s"} from @{status.username}
            </span>
            <div className="import-review-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={cancelImport}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  confirmImport();
                  setUsername("");
                }}
              >
                Import all
              </button>
            </div>
          </div>
          <ul className="import-review-list">
            {status.candidates.map((c) => (
              <li key={c.id}>
                <div className="import-review-meta">
                  <span className="import-review-name">{c.fullName}</span>
                  <span className="import-review-stars">★ {c.stars.toLocaleString()}</span>
                </div>
                <button
                  type="button"
                  className="ghost-button tiny"
                  onClick={() => removeImportCandidate(c.id)}
                  aria-label={`Remove ${c.fullName} from import`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
