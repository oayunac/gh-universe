import { Suspense, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { ControlPanel } from "./components/ControlPanel";
import { InfoCard } from "./components/InfoCard";
import { FullscreenToggle } from "./components/FullscreenToggle";
import {
  TransitionOverlay,
  type TransitionOverlayHandle,
} from "./components/TransitionOverlay";
import { UniverseScene } from "./scene/UniverseScene";
import { StarSystemScene } from "./scene/StarSystemScene";
import { useUniverseStore } from "./store/useUniverseStore";
import { useFullscreen } from "./utils/useFullscreen";

export function App() {
  const viewMode = useUniverseStore((s) => s.viewMode);
  const systems = useUniverseStore((s) => s.systems);
  const focusedOwner = useUniverseStore((s) => s.focusedOwner);
  const hoveredRepoId = useUniverseStore((s) => s.hoveredRepoId);
  const focusOwner = useUniverseStore((s) => s.focusOwner);
  const setHoveredRepo = useUniverseStore((s) => s.setHoveredRepo);
  const returnToUniverse = useUniverseStore((s) => s.returnToUniverse);

  const focusedSystem = useMemo(
    () => (focusedOwner ? systems.find((s) => s.owner === focusedOwner) ?? null : null),
    [focusedOwner, systems]
  );

  const isEmpty = systems.length === 0;
  const canvasWrapperRef = useRef<HTMLElement>(null);
  const transitionRef = useRef<TransitionOverlayHandle | null>(null);
  const { isFullscreen, supported: fsSupported, toggle: toggleFullscreen } =
    useFullscreen(canvasWrapperRef);

  return (
    <div className="app-shell">
      <ControlPanel />
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
            if (viewMode === "system") returnToUniverse();
          }}
        >
          <Suspense fallback={null}>
            {viewMode === "universe" || !focusedSystem ? (
              <UniverseScene
                systems={systems}
                onFocus={focusOwner}
                transitionRef={transitionRef}
              />
            ) : (
              <StarSystemScene
                system={focusedSystem}
                hoveredRepoId={hoveredRepoId}
                onHoverRepo={setHoveredRepo}
              />
            )}
          </Suspense>
        </Canvas>
        <TransitionOverlay ref={transitionRef} />
        <InfoCard />
        <FullscreenToggle
          isFullscreen={isFullscreen}
          supported={fsSupported}
          onToggle={toggleFullscreen}
        />
        <div className="canvas-hint">
          {viewMode === "universe"
            ? "Drag to look · zoom into a star or click to enter its system"
            : "Click empty space to return"}
        </div>
      </main>
    </div>
  );
}
