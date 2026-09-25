import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import exifr from "exifr";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/storage";
import { enqueue as enqueueDraft, flush as flushDrafts } from "@/lib/draft-queue";
import { Images, Loader2, Upload, Clock, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/records/batch")({
  component: BatchImport,
});

const CONCURRENCY = 3;
const CLUSTER_GAP_MIN = 20; // photos > 20min apart = new cluster

type Photo = {
  file: File;
  url: string;
  takenAt: number; // ms
};

type Cluster = {
  id: string;
  photos: Photo[];
  eventId: string | null;
  hall: string;
};

async function readExifTime(file: File): Promise<number> {
  try {
    const out = await exifr.parse(file, { pick: ["DateTimeOriginal", "CreateDate"] });
    const d = out?.DateTimeOriginal ?? out?.CreateDate;
    if (d instanceof Date && !isNaN(d.getTime())) return d.getTime();
  } catch { /* ignore */ }
  return file.lastModified || Date.now();
}

function fmtRange(a: number, b: number): string {
  const da = new Date(a), db = new Date(b);
  const same = da.toDateString() === db.toDateString();
  const day = da.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
  const ta = da.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  const tb = db.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  return same ? `${day} · ${ta}–${tb}` : `${day} · ${ta} → ${db.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} ${tb}`;
}

function BatchImport() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(0);

  const events = useQuery({
    queryKey: ["events-batch-picker"],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, name, halls, year").order("created_at", { ascending: false }).limit(30);
      return data ?? [];
    },
  });

  useEffect(() => {
    return () => {
      // Revoke object URLs on unmount
      photos.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [photos]);

  async function onPick(files: File[]) {
    if (!files.length) return;
    setScanning(true);
    setPhotos([]);
    setClusters([]);

    // Parse EXIF concurrently
    const parsed: Photo[] = [];
    const CHUNK = 6;
    for (let i = 0; i < files.length; i += CHUNK) {
      const slice = files.slice(i, i + CHUNK);
      const res = await Promise.all(
        slice.map(async (f) => ({
          file: f,
          url: URL.createObjectURL(f),
          takenAt: await readExifTime(f),
        })),
      );
      parsed.push(...res);
    }
    parsed.sort((a, b) => a.takenAt - b.takenAt);

    // Cluster
    const gap = CLUSTER_GAP_MIN * 60 * 1000;
    const groups: Cluster[] = [];
    for (const p of parsed) {
      const last = groups[groups.length - 1];
      if (!last || p.takenAt - last.photos[last.photos.length - 1].takenAt > gap) {
        groups.push({ id: `c${groups.length}`, photos: [p], eventId: null, hall: "" });
      } else {
        last.photos.push(p);
      }
    }

    // Auto-match event by year (best-effort; user can override)
    if (events.data) {
      for (const g of groups) {
        const yr = new Date(g.photos[0].takenAt).getFullYear();
        const hit = events.data.find((e) => e.year === yr);
        if (hit) g.eventId = hit.id;
      }
    }

    setPhotos(parsed);
    setClusters(groups);
    setScanning(false);
    toast.success(`已识别 ${parsed.length} 张 · 分成 ${groups.length} 组`);
  }

  async function run() {
    if (!photos.length || processing) return;
    setProcessing(true);
    setDone(0);
    let ok = 0, fail = 0;

    // Flatten with cluster metadata
    const items = clusters.flatMap((c) =>
      c.photos.map((p) => ({ photo: p, eventId: c.eventId, hall: c.hall })),
    );

    const q = items.slice();
    async function worker() {
      while (q.length) {
        const item = q.shift();
        if (!item) return;
        try {
          const path = await uploadImage("photos", item.photo.file);
          await enqueueDraft({
            photo_url: path,
            photo_urls: [path],
            event_id: item.eventId ?? null,
            hall: item.hall || null,
            occurred_at: new Date(item.photo.takenAt).toISOString(),
            favorite: false,
            rating: 0,
            contacts: [],
            tags: [],
          });
          ok++;
        } catch { fail++; }
        finally { setDone((d) => d + 1); }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    setProcessing(false);
    void flushDrafts();
    toast[fail ? "warning" : "success"](`已入队 ${ok}${fail ? ` · 失败 ${fail}` : ""} 张`);
    navigate({ to: "/records", search: { quick: "no_meta" } });
  }

  const total = photos.length;

  return (
    <AppShell title="批量导入" onBack={() => history.back()} hideTabs>
      <div className="pb-24">
        <div className="rounded-3xl border border-dashed border-divider p-6 text-center">
          <Images className="mx-auto h-9 w-9 text-muted-foreground" strokeWidth={1.4} />
          <p className="display-title mt-3 text-[24px]">Smart Batch</p>
          <p className="mt-2 text-xs text-muted-foreground">
            按拍摄时间自动分组，识别对应展会，一次导入。
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const list = e.target.files ? Array.from(e.target.files) : [];
              e.target.value = "";
              void onPick(list);
            }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={processing || scanning}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-xs font-semibold tracking-wider uppercase text-background active:scale-[0.98] disabled:opacity-60"
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" strokeWidth={1.6} />}
            {scanning ? "读取 EXIF…" : total ? `已选 ${total} 张 · 重新选` : "从相册多选"}
          </button>
        </div>

        {clusters.length > 0 && (
          <>
            <div className="mt-6 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent-brand" strokeWidth={1.6} />
              <p className="eyebrow">{clusters.length} 组 · 按拍摄时间</p>
            </div>

            <ul className="mt-3 space-y-4">
              {clusters.map((c, ci) => {
                const first = c.photos[0].takenAt;
                const last = c.photos[c.photos.length - 1].takenAt;
                const selectedEv = events.data?.find((e) => e.id === c.eventId);
                const halls = (selectedEv?.halls ?? []) as string[];
                return (
                  <li key={c.id} className="rounded-3xl border border-divider bg-card p-4">
                    <div className="flex items-center justify-between">
                      <p className="display-title text-[16px]">组 {ci + 1} · {c.photos.length} 张</p>
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" strokeWidth={1.5} /> {fmtRange(first, last)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-6 gap-1">
                      {c.photos.slice(0, 12).map((p, i) => (
                        <img key={i} src={p.url} alt="" className="aspect-square w-full rounded-md object-cover" />
                      ))}
                      {c.photos.length > 12 && (
                        <div className="flex aspect-square items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                          +{c.photos.length - 12}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <select
                        value={c.eventId ?? ""}
                        onChange={(e) => setClusters((s) => s.map((x) => x.id === c.id ? { ...x, eventId: e.target.value || null, hall: "" } : x))}
                        className="h-9 rounded-xl border border-divider bg-background px-2 text-xs"
                      >
                        <option value="">未指定展会</option>
                        {events.data?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                      <select
                        value={c.hall}
                        onChange={(e) => setClusters((s) => s.map((x) => x.id === c.id ? { ...x, hall: e.target.value } : x))}
                        disabled={halls.length === 0}
                        className="h-9 rounded-xl border border-divider bg-background px-2 text-xs disabled:opacity-40"
                      >
                        <option value="">{halls.length ? "选择展馆" : "无展馆信息"}</option>
                        {halls.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </li>
                );
              })}
            </ul>

            <button
              onClick={run}
              disabled={processing}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:opacity-60"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  上传中 {done} / {total}
                </>
              ) : (
                `开始导入 ${total} 张 · ${clusters.length} 组`
              )}
            </button>
          </>
        )}
      </div>
    </AppShell>
  );
}
