interface FullscreenToggleProps {
  isFullscreen: boolean;
  supported: boolean;
  onToggle: () => void;
}

export function FullscreenToggle({
  isFullscreen,
  supported,
  onToggle,
}: FullscreenToggleProps) {
  if (!supported) return null;
  const label = isFullscreen ? "Exit fullscreen" : "Enter fullscreen";
  return (
    <button
      type="button"
      className="fs-toggle"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={isFullscreen}
      title={label}
    >
      {isFullscreen ? <ExitIcon /> : <EnterIcon />}
    </button>
  );
}

function EnterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
