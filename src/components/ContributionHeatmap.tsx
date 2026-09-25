import { useMemo } from "react";

type Props = { dates: string[]; weeks?: number };

// Github-style contribution grid. Dates are ISO strings; we count per calendar day.
export function ContributionHeatmap({ dates, weeks = 26 }: Props) {
  const grid = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of dates) {
      const key = new Date(d).toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // End at today, walk back weeks*7 days
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    // Align to end of week (Saturday)
    const daysToSat = 6 - end.getDay();
    const gridEnd = new Date(end);
    gridEnd.setDate(gridEnd.getDate() + daysToSat);

    const cells: { date: string; count: number; inFuture: boolean }[] = [];
    const total = weeks * 7;
    for (let i = total - 1; i >= 0; i--) {
      const d = new Date(gridEnd);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      cells.push({ date: key, count: counts.get(key) ?? 0, inFuture: d > end });
    }
    // Slice into weeks (columns)
    const cols: (typeof cells)[] = [];
    for (let i = 0; i < weeks; i++) cols.push(cells.slice(i * 7, i * 7 + 7));
    return cols;
  }, [dates, weeks]);

  const monthLabels = useMemo(() => {
    return grid.map((week) => {
      const first = week[0];
      const d = new Date(first.date);
      // Show label only when this week contains day 1..7 of a month
      const day = d.getDate();
      if (day <= 7) return d.toLocaleDateString("zh-CN", { month: "short" });
      return "";
    });
  }, [grid]);

  const max = useMemo(() => Math.max(1, ...grid.flat().map((c) => c.count)), [grid]);
  const level = (n: number) => {
    if (!n) return 0;
    const r = n / max;
    if (r > 0.66) return 4;
    if (r > 0.33) return 3;
    if (r > 0.1) return 2;
    return 1;
  };
  const cls = (lv: number) =>
    ["bg-surface-1", "bg-foreground/25", "bg-foreground/45", "bg-foreground/70", "bg-foreground"][lv];

  const total = grid.flat().reduce((s, c) => s + c.count, 0);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] text-muted-foreground">近 {weeks} 周 · {total} 次记录</p>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span>少</span>
          {[0, 1, 2, 3, 4].map((l) => <span key={l} className={`h-2.5 w-2.5 rounded-sm ${cls(l)}`} />)}
          <span>多</span>
        </div>
      </div>
      <div className="mt-2 overflow-x-auto">
        <div className="inline-flex gap-1">
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              <div className="h-3 text-[9px] text-muted-foreground leading-none">{monthLabels[wi]}</div>
              {week.map((c) => (
                <div
                  key={c.date}
                  title={`${c.date} · ${c.count} 条`}
                  className={`h-3 w-3 rounded-sm ${c.inFuture ? "opacity-0" : cls(level(c.count))}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
