import { Link } from "@tanstack/react-router";
import type { EventPath } from "@/lib/event-path";

/**
 * Overlay drawn on top of an event map image (parent must be `relative`).
 * SVG handles the polyline; HTML handles the numbered stops so they can be
 * interactive and legible without scaling with the map.
 * `highlightId` renders that stop as a large filled disc.
 */
export function EventPathOverlay({
  path,
  highlightId,
  interactive = true,
}: {
  path: EventPath;
  highlightId?: string;
  interactive?: boolean;
}) {
  if (path.points.length === 0) return null;
  const asPct = (v: number) => `${v * 100}%`;

  return (
    <>
      {path.points.length > 1 && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full text-foreground/70"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polyline
            points={path.points.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="2 3"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      <div className="pointer-events-none absolute inset-0">
        {path.points.map((p, i) => {
          const isFirst = i === 0;
          const isLast = i === path.points.length - 1;
          const isActive = highlightId != null && p.id === highlightId;
          const label = String(i + 1).padStart(2, "0");

          const dot = (
            <div
              className={`flex items-center justify-center rounded-full text-[9px] font-semibold tracking-widest transition ease-editorial ${
                isActive
                  ? "h-7 w-7 bg-foreground text-background ring-4 ring-background shadow-editorial"
                  : isFirst
                  ? "h-5 w-5 bg-background text-foreground ring-2 ring-foreground"
                  : "h-5 w-5 bg-foreground text-background ring-2 ring-background"
              }`}
            >
              {isActive ? label : isFirst ? "◦" : isLast ? "●" : label}
            </div>
          );

          const caption = (isActive || isFirst || isLast) && (
            <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-background/95 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-widest text-foreground/70 shadow-editorial">
              {isActive ? p.time : isFirst ? "Start" : "Now"}
            </div>
          );

          const commonStyle = { left: asPct(p.x), top: asPct(p.y) };
          const className = `absolute -translate-x-1/2 -translate-y-1/2 ${
            isActive ? "z-20" : "z-10"
          } ${interactive ? "pointer-events-auto" : ""}`;

          if (!interactive) {
            return (
              <div key={p.id} className={className} style={commonStyle}>
                {dot}
                {caption}
              </div>
            );
          }
          return (
            <Link
              key={p.id}
              to="/records/$id"
              params={{ id: p.id }}
              className={className}
              style={commonStyle}
              aria-label={`Stop ${i + 1} · ${p.teacher_name ?? ""}`}
            >
              {dot}
              {caption}
            </Link>
          );
        })}
      </div>
    </>
  );
}
