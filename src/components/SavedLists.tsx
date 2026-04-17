import { useRef, useState, type ChangeEvent } from "react";
import { useUniverseStore } from "../store/useUniverseStore";
import {
  downloadUniverseList,
  readUniverseListFile,
} from "../utils/listFile";

export function SavedLists() {
  const repos = useUniverseStore((s) => s.repos);
  const replaceRepos = useUniverseStore((s) => s.replaceRepos);
  const [error, setError] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSave = repos.length > 0;

  function handleSave() {
    setError(null);
    downloadUniverseList(repos);
  }

  function triggerFilePicker() {
    setError(null);
    fileInputRef.current?.click();
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Allow re-selecting the same file later.
    event.target.value = "";
    if (!file) return;
    try {
      const loaded = await readUniverseListFile(file);
      replaceRepos(loaded);
      setLastLoaded(file.name);
      setError(null);
    } catch (err) {
      setLastLoaded(null);
      setError(err instanceof Error ? err.message : "Failed to load file.");
    }
  }

  return (
    <div className="panel-section">
      <div className="panel-label">Save / load to disk</div>
      <div className="input-row">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          title={canSave ? "Download universe as JSON" : "Add a repo first"}
        >
          Save to file
        </button>
        <button
          type="button"
          onClick={triggerFilePicker}
          title="Load a previously saved universe file"
        >
          Load from file
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFile}
        hidden
      />
      {error && <div className="error-text">{error}</div>}
      {!error && lastLoaded && (
        <div className="panel-footnote">Loaded {lastLoaded}.</div>
      )}
    </div>
  );
}
