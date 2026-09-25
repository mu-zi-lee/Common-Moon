import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemeMode; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "浅色" },
  { value: "dark", icon: Moon, label: "深色" },
  { value: "system", icon: Monitor, label: "跟随" },
];

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  return (
    <div className="inline-flex rounded-full border border-border p-0.5">
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        const active = mode === o.value;
        return (
          <button
            key={o.value}
            onClick={() => setMode(o.value)}
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition",
              active ? "bg-foreground text-background" : "text-muted-foreground",
            )}
            aria-label={o.label}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
