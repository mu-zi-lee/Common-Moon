import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Heart, Camera } from "lucide-react";
import { StorageImage } from "@/components/StorageImage";

export type PortraitRecord = {
  id: string;
  photo_url: string | null;
  teacher_name: string | null;
  character_name: string | null;
  anime_name: string | null;
  hall: string | null;
  favorite: boolean;
  rating: number;
  occurred_at: string;
  events: { name?: string } | { name?: string }[] | null;
  tags?: string[];
};

function eventName(events: PortraitRecord["events"]): string | null {
  if (!events) return null;
  if (Array.isArray(events)) return events[0]?.name ?? null;
  return events.name ?? null;
}

function initials(r: PortraitRecord): string {
  const s = r.teacher_name || r.character_name || "";
  return s.trim().slice(0, 1) || "?";
}

export function PortraitCard({
  record,
  index = 0,
  variant = "default",
}: {
  record: PortraitRecord;
  index?: number;
  variant?: "default" | "compact";
}) {
  const compact = variant === "compact";
  const ev = eventName(record.events);
  const date = new Date(record.occurred_at);
  const dateStr = `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} · ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const stars = Math.max(0, Math.min(5, record.rating || 0));

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 10) * 0.025, ease: [0.32, 0.72, 0, 1] }}
    >
      <Link
        to="/records/$id"
        params={{ id: record.id }}
        className="group block active:scale-[0.985] transition ease-editorial"
        aria-label={record.teacher_name ?? record.character_name ?? "记录"}
      >
        {/* Photo frame */}
        <div className="relative aspect-[10/13] overflow-hidden rounded-2xl bg-muted shadow-editorial">
          {record.photo_url ? (
            <StorageImage
              bucket="photos"
              path={record.photo_url}
              className="h-full w-full object-cover transition duration-700 ease-editorial group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
              {record.teacher_name || record.character_name ? (
                <span className="display-title text-6xl text-foreground/30">{initials(record)}</span>
              ) : (
                <Camera className="h-8 w-8" strokeWidth={1.2} />
              )}
            </div>
          )}

          {/* Needs-tidy badge — record has photo but no teacher/character */}
          {record.photo_url && !record.teacher_name && !record.character_name && (
            <div className="absolute top-2.5 left-2.5 rounded-full bg-background/85 px-2 py-0.5 text-[9px] font-medium tracking-wider uppercase text-foreground/70 backdrop-blur-md ring-1 ring-foreground/10">
              待整理
            </div>
          )}

          {/* Favorite badge — theme-adaptive foreground pill */}
          {record.favorite && (
            <div className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-foreground/90 text-background backdrop-blur-md ring-1 ring-background/10">
              <Heart className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
            </div>
          )}

          {/* Rating dots — theme-adaptive foreground pill */}
          {stars > 0 && (
            <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-full bg-foreground/85 px-2 py-1 backdrop-blur-md ring-1 ring-background/10">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={`inline-block h-1 w-1 rounded-full ${i < stars ? "bg-background" : "bg-background/30"}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Editorial caption */}
        <div className={compact ? "mt-2 px-0.5" : "mt-3 px-0.5"}>
          <h3
            className={`display-title truncate ${compact ? "text-[17px]" : "text-[22px]"}`}
            style={{ lineHeight: 1.05 }}
          >
            {record.teacher_name || "—"}
          </h3>
          {!compact && (
            <p className="mt-1 truncate text-[12px] text-muted-foreground">
              {record.character_name || "—"}
              {record.anime_name ? ` · ${record.anime_name}` : ""}
            </p>
          )}
          <div className={`mt-1.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground/80 tabular ${compact ? "" : ""}`}>
            <span className="truncate tracking-wider uppercase">
              {ev || "自由外拍"}
            </span>
            <span className="shrink-0 tracking-wider">{dateStr}</span>
          </div>
          {!compact && record.tags && record.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1 overflow-hidden" style={{ maxHeight: "1.25rem" }}>
              {record.tags.slice(0, 2).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full bg-surface-1 px-1.5 py-0.5 text-[9px] text-muted-foreground/80 tracking-wide"
                >
                  #{t}
                </span>
              ))}
              {record.tags.length > 2 && (
                <span className="inline-flex items-center px-1 text-[9px] text-muted-foreground/60 tabular">
                  +{record.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
