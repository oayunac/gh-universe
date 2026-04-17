import { Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { ControlPanel } from "./components/ControlPanel";
import { InfoCard } from "./components/InfoCard";
import { FullscreenToggle } from "./components/FullscreenToggle";
import { UniverseScene } from "./scene/UniverseScene";
import { useUniverseStore } from "./store/useUniverseStore";
import { useFullscreen } from "./utils/useFullscreen";

export function App() {
  const systems = useUniverseStore((s) => s.systems);
  const selectedOwner = useUniverseStore((s) => s.selectedOwner);
  const hoveredRepoId = useUniverseStore((s) => s.hoveredRepoId);
  const selectOwner = useUniverseStore((s) => s.selectOwner);
  const clearSelection = useUniverseStore((s) => s.clearSelection);
  const setHoveredRepo = useUniverseStore((s) => s.setHoveredRepo);

  const isEmpty = systems.length === 0;
  const canvasWrapperRef = useRef<HTMLElement>(null);
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
            if (selectedOwner) clearSelection();
          }}
        >
          <Suspense fallback={null}>
            <UniverseScene
              systems={systems}
              selectedOwner={selectedOwner}
              onSelect={selectOwner}
              hoveredRepoId={hoveredRepoId}
              onHoverRepo={setHoveredRepo}
            />
          </Suspense>
        </Canvas>
        <InfoCard />
        <FullscreenToggle
          isFullscreen={isFullscreen}
          supported={fsSupported}
          onToggle={toggleFullscreen}
        />
        <div className="canvas-hint">
          {selectedOwner
            ? "Zoom in to approach the system · click empty space to return"
            : "Drag to look · click a star to select, then zoom to approach"}
        </div>
      </main>
    </div>
  );
}
