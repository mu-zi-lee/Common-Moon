import { INTERACTIONS, type InteractionKey } from "@/lib/interactions";

/**
 * Multi-select chip row for interaction badges (合影/签名/名片/送礼/…).
 */
export function InteractionChips({
  value,
  onChange,
  size = "md",
}: {
  value: string[];
  onChange: (next: InteractionKey[]) => void;
  size?: "sm" | "md";
}) {
  function toggle(key: InteractionKey) {
    const set = new Set(value as InteractionKey[]);
    if (set.has(key)) set.delete(key); else set.add(key);
    onChange(Array.from(set));
  }
  const h = size === "sm" ? "h-8" : "h-10";
  const px = size === "sm" ? "px-3" : "px-3.5";
  const text = size === "sm" ? "text-[11px]" : "text-[13px]";
  return (
    <div className="flex flex-wrap gap-1.5">
      {INTERACTIONS.map((i) => {
        const active = value.includes(i.key);
        return (
          <button
            key={i.key}
            type="button"
            onClick={() => toggle(i.key)}
            className={`inline-flex ${h} ${px} items-center gap-1 rounded-full font-medium transition ${text} ${
              active
                ? "bg-foreground text-background"
                : "bg-surface-1 text-foreground/70 hover:text-foreground border border-divider"
            }`}
          >
            <span aria-hidden>{i.emoji}</span>
            <span>{i.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Compact read-only strip showing selected interactions.
 */
export function InteractionRow({ value }: { value: string[] }) {
  if (!value?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {INTERACTIONS.filter((i) => value.includes(i.key)).map((i) => (
        <span
          key={i.key}
          className="inline-flex h-6 items-center gap-1 rounded-full bg-surface-1 px-2 text-[11px] text-foreground/80"
        >
          <span aria-hidden>{i.emoji}</span>
          <span>{i.label}</span>
        </span>
      ))}
    </div>
  );
}
