import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({
  value,
  onChange,
  size = 24,
  readOnly,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readOnly?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n === value ? 0 : n)}
          className={cn("transition-transform active:scale-90", readOnly && "cursor-default")}
          aria-label={`${n} 星`}
        >
          <Star
            width={size}
            height={size}
            className={cn(n <= value ? "fill-foreground text-foreground" : "text-muted-foreground/40")}
          />
        </button>
      ))}
    </div>
  );
}
