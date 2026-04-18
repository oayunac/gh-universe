import { useEffect, useState } from "react";
import { useUniverseStore } from "../store/useUniverseStore";
import { buildShareUrl, type ShareOwner } from "../utils/shareCodec";

type CopyState = "idle" | "copied" | "error";

// Sidebar action that builds a shareable URL from the current universe and
// copies it to the clipboard. The URL carries a Base64 payload in the hash
// fragment; opening it rebuilds the universe via the normal fetch path.
// When the Web Share API is available and the user is on a coarse pointer
// we prefer it — it surfaces the OS share sheet instead of a silent copy.
export function ShareButton() {
  const systems = useUniverseStore((s) => s.systems);
  const [state, setState] = useState<CopyState>("idle");

  // Reset the transient copy confirmation after a moment so the label goes
  // back to its default.
  useEffect(() => {
    if (state === "idle") return;
    const handle = window.setTimeout(() => setState("idle"), 2200);
    return () => window.clearTimeout(handle);
  }, [state]);

  const owners: ShareOwner[] = systems.map((s) => ({
    owner: s.owner,
    repos: s.repos.map((r) => r.name),
  }));
  const disabled = owners.length === 0;

  async function handleShare() {
    if (disabled) return;
    const url = buildShareUrl(window.location.href, owners);
    const canWebShare =
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      // `canShare` is optional in the spec; treat absence as "maybe".
      (typeof navigator.canShare !== "function" ||
        navigator.canShare({ url, title: "gh-universe" }));
    try {
      if (canWebShare) {
        await navigator.share({
          title: "gh-universe",
          text: "Explore this universe of GitHub repos",
          url,
        });
        setState("copied");
        return;
      }
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        await navigator.clipboard.writeText(url);
        setState("copied");
        return;
      }
      fallbackCopy(url);
      setState("copied");
    } catch (err) {
      // User-initiated aborts on the Web Share API come through here; we
      // don't want to flash an error in that case.
      if (err instanceof DOMException && err.name === "AbortError") {
        setState("idle");
        return;
      }
      setState("error");
    }
  }

  const label =
    state === "copied"
      ? "Link copied"
      : state === "error"
        ? "Copy failed"
        : "Copy share link";

  return (
    <button
      type="button"
      className="primary-button share-button"
      onClick={handleShare}
      disabled={disabled}
      title={
        disabled
          ? "Add a repo to enable sharing"
          : "Copy a URL that rebuilds this universe"
      }
    >
      {label}
    </button>
  );
}

// Last-resort clipboard path for browsers without navigator.clipboard.
// Uses a hidden textarea + document.execCommand("copy"); tolerated failures
// bubble up so the caller can fall back to displaying an error.
function fallbackCopy(text: string): void {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.left = "-10000px";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  if (!ok) throw new Error("Clipboard copy failed.");
}
