import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { StorageImage } from "@/components/StorageImage";
import { Search, X, Heart, Star, Merge } from "lucide-react";
import { MergeSuggestionSheet } from "@/components/teachers/MergeSuggestionSheet";

export const Route = createFileRoute("/_authenticated/teachers/")({
  component: TeachersIndex,
});

type Row = {
  teacher_name: string;
  photo_url: string | null;
  occurred_at: string;
  favorite: boolean;
  rating: number;
  events: { name?: string } | { name?: string }[] | null;
};

function ev(e: Row["events"]): string | null {
  if (!e) return null;
  if (Array.isArray(e)) return e[0]?.name ?? null;
  return e.name ?? null;
}

function TeachersIndex() {
  const [q, setQ] = useState("");
  const [mergeOpen, setMergeOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["teachers-aggregate"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("records")
        .select("teacher_name, photo_url, occurred_at, favorite, rating, events(name)")
        .not("teacher_name", "is", null)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, {
      name: string;
      count: number;
      favorites: number;
      maxRating: number;
      lastAt: string;
      lastEvent: string | null;
      cover: string | null;
    }>();
    for (const r of data ?? []) {
      const name = r.teacher_name?.trim();
      if (!name) continue;
      const cur = map.get(name);
      if (!cur) {
        map.set(name, {
          name,
          count: 1,
          favorites: r.favorite ? 1 : 0,
          maxRating: r.rating ?? 0,
          lastAt: r.occurred_at,
          lastEvent: ev(r.events),
          cover: r.photo_url,
        });
      } else {
        cur.count += 1;
        if (r.favorite) cur.favorites += 1;
        cur.maxRating = Math.max(cur.maxRating, r.rating ?? 0);
      }
    }
    const list = Array.from(map.values()).sort((a, b) => b.count - a.count || +new Date(b.lastAt) - +new Date(a.lastAt));
    const kw = q.trim().toLowerCase();
    return kw ? list.filter((t) => t.name.toLowerCase().includes(kw)) : list;
  }, [data, q]);

  return (
    <AppShell eyebrow="People" title="老师">
      <div className="sticky top-[68px] z-20 -mx-4 mb-4 bg-background/85 px-4 pb-3 pt-1 backdrop-blur-md">
        <div className="hairline-b pb-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索昵称"
              className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            />
            {q && (
              <button onClick={() => setQ("")} className="rounded-full p-1 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="eyebrow tabular">
            {isLoading ? "…" : `${grouped.length} ${grouped.length === 1 ? "person" : "people"}`}
          </p>
          {grouped.length >= 2 && (
            <button
              onClick={() => setMergeOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-divider px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground active:opacity-60"
            >
              <Merge className="h-3 w-3" strokeWidth={1.6} /> 合并相似
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <ul className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <li key={i} className="h-20 shimmer rounded-3xl" />)}
        </ul>
      ) : grouped.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-divider p-12 text-center">
          <p className="display-title text-[42px] text-foreground/15">Empty</p>
          <p className="mt-2 text-xs text-muted-foreground">{(data?.length ?? 0) === 0 ? "还没有记录任何老师" : "没有匹配"}</p>
        </div>
      ) : (
        <ul className="divide-y divide-divider">
          {grouped.map((t, i) => (
            <li key={t.name}>
              <Link
                to="/teachers/$name"
                params={{ name: encodeURIComponent(t.name) }}
                className="flex items-center gap-4 py-4 active:opacity-60 transition"
              >
                <span className="eyebrow w-6 tabular shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
                  {t.cover ? <StorageImage bucket="photos" path={t.cover} className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate display-title text-[20px]">{t.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {t.count} 次 · {t.lastEvent ?? "自由外拍"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-[10px] text-muted-foreground">
                  {t.favorites > 0 && (
                    <span className="inline-flex items-center gap-0.5 tabular">
                      <Heart className="h-3 w-3 fill-current" strokeWidth={0} /> {t.favorites}
                    </span>
                  )}
                  {t.maxRating > 0 && (
                    <span className="inline-flex items-center gap-0.5 tabular">
                      <Star className="h-3 w-3 fill-current" strokeWidth={0} /> {t.maxRating}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {mergeOpen && (
        <MergeSuggestionSheet
          names={grouped.map((g) => ({ name: g.name, count: g.count }))}
          onClose={() => setMergeOpen(false)}
        />
      )}
    </AppShell>
  );
}
