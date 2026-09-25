import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StorageImage } from "@/components/StorageImage";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { EventPathOverlay } from "@/components/EventPathOverlay";
import { buildEventPath } from "@/lib/event-path";
import { deleteRecord } from "@/lib/records.functions";
import {
  Edit2, Trash2, Heart, Download,
  Copy, ExternalLink, ChevronLeft, ChevronRight, ArrowLeft, Share2, Search,
} from "lucide-react";
import { toast } from "sonner";
import { ExportPosterSheet, type PosterRecord } from "@/components/records/ExportPosterSheet";
import { ShareLinkSheet } from "@/components/records/ShareLinkSheet";
import { FindPhotosSheet } from "@/components/records/FindPhotosSheet";
import { InteractionRow } from "@/components/records/InteractionChips";
import { platformUrl } from "@/lib/contact-utils";
import { MediaScrim } from "@/components/MediaScrim";


export const Route = createFileRoute("/_authenticated/records/$id/")({
  component: RecordDetail,
});

function RecordDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const del = useServerFn(deleteRecord);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportQuickOpen, setExportQuickOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });
  const [activePhoto, setActivePhoto] = useState(0);


  const { data, isLoading } = useQuery({
    queryKey: ["record", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("records")
        .select("*, events(id, name, map_image_url, city, year), contacts(*), record_tags(tag_id, tags(name))")
        .eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const siblings = useQuery({
    queryKey: ["record-siblings", data?.event_id ?? "none"],
    queryFn: async () => {
      if (!data?.event_id) return [];
      const { data: rows } = await supabase.from("records")
        .select("id, occurred_at, teacher_name, marker_x, marker_y")
        .eq("event_id", data.event_id)
        .order("occurred_at", { ascending: false });
      return rows ?? [];
    },
    enabled: !!data?.event_id,
  });

  const nav = useMemo(() => {
    const list = siblings.data ?? [];
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return { prev: null, next: null, position: null };
    return {
      prev: idx > 0 ? list[idx - 1] : null,
      next: idx < list.length - 1 ? list[idx + 1] : null,
      position: `${String(idx + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}`,
    };
  }, [siblings.data, id]);

  const path = useMemo(() => buildEventPath(siblings.data ?? []), [siblings.data]);
  const pathIndex = path.indexOf(id);
  const walkedKm = (path.totalLen * 1.2).toFixed(1); // rough visual scale

  const delMut = useMutation({
    mutationFn: () => del({ data: { id } }),
    onSuccess: () => { toast.success("已删除"); qc.invalidateQueries(); navigate({ to: "/records" }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "删除失败"),
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="aspect-[4/5] shimmer" />
        <div className="p-4 space-y-3">
          <div className="h-24 shimmer rounded-3xl" />
          <div className="h-16 shimmer rounded-3xl" />
        </div>
      </div>
    );
  }

  const tags = (data.record_tags ?? [])
    .map((rt: { tags: { name: string } | null }) => rt.tags?.name)
    .filter(Boolean) as string[];

  const photos: string[] = (data.photo_urls && data.photo_urls.length > 0)
    ? data.photo_urls
    : (data.photo_url ? [data.photo_url] : []);

  const ev = data.events as { id?: string; name?: string; map_image_url?: string } | null;
  const date = new Date(data.occurred_at);
  const dateStr = date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  const dowStr = date.toLocaleDateString("zh-CN", { weekday: "short" });
  const timeStr = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  const stars = Math.max(0, Math.min(5, data.rating || 0));

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* ── Immersive editorial hero ── */}
      <div className="relative">
        {photos.length === 0 ? (
          <div className="flex aspect-[3/4] items-center justify-center bg-muted text-muted-foreground">
            <p className="display-title text-[42px] text-foreground/20">No photo</p>
          </div>
        ) : (
          <div className="relative">
            <div
              className="flex snap-x snap-mandatory overflow-x-auto"
              onScroll={(e) => {
                const el = e.currentTarget;
                const i = Math.round(el.scrollLeft / el.clientWidth);
                if (i !== activePhoto) setActivePhoto(i);
              }}
            >
              {photos.map((p, i) => (
                <button
                  key={p}
                  onClick={() => setLightbox({ open: true, index: i })}
                  className="relative aspect-[3/4] w-full shrink-0 snap-center"
                  style={{
                    WebkitMaskImage:
                      "linear-gradient(to bottom, black 0%, black 90%, transparent 100%)",
                    maskImage:
                      "linear-gradient(to bottom, black 0%, black 90%, transparent 100%)",
                  }}
                >
                  <StorageImage
                    bucket="photos"
                    path={p}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>

            {/* Bottom scrim — blends photo into page (theme-adaptive) */}
            <MediaScrim variant="bottom" height="38%" />

            {/* Magazine-style overlaid name — theme-adaptive text + halo */}
            <div className="pointer-events-none absolute inset-x-0 bottom-6 px-6">
              <p
                className="eyebrow text-foreground/85"
                style={{ textShadow: "0 1px 6px color-mix(in oklab, var(--background) 70%, transparent)" }}
              >
                Featured
              </p>
              <h1
                className="display-title mt-1 text-foreground text-[44px]"
                style={{
                  lineHeight: 0.95,
                  textShadow:
                    "0 2px 20px color-mix(in oklab, var(--background) 75%, transparent), 0 1px 3px color-mix(in oklab, var(--background) 60%, transparent)",
                }}
              >
                {data.teacher_name || "—"}
              </h1>
              {data.character_name && (
                <p
                  className="mt-2 text-foreground/85 text-sm italic font-display"
                  style={{ textShadow: "0 1px 8px color-mix(in oklab, var(--background) 70%, transparent)" }}
                >

                  as {data.character_name}
                  {data.anime_name ? ` · ${data.anime_name}` : ""}
                </p>
              )}
            </div>

            {photos.length > 1 && (
              <div className="pointer-events-none absolute top-2/3 right-4 flex flex-col gap-1.5">
                {photos.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === activePhoto ? "h-6 bg-white" : "bg-white/40"}`}
                    style={{ width: 3 }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Floating top buttons */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4 safe-top">
          <button
            onClick={() => history.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md active:scale-95 ease-editorial transition"
            aria-label="返回"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={1.6} />
          </button>
          <div className="flex items-center gap-2">
            {photos.length > 1 && (
              <span className="rounded-full bg-black/35 px-3 py-1.5 text-[10px] tracking-widest text-white backdrop-blur-md tabular">
                {String(activePhoto + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}
              </span>
            )}
            <button
              onClick={() => setExportQuickOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md active:scale-95 transition"
              aria-label="一键导出应援卡"
              title="一键导出"
            >
              <Download className="h-5 w-5" strokeWidth={1.6} />
            </button>



          </div>
        </div>
      </div>

      <main className="mx-auto max-w-md px-5 pt-4">
        {/* ── Meta strip ── */}
        <div className="flex items-center justify-between hairline-b pb-4">
          <div>
            <p className="eyebrow">Date</p>
            <p className="display-title mt-1 text-[18px]">
              {dateStr}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground tabular">{dowStr} · {timeStr}</p>
          </div>
          {data.favorite && (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background">
              <Heart className="h-4 w-4 fill-current" strokeWidth={0} />
            </div>
          )}
        </div>

        {/* Rating */}
        {stars > 0 && (
          <div className="mt-4 flex items-center justify-between hairline-b pb-4">
            <p className="eyebrow">Rating</p>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={`inline-block h-1.5 w-6 rounded-full ${i < stars ? "bg-foreground" : "bg-divider"}`}
                />
              ))}
              <span className="ml-1 display-title text-[16px] tabular">{stars}<span className="text-muted-foreground text-xs">/5</span></span>
            </div>
          </div>
        )}

        {/* Teacher link */}
        {data.teacher_name && (
          <Link
            to="/teachers/$name"
            params={{ name: encodeURIComponent(data.teacher_name) }}
            className="mt-4 flex items-center justify-between hairline-b pb-4 active:opacity-60 transition"
          >
            <div>
              <p className="eyebrow">Teacher</p>
              <p className="display-title mt-1 text-[20px] italic">{data.teacher_name}</p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          </Link>
        )}

        {/* Event / where */}
        {(ev || data.hall) && (
          <div className="mt-4 hairline-b pb-4">
            <p className="eyebrow">Venue</p>
            {ev?.id ? (
              <Link
                to="/events/$id"
                params={{ id: ev.id }}
                className="mt-1 flex items-baseline justify-between active:opacity-60 transition"
              >
                <p className="display-title truncate text-[20px]">{ev.name || "无展会"}</p>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
              </Link>
            ) : (
              <p className="display-title mt-1 text-[20px]">{ev?.name || "自由外拍"}</p>
            )}
            {(data.hall || data.booth) && (
              <p className="mt-1 text-[12px] text-muted-foreground">
                {data.hall}
                {data.booth ? <span className="ml-2 rounded-md bg-surface-1 px-1.5 py-0.5 tabular text-foreground/80">摊位 {data.booth}</span> : null}
              </p>
            )}
          </div>
        )}

        {/* Interactions */}
        {Array.isArray(data.interactions) && data.interactions.length > 0 && (
          <div className="mt-4 hairline-b pb-4">
            <p className="eyebrow mb-2">Ritual</p>
            <InteractionRow value={data.interactions as string[]} />
          </div>
        )}


        {/* Contacts */}
        {data.contacts && data.contacts.length > 0 && (
          <div className="mt-4 pb-4 hairline-b">
            <p className="eyebrow">Contact</p>
            <div className="mt-2 divide-y divide-divider">
              {data.contacts.map((c: { id: string; platform: string; handle: string }) => (
                <ContactRow key={c.id} platform={c.platform} handle={c.handle} />
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-4 hairline-b pb-4">
            <p className="eyebrow mb-2">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="rounded-full bg-surface-1 px-3 py-1 text-[11px] font-medium">#{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* Note */}
        {data.note && (
          <div className="mt-4 hairline-b pb-4">
            <p className="eyebrow mb-2">Note</p>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/85 font-display italic" style={{ fontStyle: "italic" }}>
              &ldquo;{data.note}&rdquo;
            </p>
          </div>
        )}

        {/* Map with path trace */}
        {data.event_id && ev?.map_image_url && path.points.length > 0 && (
          <div className="mt-4 hairline-b pb-4">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="eyebrow">Trail</p>
              {pathIndex >= 0 && (
                <p className="eyebrow tabular text-foreground/60">
                  Stop {String(pathIndex + 1).padStart(2, "0")} / {String(path.points.length).padStart(2, "0")}
                  {path.totalLen > 0 ? ` · ${walkedKm}km` : ""}
                </p>
              )}
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-surface-1">
              <StorageImage bucket="maps" path={ev.map_image_url} className="w-full" />
              <EventPathOverlay path={path} highlightId={id} />
            </div>
          </div>
        )}

        {/* Prev / Next */}
        {nav.position && (nav.prev || nav.next) && (
          <div className="mt-6 flex items-center gap-2">
            <SiblingButton dir="prev" record={nav.prev} />
            <div className="flex-1 text-center eyebrow tabular">{nav.position}</div>
            <SiblingButton dir="next" record={nav.next} />
          </div>
        )}
      </main>

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 hairline-t bg-background/95 backdrop-blur-md safe-bottom">
        <div className="mx-auto flex max-w-md gap-2 px-4 py-3">
          <Link
            to="/records/$id/edit"
            params={{ id }}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-surface-1 text-sm font-medium active:scale-[0.98] transition"
          >
            <Edit2 className="h-4 w-4" strokeWidth={1.6} /> 编辑
          </Link>
          <button
            onClick={() => setExportOpen(true)}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-foreground text-sm font-semibold text-background active:scale-[0.98] transition"
          >
            <Download className="h-4 w-4" strokeWidth={1.8} /> 导出应援卡
          </button>
          <button
            onClick={() => setFindOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-1 active:scale-95 transition"
            aria-label="求片"
            title="求片 / 找片"
          >
            <Search className="h-4 w-4" strokeWidth={1.6} />
          </button>
          <button
            onClick={() => setShareOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-1 active:scale-95 transition"
            aria-label="分享"
          >
            <Share2 className="h-4 w-4" strokeWidth={1.6} />
          </button>
          <button
            onClick={() => { if (confirm("确定删除这条记录？")) delMut.mutate(); }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-1 text-destructive active:scale-95 transition"
            aria-label="删除"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </div>
      </div>

      <PhotoLightbox
        photos={photos}
        open={lightbox.open}
        index={lightbox.index}
        onClose={() => setLightbox({ open: false, index: 0 })}
        onIndexChange={(i) => setLightbox({ open: true, index: i })}
      />
      <ExportPosterSheet record={data as unknown as PosterRecord} open={exportOpen} onClose={() => setExportOpen(false)} />
      <ExportPosterSheet record={data as unknown as PosterRecord} open={exportQuickOpen} autoDownload onClose={() => setExportQuickOpen(false)} />
      <ShareLinkSheet recordId={id} open={shareOpen} onClose={() => setShareOpen(false)} />
      <FindPhotosSheet
        open={findOpen}
        onClose={() => setFindOpen(false)}
        character={data.character_name}
        anime={data.anime_name}
        event={ev?.name ?? null}
        teacher={data.teacher_name}
      />
    </div>
  );
}


function SiblingButton({ dir, record }: { dir: "prev" | "next"; record: { id: string; teacher_name: string | null } | null }) {
  if (!record) {
    return (
      <div className={`flex h-14 min-w-0 flex-1 items-center rounded-2xl bg-surface-1/50 px-3 text-[10px] tracking-widest uppercase text-muted-foreground/50 ${dir === "next" ? "justify-end" : ""}`}>
        {dir === "prev" ? "— 起始 —" : "— 末尾 —"}
      </div>
    );
  }
  return (
    <Link
      to="/records/$id"
      params={{ id: record.id }}
      replace
      className={`flex h-14 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-surface-1 px-3 active:scale-[0.98] transition ease-editorial ${dir === "next" ? "flex-row-reverse text-right" : ""}`}
    >
      {dir === "prev" ? <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={1.6} /> : <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={1.6} />}
      <div className="min-w-0 flex-1">
        <p className="eyebrow">{dir === "prev" ? "Prev" : "Next"}</p>
        <p className="truncate display-title text-[15px] mt-0.5">{record.teacher_name || "—"}</p>
      </div>
    </Link>
  );
}

function ContactRow({ platform, handle }: { platform: string; handle: string }) {
  const url = platformUrl(platform, handle);
  async function copy() {
    try {
      await navigator.clipboard.writeText(handle);
      toast.success("已复制");
    } catch {
      toast.error("复制失败");
    }
  }
  return (
    <div className="flex items-center gap-2 py-3">
      <span className="eyebrow w-16 shrink-0">{platform}</span>
      <span className="flex-1 truncate font-mono text-sm">{handle}</span>
      <button onClick={copy} className="rounded-full p-2 text-muted-foreground active:scale-95 transition" aria-label="复制">
        <Copy className="h-3.5 w-3.5" strokeWidth={1.6} />
      </button>
      {url && (
        <a href={url} target="_blank" rel="noreferrer noopener" className="rounded-full p-2 text-muted-foreground active:scale-95 transition" aria-label="打开">
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.6} />
        </a>
      )}
    </div>
  );
}
