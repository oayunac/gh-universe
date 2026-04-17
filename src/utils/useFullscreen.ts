import { useCallback, useEffect, useState, type RefObject } from "react";

// Minimal surface for WebKit-prefixed fullscreen APIs (Safari).
interface FullscreenDocumentLike {
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
  exitFullscreen?: () => Promise<void>;
  webkitExitFullscreen?: () => Promise<void>;
}

interface FullscreenElementLike {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void>;
}

function currentFullscreenElement(): Element | null {
  if (typeof document === "undefined") return null;
  const d = document as unknown as FullscreenDocumentLike;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

function fullscreenEnabled(): boolean {
  if (typeof document === "undefined") return false;
  const d = document as unknown as FullscreenDocumentLike;
  return Boolean(d.fullscreenEnabled ?? d.webkitFullscreenEnabled);
}

async function requestFullscreenOn(element: HTMLElement): Promise<void> {
  const el = element as unknown as FullscreenElementLike;
  if (el.requestFullscreen) return el.requestFullscreen();
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
}

async function exitFullscreen(): Promise<void> {
  const d = document as unknown as FullscreenDocumentLike;
  if (d.exitFullscreen) return d.exitFullscreen();
  if (d.webkitExitFullscreen) return d.webkitExitFullscreen();
}

export interface UseFullscreenResult {
  isFullscreen: boolean;
  supported: boolean;
  enter: () => Promise<void>;
  exit: () => Promise<void>;
  toggle: () => Promise<void>;
}

// Keeps `isFullscreen` in sync with the browser — including user exits via
// Escape or native browser chrome — and guards unsupported environments.
export function useFullscreen(
  targetRef: RefObject<HTMLElement | null>
): UseFullscreenResult {
  const [supported] = useState<boolean>(() => fullscreenEnabled());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    if (!supported) return;
    const sync = () => {
      const el = targetRef.current;
      setIsFullscreen(Boolean(el && currentFullscreenElement() === el));
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    sync();
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, [supported, targetRef]);

  const enter = useCallback(async () => {
    if (!supported) return;
    const el = targetRef.current;
    if (!el || currentFullscreenElement() === el) return;
    try {
      await requestFullscreenOn(el);
    } catch {
      // Transient or permission failure — leave state alone, the
      // fullscreenchange listener is the source of truth.
    }
  }, [supported, targetRef]);

  const exit = useCallback(async () => {
    if (!supported) return;
    if (!currentFullscreenElement()) return;
    try {
      await exitFullscreen();
    } catch {
      // Ignore; fullscreenchange will resync.
    }
  }, [supported]);

  const toggle = useCallback(async () => {
    if (isFullscreen) await exit();
    else await enter();
  }, [isFullscreen, enter, exit]);

  return { isFullscreen, supported, enter, exit, toggle };
}
