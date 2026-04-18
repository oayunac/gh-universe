import { useEffect } from "react";
import { useUniverseStore } from "../store/useUniverseStore";

// Shown when a decoded share payload is waiting for a user decision, or
// when a recent import produced a note or an error worth surfacing. The
// banner sits at the top of the canvas so it's visible regardless of
// whether the sidebar is open.
export function ShareBanner() {
  const pendingShare = useUniverseStore((s) => s.pendingShare);
  const status = useUniverseStore((s) => s.shareImportStatus);
  const hasExistingRepos = useUniverseStore((s) => s.repos.length > 0);
  const applyPendingShare = useUniverseStore((s) => s.applyPendingShare);
  const dismissPendingShare = useUniverseStore((s) => s.dismissPendingShare);
  const clearShareImportNote = useUniverseStore((s) => s.clearShareImportNote);

  // Auto-apply when the local universe is empty — there's nothing to
  // replace, so prompting would just be in the way. When repos exist, we
  // require explicit confirmation so a stray URL can't wipe a local list.
  useEffect(() => {
    if (pendingShare && !hasExistingRepos && !status.loading) {
      applyPendingShare();
    }
  }, [pendingShare, hasExistingRepos, status.loading, applyPendingShare]);

  // Auto-dismiss the success note after a short delay.
  useEffect(() => {
    if (!status.note) return;
    const handle = window.setTimeout(() => clearShareImportNote(), 4500);
    return () => window.clearTimeout(handle);
  }, [status.note, clearShareImportNote]);

  if (status.loading) {
    return (
      <div className="share-banner" role="status">
        <span>Importing shared universe…</span>
      </div>
    );
  }

  if (status.error) {
    return (
      <div className="share-banner share-banner-error" role="alert">
        <span>{status.error}</span>
        <button
          type="button"
          className="ghost-button tiny"
          onClick={clearShareImportNote}
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (status.note) {
    return (
      <div className="share-banner" role="status">
        <span>{status.note}</span>
        <button
          type="button"
          className="ghost-button tiny"
          onClick={clearShareImportNote}
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (pendingShare && hasExistingRepos) {
    const count = pendingShare.owners.reduce(
      (sum, o) => sum + o.repos.length,
      0
    );
    return (
      <div className="share-banner share-banner-prompt" role="dialog" aria-label="Shared universe">
        <span>
          Shared universe detected — {pendingShare.owners.length} owner
          {pendingShare.owners.length === 1 ? "" : "s"} · {count} repo
          {count === 1 ? "" : "s"}. Replace your current universe?
        </span>
        <div className="share-banner-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={dismissPendingShare}
          >
            Keep current
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={applyPendingShare}
          >
            Replace
          </button>
        </div>
      </div>
    );
  }

  return null;
}
