import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { PortraitCard, type PortraitRecord } from "@/components/records/PortraitCard";
import { DraftQueueBanner } from "@/components/records/DraftQueueBanner";
import { BatchTagCTA } from "@/components/records/BatchTagCTA";
import { ExportPosterSheet, type PosterRecord } from "@/components/records/ExportPosterSheet";
import { Search, SlidersHorizontal, Heart, Star, X, LayoutGrid, CalendarDays, Landmark, Plus, Images, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({
  q: z.string().optional().catch(""),
  fav: z.boolean().optional().catch(false),
  minRating: z.number().int().min(0).max(5).optional().catch(0),
  event: z.string().uuid().optional().catch(undefined),
  tags: z.string().optional().catch(undefined), // comma-separated tag names
  quick: z.enum(["all", "fav", "month", "no_contact", "no_meta"]).optional().catch("all"),
  view: z.enum(["grid", "date", "event"]).optional().catch("grid"),
});

export const Route = createFileRoute("/_authenticated/records/")({
  component: RecordsList,
  validateSearch: searchSchema,
});

type Row = PortraitRecord & { event_id: string | null; _hasContact?: boolean; _tags: string[] };

function RecordsList() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const [drawer, setDrawer] = useState(false);
  const [qLocal, setQLocal] = useState(search.q ?? "");
  const [exportRecord, setExportRecord] = useState<PosterRecord | null>(null);
  const [batchQueue, setBatchQueue] = useState<PosterRecord[]>([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchLoading, setBatchLoading] = useState(false);

  const selectedTags = useMemo(
    () => (search.tags ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
    [search.tags],
  );

  const events = useQuery({
    queryKey: ["events-list-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, name, year").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const allTags = useQuery({
    queryKey: ["tags-list"],
    queryFn: async () => {
      const { data } = await supabase.from("tags").select("name").order("name");
      return (data ?? []).map((t) => t.name);
    },
  });

  const records = useQuery({
    queryKey: ["records-all-v3"],
    queryFn: async () => {
      const { data, error } = await supabase.from("records")
        .select("id, photo_url, teacher_name, character_name, anime_name, hall, favorite, rating, occurred_at, event_id, events(name), contacts(id), record_tags(tags(name))")
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        _hasContact: Array.isArray(r.contacts) && r.contacts.length > 0,
        _tags: (r.record_tags ?? [])
          .map((rt: { tags: { name: string } | null }) => rt.tags?.name)
          .filter(Boolean) as string[],
      })) as unknown as Row[];
    },
  });

  const monthStart = useMemo(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime();
  }, []);

  const view = search.view ?? "grid";
  const quick = search.quick ?? "all";

  const filtered = useMemo(() => {
    const all = records.data ?? [];
    const q = (search.q ?? "").trim().toLowerCase();
    return all.filter((r) => {
      if (quick === "fav" && !r.favorite) return false;
      if (quick === "month" && +new Date(r.occurred_at) < monthStart) return false;
      if (quick === "no_contact" && r._hasContact) return false;
      if (quick === "no_meta" && (r.teacher_name || r.character_name)) return false;
      if (search.fav && !r.favorite) return false;
      if ((search.minRating ?? 0) > 0 && (r.rating ?? 0) < (search.minRating ?? 0)) return false;
      if (search.event && r.event_id !== search.event) return false;
      if (selectedTags.length && !selectedTags.every((t: string) => r._tags.includes(t))) return false;
      if (q) {
        const hay = [
          r.teacher_name, r.character_name, r.anime_name, r.hall,
          Array.isArray(r.events) ? r.events[0]?.name : r.events?.name,
          ...r._tags,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records.data, search, quick, monthStart, selectedTags]);

  const grouped = useMemo(() => {
    if (view === "grid") return null;
    const map = new Map<string, Row[]>();
    for (const r of filtered) {
      let key: string;
      if (view === "date") {
        const d = new Date(r.occurred_at);
        key = d.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
      } else {
        const ev = Array.isArray(r.events) ? r.events[0]?.name : r.events?.name;
        key = ev || "自由外拍";
      }
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [filtered, view]);

  const activeFilters = (search.fav ? 1 : 0) + ((search.minRating ?? 0) > 0 ? 1 : 0) + (search.event ? 1 : 0) + selectedTags.length;

  function toggleTag(name: string) {
    const set = new Set(selectedTags);
    if (set.has(name)) set.delete(name); else set.add(name);
    const next = Array.from(set);
    updateSearch({ tags: next.length ? next.join(",") : undefined });
  }

  function updateSearch(patch: Partial<typeof search>) {
    navigate({ search: (prev: typeof search) => ({ ...prev, ...patch }), replace: true });
  }

  const quickChips: { key: NonNullable<typeof search.quick>; label: string; icon?: React.ReactNode }[] = [
    { key: "all", label: "全部" },
    { key: "fav", label: "收藏", icon: <Heart className="h-3 w-3 fill-current" /> },
    { key: "month", label: "本月" },
    { key: "no_meta", label: "待整理" },
    { key: "no_contact", label: "缺联系" },
  ];

  const viewIcons: { key: NonNullable<typeof search.view>; icon: React.ReactNode; label: string }[] = [
    { key: "grid", icon: <LayoutGrid className="h-4 w-4" strokeWidth={1.6} />, label: "平铺" },
    { key: "date", icon: <CalendarDays className="h-4 w-4" strokeWidth={1.6} />, label: "按日期" },
    { key: "event", icon: <Landmark className="h-4 w-4" strokeWidth={1.6} />, label: "按展会" },
  ];

  async function handleBatchExport() {
    if (batchLoading || batchQueue.length > 0 || exportRecord) return;
    const ids = filtered.map((r) => r.id);
    if (ids.length === 0) { toast.info("没有记录可导出"); return; }
    setBatchLoading(true);
    try {
      const { data, error } = await supabase.from("records")
        .select("id, photo_url, teacher_name, character_name, anime_name, hall, favorite, rating, occurred_at, note, events(name), contacts(platform, handle)")
        .in("id", ids);
      if (error) throw error;
      const orderMap = new Map(ids.map((x, i) => [x, i]));
      const sorted = ((data ?? []) as unknown as Omit<PosterRecord, "photo_urls">[])
        .slice()
        .sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
        .map((r) => ({ ...r, photo_urls: null } as PosterRecord));
      if (sorted.length === 0) { toast.info("没有记录可导出"); return; }
      setBatchTotal(sorted.length);
      setBatchQueue(sorted.slice(1));
      setExportRecord(sorted[0]);
      toast.success(`开始批量导出 ${sorted.length} 张，请允许浏览器多次下载`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "加载失败");
    } finally {
      setBatchLoading(false);
    }
  }

  function handleExportClose() {
    if (batchQueue.length > 0) {
      const [next, ...rest] = batchQueue;
      setBatchQueue(rest);
      setExportRecord(next);
    } else {
      if (batchTotal > 0) toast.success(`已导出 ${batchTotal} 张应援卡`);
      setBatchTotal(0);
      setExportRecord(null);
    }
  }

  return (
    <AppShell
      eyebrow="Archive"
      title="记录"
      right={
        <div className="flex items-center gap-0.5">
          <Link
            to="/records/batch"
            className="rounded-full p-2 text-muted-foreground/60 transition hover:text-foreground"
            aria-label="批量导入"
          >
            <Images className="h-4 w-4" strokeWidth={1.6} />
          </Link>
          <button
            type="button"
            onClick={handleBatchExport}
            disabled={batchLoading || batchQueue.length > 0 || !!exportRecord}
            className="rounded-full p-2 text-muted-foreground/60 transition hover:text-foreground disabled:opacity-50"
            aria-label="一键导出所有应援卡"
            title="一键导出所有应援卡（仅封面）"
          >
            {batchLoading || batchQueue.length > 0
              ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.6} />
              : <Download className="h-4 w-4" strokeWidth={1.6} />}
          </button>
          {viewIcons.map((v) => (
            <button
              key={v.key}
              onClick={() => updateSearch({ view: v.key })}
              className={`rounded-full p-2 transition ease-editorial ${view === v.key ? "text-foreground" : "text-muted-foreground/60"}`}
              aria-label={v.label}
            >
              {v.icon}
            </button>
          ))}
        </div>
      }
    >
      <div className="sticky top-[68px] z-20 -mx-4 mb-4 space-y-3 bg-background/85 px-4 pb-3 pt-1 backdrop-blur-md">
        {/* Search: underline style */}
        <div className="flex items-end gap-3">
          <div className="relative flex-1 hairline-b pb-2">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
              <input
                value={qLocal}
                onChange={(e) => setQLocal(e.target.value)}
                onBlur={() => updateSearch({ q: qLocal || undefined })}
                onKeyDown={(e) => { if (e.key === "Enter") updateSearch({ q: qLocal || undefined }); }}
                placeholder="搜索昵称 / 角色 / 展会"
                className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
              />
              {qLocal && (
                <button
                  onClick={() => { setQLocal(""); updateSearch({ q: undefined }); }}
                  className="rounded-full p-1 text-muted-foreground"
                  aria-label="清空"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <button
            onClick={() => setDrawer(true)}
            className="relative flex h-10 items-center gap-1.5 rounded-full bg-surface-1 px-3.5 text-[11px] font-medium tracking-wider uppercase active:scale-95 ease-editorial transition"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.6} />
            筛选
            {activeFilters > 0 && (
              <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-semibold text-background tabular">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {/* Quick chips */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          {quickChips.map((c) => {
            const active = quick === c.key;
            return (
              <button
                key={c.key}
                onClick={() => updateSearch({ quick: c.key === "all" ? undefined : c.key })}
                className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-3 text-[11px] tracking-wider uppercase transition ease-editorial ${
                  active
                    ? "bg-foreground text-background"
                    : "bg-transparent text-muted-foreground hover:text-foreground border border-divider"
                }`}
              >
                {c.icon}
                {c.label}
              </button>
            );
          })}
        </div>

        {activeFilters > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {search.fav && (
              <FilterChip onRemove={() => updateSearch({ fav: undefined })}>
                <Heart className="h-3 w-3 fill-current" /> 收藏
              </FilterChip>
            )}
            {(search.minRating ?? 0) > 0 && (
              <FilterChip onRemove={() => updateSearch({ minRating: undefined })}>
                <Star className="h-3 w-3 fill-current" /> ≥ {search.minRating}
              </FilterChip>
            )}
            {search.event && events.data && (
              <FilterChip onRemove={() => updateSearch({ event: undefined })}>
                {events.data.find((e) => e.id === search.event)?.name ?? "展会"}
              </FilterChip>
            )}
            {selectedTags.map((t: string) => (
              <FilterChip key={t} onRemove={() => toggleTag(t)}>
                #{t}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      <DraftQueueBanner />
      {quick === "no_meta" && <BatchTagCTA targets={filtered} />}


      {records.isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[10/13] shimmer rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-divider p-12 text-center">
          <p className="display-title text-[42px] text-foreground/15">Empty</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {(records.data?.length ?? 0) === 0 ? "还没有记录" : "没有匹配的结果"}
          </p>
          {qLocal && (
            <Link
              to="/records/new"
              className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground px-5 text-xs font-semibold text-background active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" /> 以「{qLocal}」新建
            </Link>
          )}
        </div>
      ) : view === "grid" ? (
        <ul className="grid grid-cols-2 gap-4">
          {filtered.map((r, i) => (
            <li key={r.id}>
              <PortraitCard record={{ ...r, tags: r._tags }} index={i} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-8">
          {grouped!.map(([groupKey, rows]) => (
            <section key={groupKey}>
              <div className="mb-3 flex items-baseline justify-between hairline-b pb-2">
                <div>
                  <p className="eyebrow">{view === "date" ? "Day" : "Event"}</p>
                  <h3 className="display-title mt-1 text-[22px]">{groupKey}</h3>
                </div>
                <span className="eyebrow tabular">{String(rows.length).padStart(2, "0")}</span>
              </div>
              <ul className="grid grid-cols-2 gap-4">
                {rows.map((r, i) => (
                  <li key={r.id}>
                    <PortraitCard record={{ ...r, tags: r._tags }} index={i} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Filter drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[80] bg-foreground/40 backdrop-blur-sm" onClick={() => setDrawer(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-background p-6 safe-bottom shadow-editorial"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-divider" />
            <div className="hairline-b pb-3">
              <p className="eyebrow">Refine</p>
              <h3 className="display-title mt-1 text-[26px]">筛选</h3>
            </div>

            <div className="mt-5 space-y-5">
              <button
                onClick={() => updateSearch({ fav: search.fav ? undefined : true })}
                className={`flex h-11 w-full items-center justify-between rounded-2xl px-4 text-sm transition ease-editorial ${
                  search.fav ? "bg-foreground text-background" : "bg-surface-1"
                }`}
              >
                <span className="flex items-center gap-2"><Heart className="h-4 w-4" strokeWidth={1.6} /> 仅收藏</span>
                <span className="text-xs">{search.fav ? "✓" : ""}</span>
              </button>

              <div>
                <p className="eyebrow mb-2">最低评分</p>
                <div className="flex gap-1.5">
                  {[0, 1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      onClick={() => updateSearch({ minRating: v === 0 ? undefined : v })}
                      className={`h-10 flex-1 rounded-xl text-sm font-medium tabular transition ease-editorial ${
                        (search.minRating ?? 0) === v
                          ? "bg-foreground text-background"
                          : "bg-surface-1"
                      }`}
                    >
                      {v === 0 ? "—" : `${v}★`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="eyebrow mb-2">展会</p>
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  <button
                    onClick={() => updateSearch({ event: undefined })}
                    className={`flex h-10 w-full items-center rounded-xl px-3 text-sm transition ${
                      !search.event ? "bg-foreground text-background" : "bg-surface-1"
                    }`}
                  >
                    全部展会
                  </button>
                  {(events.data ?? []).map((e) => (
                    <button
                      key={e.id}
                      onClick={() => updateSearch({ event: e.id })}
                      className={`flex h-10 w-full items-center rounded-xl px-3 text-sm transition ${
                        search.event === e.id ? "bg-foreground text-background" : "bg-surface-1"
                      }`}
                    >
                      <span className="truncate">{e.name}{e.year ? ` (${e.year})` : ""}</span>
                    </button>
                  ))}
                </div>
              </div>

              {(allTags.data?.length ?? 0) > 0 && (
                <div>
                  <p className="eyebrow mb-2">标签{selectedTags.length ? ` · ${selectedTags.length}` : ""}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(allTags.data ?? []).map((name: string) => {
                      const active = selectedTags.includes(name);
                      return (
                        <button
                          key={name}
                          onClick={() => toggleTag(name)}
                          className={`inline-flex h-8 items-center rounded-full px-3 text-xs transition ease-editorial ${
                            active
                              ? "bg-foreground text-background"
                              : "bg-surface-1 text-foreground/80 hover:text-foreground"
                          }`}
                        >
                          #{name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => { updateSearch({ fav: undefined, minRating: undefined, event: undefined, tags: undefined }); }}
                className="h-11 flex-1 rounded-full border border-divider text-sm font-medium"
              >
                清空
              </button>
              <button
                onClick={() => setDrawer(false)}
                className="h-11 flex-1 rounded-full bg-foreground text-sm font-semibold text-background"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {exportRecord && (
        <ExportPosterSheet
          key={exportRecord.id}
          record={exportRecord}
          open={!!exportRecord}
          autoDownload
          onClose={handleExportClose}
        />
      )}
    </AppShell>
  );
}

function FilterChip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-1 px-2.5 py-1 text-[11px] font-medium text-foreground">
      {children}
      <button onClick={onRemove} className="rounded-full p-0.5 text-muted-foreground" aria-label="移除"><X className="h-3 w-3" /></button>
    </span>
  );
}
