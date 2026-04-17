interface SidebarToggleProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function SidebarToggle({ collapsed, onToggle }: SidebarToggleProps) {
  const label = collapsed ? "Show side panel" : "Hide side panel";
  return (
    <button
      type="button"
      className="sidebar-toggle"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={collapsed}
      title={label}
    >
      {collapsed ? <ChevronRight /> : <ChevronLeft />}
    </button>
  );
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M15 6 L9 12 L15 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M9 6 L15 12 L9 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
