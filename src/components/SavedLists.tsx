import { useState, type FormEvent } from "react";
import { useUniverseStore } from "../store/useUniverseStore";

function formatWhen(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function SavedLists() {
  const repos = useUniverseStore((s) => s.repos);
  const savedLists = useUniverseStore((s) => s.savedLists);
  const saveCurrentList = useUniverseStore((s) => s.saveCurrentList);
  const loadSavedList = useUniverseStore((s) => s.loadSavedList);
  const deleteSavedList = useUniverseStore((s) => s.deleteSavedList);

  const [name, setName] = useState("");
  const canSave = repos.length > 0 && name.trim().length > 0;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    saveCurrentList(name);
    setName("");
  }

  return (
    <div className="panel-section">
      <label className="panel-label" htmlFor="saved-list-name">
        Saved lists
      </label>
      <form className="input-row" onSubmit={onSubmit}>
        <input
          id="saved-list-name"
          type="text"
          placeholder="Name this snapshot"
          value={name}
          onChange={(e) => setName(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          disabled={repos.length === 0}
        />
        <button type="submit" disabled={!canSave}>
          Save
        </button>
      </form>
      {savedLists.length === 0 ? (
        <div className="empty-state">
          Save the current universe as a named snapshot you can load later.
        </div>
      ) : (
        <ul className="saved-list">
          {savedLists.map((list) => {
            const detail = `${list.repos.length} repo${list.repos.length === 1 ? "" : "s"} · saved ${formatWhen(list.createdAt)}`;
            return (
              <li key={list.id}>
                <button
                  type="button"
                  className="saved-list-load"
                  onClick={() => loadSavedList(list.id)}
                  title={detail}
                >
                  <span className="saved-list-name">{list.name}</span>
                  <span className="saved-list-detail">{detail}</span>
                </button>
                <button
                  type="button"
                  className="ghost-button tiny"
                  onClick={() => deleteSavedList(list.id)}
                  aria-label={`Delete ${list.name}`}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
