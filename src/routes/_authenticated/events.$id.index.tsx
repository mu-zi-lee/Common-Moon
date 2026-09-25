import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { StorageImage } from "@/components/StorageImage";
import { PortraitCard, type PortraitRecord } from "@/components/records/PortraitCard";
import { EventSummaryCard } from "@/components/events/EventSummaryCard";
import { EventPathOverlay } from "@/components/EventPathOverlay";
import { EventExpensesPanel } from "@/components/events/EventExpensesPanel";
import { EventMerchPanel } from "@/components/events/EventMerchPanel";
import { SubscribeButton } from "@/components/SubscribeButton";
import { buildEventPath } from "@/lib/event-path";
import { Edit2, MapPin, Users, Search, X, Sparkles, Download, Loader2 } from "lucide-react";
import { ExportPosterSheet, type PosterRecord } from "@/components/records/ExportPosterSheet";
import { toast } from "sonner";

type Tab = "records" | "merch" | "expenses";

export const Route = createFileRoute("/_authenticated/events/$id/")({
  component: EventDetail,
});

function EventDetail() {
  const { id } = Route.useParams();
  const [hallFilter, setHallFilter] = useState<string | null>(null);
  const [todayOnly, setTodayOnly] = useState(false);
  const [tab, setTab] = useState<Tab>("records");
  const [boothQ, setBoothQ] = useState("");
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportRecord, setExportRecord] = useState<PosterRecord | null>(null);
  const [batchQueue, setBatchQueue] = useState<PosterRecord[]>([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchLoading, setBatchLoading] = useState(false);

  async function handleQuickExport(recordId: string) {
    if (exportingId) return;
    setExportingId(recordId);
    try {
      const { data, error } = await supabase.from("records")
        .select("id, photo_url, photo_urls, teacher_name, character_name, anime_name, hall, favorite, rating, occurred_at, note, events(name), contacts(platform, handle)")
        .eq("id", recordId).single();
      if (error) throw error;
      setExportRecord(data as unknown as PosterRecord);
    } catch (e) {
      setExportingId(null);
      toast.error(e instanceof Error ? e.message : "加载失败");
    }
  }

  async function handleBatchExport() {
    if (batchLoading || batchQueue.length > 0 || exportRecord) return;
    const ids = filtered.map((r) => r.id);
    if (ids.length === 0) { toast.info("没有记录可导出"); return; }
    setBatchLoading(true);
    try {
      const { data, error } = await supabase.from("records")
        .select("id, photo_url, photo_urls, teacher_name, character_name, anime_name, hall, favorite, rating, occurred_at, note, events(name), contacts(platform, handle)")
        .in("id", ids);
      if (error) throw error;
      const orderMap = new Map(ids.map((x, i) => [x, i]));
      const sorted = ((data ?? []) as unknown as PosterRecord[])
        .slice()
        .sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
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
    setExportingId(null);
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

  const event = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const recs = useQuery({
    queryKey: ["event-records", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("records")
        .select("id, photo_url, teacher_name, character_name, anime_name, hall, booth, favorite, rating, occurred_at, marker_x, marker_y, events(name)")
        .eq("event_id", id)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const rows = recs.data ?? [];
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const q = boothQ.trim().toLowerCase();
    return rows.filter((r) => {
      if (hallFilter && r.hall !== hallFilter) return false;
      if (todayOnly && +new Date(r.occurred_at) < +start) return false;
      if (q) {
        const hay = `${r.booth ?? ""} ${r.hall ?? ""} ${r.teacher_name ?? ""} ${r.character_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [recs.data, hallFilter, todayOnly, boothQ]);

  const todayCount = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return (recs.data ?? []).filter((r) => +new Date(r.occurred_at) >= +start).length;
  }, [recs.data]);

  const uniqueTeachers = useMemo(() => {
    const s = new Set<string>();
    for (const r of recs.data ?? []) if (r.teacher_name) s.add(r.teacher_name);
    return s.size;
  }, [recs.data]);

  const path = useMemo(() => buildEventPath(recs.data ?? []), [recs.data]);

  if (event.isLoading || !event.data) {
    return <AppShell title="载入中" onBack={() => history.back()} hideTabs><div className="h-64 animate-pulse rounded-3xl bg-muted" /></AppShell>;
  }

  const e = event.data;

  return (
    <AppShell
      title={e.name}
      onBack={() => history.back()}
      hideTabs
      right={
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleBatchExport}
            disabled={batchLoading || batchQueue.length > 0 || !!exportRecord}
            className="rounded-full p-2 text-foreground active:scale-95 disabled:opacity-50"
            aria-label="一键导出所有应援卡"
            title="一键导出所有应援卡"
          >
            {batchLoading || batchQueue.length > 0
              ? <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.6} />
              : <Download className="h-5 w-5" strokeWidth={1.6} />}
          </button>
          <Link to="/events/$id/edit" params={{ id }} className="rounded-full p-2 text-primary active:scale-95">
            <Edit2 className="h-5 w-5" />
          </Link>
        </div>
      }
    >
      {/* Header card with map */}
      <div className="overflow-hidden rounded-3xl border border-border/50 bg-card shadow-sm">
        {e.map_image_url ? (
          <div className="relative aspect-[16/10] w-full bg-muted">
            <StorageImage bucket="maps" path={e.map_image_url} className="h-full w-full object-cover" />
            <EventPathOverlay path={path} />
          </div>
        ) : (
          <div className="flex aspect-[16/10] items-center justify-center bg-muted text-muted-foreground">
            <MapPin className="h-8 w-8" />
          </div>
        )}
        <div className="p-4">
          <p className="eyebrow">Exhibition</p>
          <h1 className="display-title mt-1 text-[26px]">{e.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[e.year, e.city, e.venue].filter(Boolean).join(" · ") || "—"}
          </p>
          <div className="mt-3 flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1 text-muted-foreground"><Users className="h-3.5 w-3.5" /> {uniqueTeachers} 位老师</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{recs.data?.length ?? 0} 次记录</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{path.points.length} 个足迹</span>
          </div>
          <div className="mt-3"><SubscribeButton kind="event" eventId={id} /></div>
        </div>
      </div>

      {tab === "records" && (recs.data?.length ?? 0) > 0 && <EventSummaryCard eventId={id} />}

      {/* AI 攻略助手入口 */}
      <Link
        to="/guides/new"
        search={{ event: id }}
        className="mt-3 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 active:scale-[0.99]"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">AI 攻略助手</p>
          <p className="text-[11px] text-muted-foreground">
            把别人的展台/coser 攻略变成你的个性化行程
          </p>
        </div>
        <span className="text-[11px] text-primary">解析 →</span>
      </Link>

      {/* Tabs */}
      <div className="mt-5 flex gap-6 border-b border-divider">
        {([
          { k: "records", label: "记录" },
          { k: "merch", label: "战利品" },
          { k: "expenses", label: "花费" },
        ] as { k: Tab; label: string }[]).map((t) => {
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`-mb-px border-b-2 pb-2.5 text-sm font-medium transition ${active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "records" && (
        <>
          {/* Booth / name quick search */}
          <div className="mt-4 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={boothQ}
              onChange={(ev) => setBoothQ(ev.target.value)}
              placeholder="搜索摊位号、展馆、老师……"
              className="w-full rounded-full border border-divider bg-background pl-9 pr-9 h-10 text-sm outline-none focus:border-foreground/40"
            />
            {boothQ && (
              <button onClick={() => setBoothQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-3 -mx-4 overflow-x-auto px-4">
            <div className="flex gap-2 pb-1">
              {todayCount > 0 && (
                <button
                  onClick={() => setTodayOnly((v) => !v)}
                  className={`h-9 shrink-0 rounded-full px-4 text-sm font-medium transition ${todayOnly ? "bg-foreground text-background" : "bg-secondary"}`}
                >
                  今日 <span className="ml-1 opacity-70">{todayCount}</span>
                </button>
              )}
              <button
                onClick={() => setHallFilter(null)}
                className={`h-9 shrink-0 rounded-full px-4 text-sm font-medium transition ${!hallFilter ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
              >
                全部
              </button>
              {(e.halls ?? []).map((h: string) => {
                const cnt = (recs.data ?? []).filter((r) => r.hall === h).length;
                return (
                  <button
                    key={h}
                    onClick={() => setHallFilter(h)}
                    className={`h-9 shrink-0 rounded-full px-4 text-sm font-medium transition ${hallFilter === h ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                  >
                    {h}{cnt > 0 && <span className="ml-1 opacity-70">{cnt}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            {recs.isLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[10/14] animate-pulse rounded-[1.75rem] bg-muted" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-3xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                {boothQ ? `没有匹配 "${boothQ}" 的记录` : hallFilter ? `${hallFilter} 还没有记录` : "还没有记录任何老师"}
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-3">
                {filtered.map((r, i) => (
                  <li key={r.id} className="relative">
                    <PortraitCard record={r as unknown as PortraitRecord} index={i} />
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleQuickExport(r.id); }}
                      disabled={exportingId === r.id}
                      className="absolute top-2.5 right-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/85 text-foreground backdrop-blur-md ring-1 ring-foreground/10 active:scale-95 disabled:opacity-60"
                      aria-label="一键导出应援卡"
                      title="一键导出应援卡"
                    >
                      {exportingId === r.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} />
                        : <Download className="h-3.5 w-3.5" strokeWidth={1.8} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {tab === "merch" && <div className="mt-4"><EventMerchPanel eventId={id} /></div>}
      {tab === "expenses" && <div className="mt-4"><EventExpensesPanel eventId={id} /></div>}

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
