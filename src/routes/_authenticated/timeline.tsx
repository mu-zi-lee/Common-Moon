import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { StorageImage } from "@/components/StorageImage";

type Row = {
  id: string;
  teacher_name: string | null;
  character_name: string | null;
  photo_url: string | null;
  occurred_at: string;
  events: { name?: string | null } | null;
};

export const Route = createFileRoute("/_authenticated/timeline")({
  component: TimelinePage,
});

function TimelinePage() {
  const { data } = useQuery({
    queryKey: ["timeline"],
    queryFn: async () => {
      const { data } = await supabase.from("records")
        .select("id, teacher_name, character_name, photo_url, occurred_at, events(name)")
        .order("occurred_at", { ascending: false }).limit(300);
      return (data ?? []) as Row[];
    },
  });

  const rows = data ?? [];

  // Group by calendar day (descending), then per group sort DESC by time.
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const d = new Date(r.occurred_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const dayList = Array.from(groups.entries()).map(([key, items]) => {
    const first = new Date(items[0].occurred_at);
    const dowStr = first.toLocaleDateString("zh-CN", { weekday: "short" });
    const monthName = first.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
    const dayNum = String(first.getDate()).padStart(2, "0");
    const yearStr = String(first.getFullYear());
    // Predominant event name for the day (mode)
    const counts = new Map<string, number>();
    for (const it of items) {
      const en = it.events?.name || "自由外拍";
      counts.set(en, (counts.get(en) ?? 0) + 1);
    }
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    return { key, items, dowStr, monthName, dayNum, yearStr, dominant };
  });

  return (
    <AppShell title="时间轴">
      {rows.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-divider p-10 text-center">
          <p className="eyebrow">Empty</p>
          <p className="display-title mt-2 text-[22px] text-muted-foreground">还没有记录</p>
        </div>
      ) : (
        <div className="space-y-10">
          {dayList.map((day) => (
            <section key={day.key}>
              {/* Day header */}
              <header className="sticky top-14 z-10 -mx-4 mb-4 bg-background/95 px-4 py-3 backdrop-blur-md hairline-b">
                <div className="flex items-baseline justify-between gap-4">
                  <div className="min-w-0">
                    <p className="eyebrow tabular">{day.monthName} · {day.yearStr}</p>
                    <h2 className="display-title mt-0.5 text-[32px] leading-none">
                      {day.dayNum}
                      <span className="ml-2 text-[16px] font-sans font-medium tracking-widest uppercase text-muted-foreground">
                        {day.dowStr}
                      </span>
                    </h2>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="eyebrow">Encounters</p>
                    <p className="display-title tabular text-[22px]">{String(day.items.length).padStart(2, "0")}</p>
                  </div>
                </div>
                {day.dominant && (
                  <p className="mt-1 truncate text-[11px] uppercase tracking-widest text-muted-foreground">
                    at · {day.dominant}
                  </p>
                )}
              </header>

              {/* Ledger */}
              <ol className="relative pl-[76px]">
                {/* vertical hairline */}
                <span
                  aria-hidden
                  className="absolute left-[64px] top-2 bottom-2 w-px bg-divider"
                />
                {day.items.map((r, i) => {
                  const d = new Date(r.occurred_at);
                  const hhmm = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
                  const meridiem = d.getHours() < 12 ? "AM" : "PM";
                  const prev = i > 0 ? new Date(day.items[i - 1].occurred_at) : null;
                  const gapMin = prev ? Math.abs((prev.getTime() - d.getTime()) / 60000) : 0;
                  const showGap = prev && gapMin >= 60;
                  return (
                    <li key={r.id} className="relative pb-6 last:pb-0">
                      {showGap && (
                        <div className="absolute -left-[76px] top-0 flex w-[60px] justify-end">
                          <span className="rounded-full bg-surface-1 px-2 py-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">
                            +{Math.round(gapMin / 60)}h
                          </span>
                        </div>
                      )}
                      {/* Timestamp gutter */}
                      <div className="absolute -left-[76px] top-1 w-[60px] text-right">
                        <p className="display-title tabular text-[20px] leading-none">{hhmm}</p>
                        <p className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                          {meridiem}
                        </p>
                      </div>
                      {/* Node */}
                      <span
                        aria-hidden
                        className="absolute -left-[16px] top-2 h-2.5 w-2.5 rounded-full bg-foreground ring-4 ring-background"
                      />
                      {/* Record */}
                      <Link
                        to="/records/$id"
                        params={{ id: r.id }}
                        className="group flex items-start gap-3 pb-4 hairline-b active:opacity-70 transition ease-editorial"
                      >
                        <StorageImage
                          bucket="photos"
                          path={r.photo_url}
                          className="h-14 w-14 shrink-0 rounded-xl object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="display-title truncate text-[18px] leading-tight">
                            {r.teacher_name || "—"}
                          </p>
                          {r.character_name && (
                            <p className="mt-0.5 truncate font-display text-[13px] italic text-muted-foreground">
                              as {r.character_name}
                            </p>
                          )}
                          <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            {r.events?.name || "自由外拍"}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
