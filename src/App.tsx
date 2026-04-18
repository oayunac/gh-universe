import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ControlPanel } from "./components/ControlPanel";
import { SelectionPanel } from "./components/SelectionPanel";
import { FullscreenToggle } from "./components/FullscreenToggle";
import { SidebarToggle } from "./components/SidebarToggle";
import { CameraHud } from "./components/CameraHud";
import { DiscoveryButton } from "./components/DiscoveryButton";
import { ShareBanner } from "./components/ShareBanner";
import { UniverseScene, type CameraControlHandle } from "./scene/UniverseScene";
import { useUniverseStore } from "./store/useUniverseStore";
import { useFullscreen } from "./utils/useFullscreen";
import {
  decodeShare,
  encodeShare,
  readShareTokenFromHash,
  SHARE_HASH_KEY,
  type ShareOwner,
} from "./utils/shareCodec";

export function App() {
  const systems = useUniverseStore((s) => s.systems);
  const selectedOwner = useUniverseStore((s) => s.selectedOwner);
  const selectedRepoId = useUniverseStore((s) => s.selectedRepoId);
  const hoveredRepoId = useUniverseStore((s) => s.hoveredRepoId);
  const selectOwner = useUniverseStore((s) => s.selectOwner);
  const clearSelection = useUniverseStore((s) => s.clearSelection);
  const selectRepo = useUniverseStore((s) => s.selectRepo);
  const deselectRepo = useUniverseStore((s) => s.deselectRepo);
  const setHoveredRepo = useUniverseStore((s) => s.setHoveredRepo);
  const discoverStatus = useUniverseStore((s) => s.discoverStatus);
  const discoverOwner = useUniverseStore((s) => s.discoverOwner);
  const visibilityThreshold = useUniverseStore((s) => s.visibilityThreshold);

  const isEmpty = systems.length === 0;
  const canvasWrapperRef = useRef<HTMLElement>(null);
  const cameraControlRef = useRef<CameraControlHandle | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isFullscreen, supported: fsSupported, toggle: toggleFullscreen } =
    useFullscreen(canvasWrapperRef);

  const receivePendingShare = useUniverseStore((s) => s.receivePendingShare);

  // One-shot: read any share payload from the URL hash on mount and hand it
  // to the store. We intentionally don't clear the hash here — the sync
  // effect below will overwrite it with the live-state token on the first
  // render after the initial repos settle. Any decode/parse failure is
  // ignored silently so a malformed link can't block the app from booting.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = readShareTokenFromHash(window.location.hash);
    if (!token) return;
    const parsed = decodeShare(token);
    if (parsed && parsed.owners.length > 0) {
      receivePendingShare(parsed);
    }
  }, [receivePendingShare]);

  // Keep the URL hash in sync with the current universe. After any add,
  // remove, import, or share-apply, we re-encode `systems` and write the
  // token back with replaceState so copying the browser URL always yields
  // a valid share link. An empty universe clears the hash entirely.
  //
  // This effect runs after the one-shot read above, so even if the user
  // loaded a shared URL we end up with a hash that reflects what's actually
  // on screen — consistent with the "URL mirrors state" contract.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const owners: ShareOwner[] = systems
      .map((s) => ({
        owner: s.owner,
        repos: s.repos.map((r) => r.name),
      }))
      .filter((o) => o.repos.length > 0);

    const url = new URL(window.location.href);
    url.hash =
      owners.length === 0
        ? ""
        : `${SHARE_HASH_KEY}=${encodeShare(owners)}`;

    // Only write when the URL would actually change — avoids piling up
    // replaceState calls in dev tools during rapid store mutations.
    if (url.toString() === window.location.href) return;
    try {
      window.history.replaceState(null, "", url.toString());
    } catch {
      // History mutation isn't allowed in every embedding context; not
      // fatal because in-app sharing still works via the explicit button.
    }
  }, [systems]);

  return (
    <div
      className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}
    >
      <main
        ref={canvasWrapperRef}
        className={`canvas-wrapper${isFullscreen ? " is-fullscreen" : ""}`}
      >
        {isEmpty && (
          <div className="empty-overlay">
            <div className="empty-title">A quiet universe awaits.</div>
            <div className="empty-subtitle">
              Add a repo or import starred repos from the panel to light up your first stars.
            </div>
          </div>
        )}
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0, 0], fov: 55, near: 0.1, far: 1000 }}
          gl={{ antialias: true, alpha: false }}
          onCreated={({ gl }) => gl.setClearColor("#05070e")}
          onPointerMissed={() => {
            // Hierarchical deselect: release the centered planet first, then
            // the whole system on a subsequent empty click.
            if (selectedRepoId) deselectRepo();
            else if (selectedOwner) clearSelection();
          }}
        >
          <Suspense fallback={null}>
            <UniverseScene
              systems={systems}
              selectedOwner={selectedOwner}
              onSelect={selectOwner}
              selectedRepoId={selectedRepoId}
              onSelectRepo={selectRepo}
              onDeselectRepo={deselectRepo}
              hoveredRepoId={hoveredRepoId}
              onHoverRepo={setHoveredRepo}
              cameraControlRef={cameraControlRef}
              visibilityThreshold={visibilityThreshold}
            />
          </Suspense>
        </Canvas>
        <ControlPanel />
        <ShareBanner />
        <SelectionPanel />
        <SidebarToggle
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
        />
        <FullscreenToggle
          isFullscreen={isFullscreen}
          supported={fsSupported}
          onToggle={toggleFullscreen}
        />
        <div className="corner-stack">
          <DiscoveryButton
            onDiscover={discoverOwner}
            loading={discoverStatus.loading}
            error={discoverStatus.error}
          />
          <CameraHud cameraControlRef={cameraControlRef} />
        </div>
        <div className="canvas-hint">
          {selectedOwner
            ? "Pinch or wheel to approach · tap empty space to return"
            : "Drag to look · tap a star to select · pinch or wheel to zoom"}
        </div>
      </main>
    </div>
  );
}
