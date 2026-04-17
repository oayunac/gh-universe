interface DiscoveryButtonProps {
  onDiscover: () => void;
  loading: boolean;
  error: string | null;
}

export function DiscoveryButton({
  onDiscover,
  loading,
  error,
}: DiscoveryButtonProps) {
  const tooltip = error ?? "Discover a new star";
  return (
    <button
      type="button"
      className={`discovery-button${loading ? " is-loading" : ""}`}
      onClick={onDiscover}
      aria-label={tooltip}
      title={tooltip}
      disabled={loading}
    >
      {loading ? <Spinner /> : <TelescopeIcon />}
    </button>
  );
}

function TelescopeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* tube as a parallelogram */}
      <path d="M5 16 L8 19 L19 8 L16 5 Z" />
      {/* eyepiece band */}
      <path d="M11 12 L15 16" />
      {/* support post + tripod base */}
      <path d="M11 14 L11 20" />
      <path d="M8 20 L14 20" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      className="discovery-spinner"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeDasharray="10 40"
        strokeLinecap="round"
      />
    </svg>
  );
}
