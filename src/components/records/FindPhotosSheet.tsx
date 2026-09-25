import { useMemo } from "react";
import { X, ExternalLink } from "lucide-react";
import { FIND_TARGETS, buildQuery } from "@/lib/find-photos";

/**
 * Bottom sheet with quick links to search for photos of this cosplay
 * on major social platforms (微博, 小红书, Lofter, X, …).
 */
export function FindPhotosSheet({
  open,
  onClose,
  character,
  anime,
  event,
  teacher,
}: {
  open: boolean;
  onClose: () => void;
  character?: string | null;
  anime?: string | null;
  event?: string | null;
  teacher?: string | null;
}) {
  const q = useMemo(() => buildQuery({ character, anime, event, teacher }), [character, anime, event, teacher]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-background p-6 safe-bottom shadow-editorial"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-divider" />
        <div className="flex items-baseline justify-between hairline-b pb-3">
          <div>
            <p className="eyebrow">Find photos</p>
            <h3 className="display-title mt-1 text-[24px]">求片 / 找片</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground">搜索词</p>
        <div className="mt-1 rounded-2xl border border-divider bg-surface-1 px-3 py-2.5 font-mono text-sm">{q}</div>

        <ul className="mt-5 grid grid-cols-2 gap-2">
          {FIND_TARGETS.map((t) => (
            <li key={t.key}>
              <a
                href={t.url(q)}
                target="_blank"
                rel="noreferrer noopener"
                className="flex h-12 items-center justify-between rounded-2xl bg-surface-1 px-4 text-sm font-medium active:scale-[0.98] transition"
              >
                <span>{t.label}</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
