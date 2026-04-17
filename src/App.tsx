import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { ControlPanel } from "./components/ControlPanel";
import { InfoCard } from "./components/InfoCard";
import { UniverseScene } from "./scene/UniverseScene";
import { StarSystemScene } from "./scene/StarSystemScene";
import { useUniverseStore } from "./store/useUniverseStore";

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

  return (
    <div className="app-shell">
      <ControlPanel />
      <main className="canvas-wrapper">
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
              <UniverseScene systems={systems} onFocus={focusOwner} />
            ) : (
              <StarSystemScene
                system={focusedSystem}
                hoveredRepoId={hoveredRepoId}
                onHoverRepo={setHoveredRepo}
              />
            )}
          </Suspense>
        </Canvas>
        <InfoCard />
        <div className="canvas-hint">
          {viewMode === "universe"
            ? "Drag to look around · scroll to zoom · click a star to enter"
            : "Click empty space to return"}
        </div>
      </main>
    </div>
  );
}
