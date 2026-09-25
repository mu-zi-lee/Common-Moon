import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StorageImage } from "@/components/StorageImage";
import { ChevronLeft, Sparkles } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/me/wrapped/$year")({
  component: WrappedPage,
  parseParams: (raw) => ({
    year: z.coerce.number().int().min(2000).max(2100).parse(raw.year),
  }),
});

type Row = {
  id: string;
  photo_url: string | null;
  teacher_name: string | null;
  character_name: string | null;
  anime_name: string | null;
  favorite: boolean;
  rating: number;
  occurred_at: string;
  event_id: string | null;
  events: { name: string } | { name: string }[] | null;
};

function WrappedPage() {
  const { year } = Route.useParams();

  const q = useQuery({
    queryKey: ["wrapped", year],
    queryFn: async () => {
      const start = `${year}-01-01T00:00:00.000Z`;
      const end = `${year + 1}-01-01T00:00:00.000Z`;
      const { data, error } = await supabase
        .from("records")
        .select("id, photo_url, teacher_name, character_name, anime_name, favorite, rating, occurred_at, event_id, events(name)")
        .gte("occurred_at", start)
        .lt("occurred_at", end)
        .order("occurred_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const spend = useQuery({
    queryKey: ["wrapped-spend", year],
    queryFn: async () => {
      const start = `${year}-01-01`;
      const end = `${year + 1}-01-01`;
      const [exp, mer] = await Promise.all([
        supabase.from("expenses").select("category, amount, currency, occurred_at").gte("occurred_at", start).lt("occurred_at", end),
        supabase.from("merch").select("kind, price, currency, acquired_at, favorite").gte("acquired_at", start).lt("acquired_at", end),
      ]);
      return { expenses: exp.data ?? [], merch: mer.data ?? [] };
    },
  });

  const stats = useMemo(() => {
    const rows = q.data ?? [];
    const teachers = new Set<string>();
    const events = new Set<string>();
    const animes = new Map<string, number>();
    const characters = new Map<string, number>();
    let fav = 0;
    let bestRating = 0;
    let bestRow: Row | null = null;
    const monthly: number[] = Array(12).fill(0);
    for (const r of rows) {
      if (r.teacher_name) teachers.add(r.teacher_name);
      if (r.event_id) events.add(r.event_id);
      if (r.anime_name) animes.set(r.anime_name, (animes.get(r.anime_name) ?? 0) + 1);
      if (r.character_name) characters.set(r.character_name, (characters.get(r.character_name) ?? 0) + 1);
      if (r.favorite) fav++;
      if (r.rating > bestRating) { bestRating = r.rating; bestRow = r; }
      monthly[new Date(r.occurred_at).getMonth()]++;
    }
    const topAnimes = [...animes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const topChars = [...characters.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const gallery = rows.filter((r) => r.photo_url && r.favorite).slice(0, 9);
    const fallback = rows.filter((r) => r.photo_url).slice(0, 9);
    return {
      total: rows.length,
      teachers: teachers.size,
      events: events.size,
      favorites: fav,
      topAnimes, topChars, monthly, bestRow, bestRating,
      gallery: gallery.length >= 6 ? gallery : fallback,
    };
  }, [q.data]);

  const peakMonth = stats.monthly.indexOf(Math.max(...stats.monthly)) + 1;
  const peakCount = Math.max(...stats.monthly);

  const spendStats = useMemo(() => {
    const exp = spend.data?.expenses ?? [];
    const mer = spend.data?.merch ?? [];
    const byCat: Record<string, number> = {};
    let total = 0;
    for (const e of exp) {
      const amt = Number(e.amount) || 0;
      total += amt;
      byCat[e.category ?? "其他"] = (byCat[e.category ?? "其他"] ?? 0) + amt;
    }
    let merchTotal = 0;
    for (const m of mer) {
      const amt = Number(m.price) || 0;
      merchTotal += amt;
      byCat[`收藏·${m.kind ?? "其他"}`] = (byCat[`收藏·${m.kind ?? "其他"}`] ?? 0) + amt;
    }
    total += merchTotal;
    const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    return {
      total,
      merchCount: mer.length,
      merchFav: mer.filter((m) => m.favorite).length,
      entries: entries.slice(0, 6),
      currency: exp[0]?.currency ?? mer[0]?.currency ?? "CNY",
    };
  }, [spend.data]);


  if (q.isLoading) {
    return <div className="min-h-screen bg-background p-6"><div className="h-64 shimmer rounded-3xl" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-divider bg-background/90 px-4 py-3 backdrop-blur-md">
        <Link to="/me" className="rounded-full p-1.5 text-foreground/70"><ChevronLeft className="h-5 w-5" /></Link>
        <span className="eyebrow flex-1">{year} · Wrapped</span>
      </div>

      <main className="divide-y divide-divider">
        {/* Card 1 — headline */}
        <Card>
          <div className="flex h-full flex-col justify-center">
            <p className="eyebrow">Year in review</p>
            <p className="display-title mt-3 text-[64px] leading-none tabular">{year}</p>
            <p className="mt-8 text-2xl font-semibold">
              你遇见了 <span className="tabular">{stats.teachers}</span> 位老师
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              留下 <span className="tabular text-foreground">{stats.total}</span> 条记录，
              去了 <span className="tabular text-foreground">{stats.events}</span> 场展会。
            </p>
          </div>
        </Card>

        {/* Card 2 — top animes */}
        {stats.topAnimes.length > 0 && (
          <Card>
            <div className="flex h-full flex-col justify-center">
              <p className="eyebrow">Top Series</p>
              <p className="mt-3 text-sm text-muted-foreground">你最偏爱的作品</p>
              <ol className="mt-8 space-y-4">
                {stats.topAnimes.map(([name, count], i) => (
                  <li key={name} className="flex items-baseline gap-4 hairline-b pb-3">
                    <span className="display-title text-[42px] tabular text-foreground/25">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1">
                      <p className="text-lg font-semibold">{name}</p>
                      <p className="text-xs text-muted-foreground">{count} 次</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Card>
        )}

        {/* Card 3 — peak month */}
        {peakCount > 0 && (
          <Card>
            <div className="flex h-full flex-col justify-center">
              <p className="eyebrow">Peak Month</p>
              <p className="mt-3 text-sm text-muted-foreground">最忙碌的一个月</p>
              <p className="display-title mt-6 text-[96px] tabular leading-none">{peakMonth}<span className="text-[36px] opacity-50">月</span></p>
              <p className="mt-4 text-lg font-semibold">{peakCount} 次遇见</p>
              <div className="mt-10 flex h-24 items-end gap-1.5">
                {stats.monthly.map((c, i) => {
                  const h = peakCount > 0 ? (c / peakCount) * 100 : 0;
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-t ${i + 1 === peakMonth ? "bg-foreground" : "bg-foreground/25"}`}
                        style={{ height: `${Math.max(h, 4)}%` }}
                      />
                      <span className="text-[9px] tabular text-muted-foreground">{i + 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

        {/* Card 4 — best rated */}
        {stats.bestRow && (
          <Card>
            <div className="flex h-full flex-col justify-center">
              <p className="eyebrow">Highlight</p>
              <p className="mt-3 text-sm text-muted-foreground">你打出最高分的记录</p>
              {stats.bestRow.photo_url && (
                <div className="mt-6 overflow-hidden rounded-3xl">
                  <StorageImage bucket="photos" path={stats.bestRow.photo_url} className="aspect-[4/5] w-full" />
                </div>
              )}
              <p className="mt-5 text-2xl font-semibold">
                {stats.bestRow.teacher_name || stats.bestRow.character_name || "未命名"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {"★".repeat(stats.bestRating)} · {stats.bestRow.character_name || "—"}
              </p>
            </div>
          </Card>
        )}

        {/* Card 4.5 — spend & collection */}
        {spendStats.total > 0 && (
          <Card>
            <div className="flex h-full flex-col justify-center">
              <p className="eyebrow">Spend & Collection</p>
              <p className="mt-3 text-sm text-muted-foreground">这一年的支持与收藏</p>
              <p className="display-title mt-6 text-[64px] leading-none tabular">
                {spendStats.currency === "CNY" ? "¥" : ""}{Math.round(spendStats.total).toLocaleString()}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                收藏 {spendStats.merchCount} 件 · 心动 {spendStats.merchFav} 件
              </p>
              {spendStats.entries.length > 0 && (
                <ul className="mt-8 space-y-3">
                  {spendStats.entries.map(([cat, amt]) => {
                    const pct = spendStats.total > 0 ? (amt / spendStats.total) * 100 : 0;
                    return (
                      <li key={cat}>
                        <div className="flex justify-between text-xs">
                          <span className="text-foreground/80">{cat}</span>
                          <span className="tabular text-muted-foreground">
                            {spendStats.currency === "CNY" ? "¥" : ""}{Math.round(amt)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 rounded-full bg-foreground/10 overflow-hidden">
                          <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        )}

        {/* Card 5 — collage */}
        {stats.gallery.length > 0 && (
          <Card>
            <div className="flex h-full flex-col justify-center">
              <p className="eyebrow">Your {year}</p>
              <p className="mt-3 text-sm text-muted-foreground">代表画面</p>
              <div className="mt-6 grid grid-cols-3 gap-1.5">
                {stats.gallery.map((r) => (
                  <div key={r.id} className="aspect-square overflow-hidden rounded-lg">
                    <StorageImage bucket="photos" path={r.photo_url} className="h-full w-full" />
                  </div>
                ))}
              </div>
              <div className="mt-10 text-center">
                <Sparkles className="mx-auto h-6 w-6 text-foreground/40" />
                <p className="mt-3 text-sm">下次也一样精彩。</p>
              </div>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-md px-6 py-10">
      {children}
    </section>
  );
}
