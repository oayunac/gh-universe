import { useState, type FormEvent } from "react";
import { useUniverseStore } from "../store/useUniverseStore";

export function RepoInput() {
  const [value, setValue] = useState("");
  const addRepoByInput = useUniverseStore((s) => s.addRepoByInput);
  const status = useUniverseStore((s) => s.addRepoStatus);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status.loading) return;
    await addRepoByInput(value);
    if (!useUniverseStore.getState().addRepoStatus.error) {
      setValue("");
    }
  }

  return (
    <form className="panel-section" onSubmit={handleSubmit} autoComplete="off">
      <label className="panel-label" htmlFor="repo-input">
        Add owner or repo
      </label>
      <div className="input-row">
        <input
          id="repo-input"
          name="repo-input"
          type="text"
          placeholder="facebook · facebook/react · URL"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          data-lpignore="true"
          data-1p-ignore
          disabled={status.loading}
        />
        <button type="submit" disabled={status.loading || !value.trim()}>
          {status.loading ? "Adding…" : "Add"}
        </button>
      </div>
      {status.error && <div className="error-text">{status.error}</div>}
    </form>
  );
}
