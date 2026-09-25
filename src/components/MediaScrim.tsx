/**
 * Theme-adaptive gradient scrim that blends media (photos, hero backgrounds)
 * into the page. Uses --background so it works in both dark and light modes.
 */
export function MediaScrim({
  variant = "bottom",
  height = "38%",
  className = "",
}: {
  variant?: "bottom" | "top" | "both";
  height?: string;
  className?: string;
}) {
  const bg =
    variant === "top"
      ? "linear-gradient(to bottom, var(--background) 0%, color-mix(in oklab, var(--background) 60%, transparent) 55%, transparent 100%)"
      : variant === "both"
      ? "linear-gradient(to bottom, var(--background) 0%, transparent 30%, transparent 70%, var(--background) 100%)"
      : "linear-gradient(to top, var(--background) 0%, color-mix(in oklab, var(--background) 60%, transparent) 55%, transparent 100%)";

  const position =
    variant === "top"
      ? { top: 0, height }
      : variant === "both"
      ? { top: 0, bottom: 0 }
      : { bottom: 0, height };

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 ${className}`}
      style={{ ...position, background: bg }}
    />
  );
}
