import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { ContributionHeatmap } from "@/components/ContributionHeatmap";

export const Route = createFileRoute("/_authenticated/stats")({
  component: StatsPage,
});

function StatsPage() {
  const { data } = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const [records, events] = await Promise.all([
        supabase.from("records").select("id, character_name, anime_name, event_id, favorite, occurred_at"),
        supabase.from("events").select("id, name"),
      ]);
      const list = records.data ?? [];
      const evMap = new Map((events.data ?? []).map((e) => [e.id, e.name] as const));
      const countBy = (getter: (r: (typeof list)[number]) => string | null) => {
        const m = new Map<string, number>();
        list.forEach((r) => {
          const k = getter(r);
          if (!k) return;
          m.set(k, (m.get(k) ?? 0) + 1);
        });
        return [...m.entries()].sort((a, b) => b[1] - a[1]);
      };
      // monthly
      const monthly = new Map<string, number>();
      list.forEach((r) => {
        const k = new Date(r.occurred_at).toISOString().slice(0, 7);
        monthly.set(k, (monthly.get(k) ?? 0) + 1);
      });
      return {
        total: list.length,
        favorites: list.filter((r) => r.favorite).length,
        events: (events.data ?? []).length,
        chars: countBy((r) => r.character_name).slice(0, 5),
        animes: countBy((r) => r.anime_name).slice(0, 5),
        evs: countBy((r) => (r.event_id ? evMap.get(r.event_id) ?? null : null)).slice(0, 5),
        monthly: [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)),
        occurredDates: list.map((r) => r.occurred_at),
      };
    },
  });

  const maxMonth = Math.max(1, ...(data?.monthly.map(([, v]) => v) ?? [0]));

  return (
    <AppShell title="统计">
      <div className="grid grid-cols-3 gap-2">
        <BigStat label="累计" value={data?.total ?? 0} />
        <BigStat label="收藏" value={data?.favorites ?? 0} />
        <BigStat label="展会" value={data?.events ?? 0} />
      </div>

      <Section title="活跃日历">
        <ContributionHeatmap dates={data?.occurredDates ?? []} weeks={26} />
      </Section>



      <Section title="月度记录">
        {data?.monthly.length ? (
          <div className="flex items-end gap-1.5 h-32">
            {data.monthly.slice(-12).map(([m, v]) => (
              <div key={m} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t-lg bg-primary transition-all" style={{ height: `${(v / maxMonth) * 100}%` }} />
                <div className="text-[10px] text-muted-foreground">{m.slice(5)}</div>
              </div>
            ))}
          </div>
        ) : <Empty />}
      </Section>

      <Section title="角色 Top 5"><RankList items={data?.chars ?? []} /></Section>
      <Section title="作品 Top 5"><RankList items={data?.animes ?? []} /></Section>
      <Section title="展会 Top 5"><RankList items={data?.evs ?? []} /></Section>
    </AppShell>
  );
}

function BigStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-card p-4 border border-border/50 shadow-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="rounded-2xl bg-card p-4 border border-border/50 shadow-sm">{children}</div>
    </section>
  );
}
function RankList({ items }: { items: [string, number][] }) {
  const max = Math.max(1, ...items.map(([, v]) => v));
  if (!items.length) return <Empty />;
  return (
    <ul className="space-y-2">
      {items.map(([k, v]) => (
        <li key={k}>
          <div className="mb-1 flex justify-between text-sm"><span className="truncate">{k}</span><span className="tabular-nums text-muted-foreground">{v}</span></div>
          <div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
function Empty() { return <p className="py-4 text-center text-xs text-muted-foreground">暂无数据</p>; }
