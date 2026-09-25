import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage, getSignedUrl, readAsDataUrl } from "@/lib/storage";
import { readCaptureTime } from "@/lib/exif";
import { analyzePhoto } from "@/lib/ai.functions";
import { upsertRecord } from "@/lib/records.functions";
import { enqueue as enqueueDraft, flush as flushDrafts } from "@/lib/draft-queue";
import { StarRating } from "@/components/StarRating";
import { InteractionChips } from "@/components/records/InteractionChips";
import { VoiceNoteButton } from "@/components/records/VoiceNoteButton";
import { contactPlatforms, type ContactPlatform } from "@/lib/schemas";
import { Camera, Loader2, Sparkles, X, ChevronLeft, ChevronRight, Plus, Heart, MapPin, Check, ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { StorageImage } from "@/components/StorageImage";
import { Link } from "@tanstack/react-router";


type Contact = { platform: string; handle: string };
export type RecordDraft = {
  id?: string;
  photo_url: string | null;
  photo_urls: string[];
  teacher_name: string;
  character_name: string;
  anime_name: string;
  hall: string;
  booth: string;
  event_id: string | null;
  new_event_name: string;
  marker_x: number | null;
  marker_y: number | null;
  note: string;
  favorite: boolean;
  rating: number;
  interactions: string[];
  contacts: Contact[];
  tags: string[];
  occurred_at: string; // ISO string
};

const emptyDraft: RecordDraft = {
  photo_url: null, photo_urls: [], teacher_name: "", character_name: "", anime_name: "", hall: "", booth: "",
  event_id: null, new_event_name: "", marker_x: null, marker_y: null,
  note: "", favorite: false, rating: 0, interactions: [], contacts: [], tags: [],
  occurred_at: new Date().toISOString(),
};


const stepTitles = ["照片", "角色识别", "老师 & 联系", "展会 & 展馆", "完成"] as const;

type EventRow = {
  id: string;
  name: string;
  year: number | null;
  city: string | null;
  venue: string | null;
  halls: string[];
  map_image_url: string | null;
};

export function RecordForm({ initial }: { initial?: RecordDraft }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<RecordDraft>(initial ?? emptyDraft);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const upsertFn = useServerFn(upsertRecord);
  const analyzeFn = useServerFn(analyzePhoto);

  const events = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, name, year, city, venue, halls, map_image_url").order("created_at", { ascending: false });
      return (data ?? []) as EventRow[];
    },
  });

  // history halls (across all user's records) for quick-pick
  const historyHalls = useQuery({
    queryKey: ["hall-history"],
    queryFn: async () => {
      const { data } = await supabase.from("records").select("hall").not("hall", "is", null).order("occurred_at", { ascending: false }).limit(60);
      const seen = new Set<string>();
      const out: string[] = [];
      for (const r of data ?? []) {
        const h = (r.hall ?? "").trim();
        if (h && !seen.has(h)) { seen.add(h); out.push(h); if (out.length >= 6) break; }
      }
      return out;
    },
  });

  const update = (patch: Partial<RecordDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const next = () => setStep((s) => Math.min(s + 1, stepTitles.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  async function handlePhotoPick(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    try {
      // Prefer the earliest capture time among newly-added photos, so occurred_at
      // reflects when the photo was actually taken instead of when the user opens the form.
      const captureTimes = await Promise.all(files.map((f) => readCaptureTime(f)));
      const earliest = captureTimes
        .filter((d): d is Date => !!d)
        .sort((a, b) => a.getTime() - b.getTime())[0];

      const paths = await Promise.all(files.map((f) => uploadImage("photos", f)));
      const nextUrls = [...draft.photo_urls, ...paths];
      const patch: Partial<RecordDraft> = {
        photo_urls: nextUrls,
        photo_url: draft.photo_url ?? nextUrls[0],
      };
      // Only auto-fill occurred_at on the first photo(s), so we don't clobber a user edit.
      if (earliest && draft.photo_urls.length === 0) {
        patch.occurred_at = earliest.toISOString();
      }
      update(patch);
      toast.success(`已添加 ${paths.length} 张`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "上传失败");
    } finally { setUploading(false); }
  }

  async function runAiAnalyze() {
    if (!draft.photo_url) return;
    setAnalyzing(true);
    try {
      const url = await getSignedUrl("photos", draft.photo_url);
      const blob = await (await fetch(url)).blob();
      const dataUrl = await readAsDataUrl(blob);
      const result = await analyzeFn({ data: { imageDataUrl: dataUrl } });
      update({
        character_name: draft.character_name || result.character,
        anime_name: draft.anime_name || result.anime,
        tags: Array.from(new Set([...draft.tags, ...result.tags])),
        note: draft.note || (result.notes || result.outfit),
      });
      toast.success(`识别完成 · ${(result.confidence * 100).toFixed(0)}%`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI 识别失败");
    } finally { setAnalyzing(false); }
  }

  const save = useMutation({
    mutationFn: async (opts?: { quick?: boolean }) => {
      const payload = {
        id: draft.id,
        event_id: draft.event_id,
        photo_url: draft.photo_url,
        photo_urls: draft.photo_urls,
        teacher_name: draft.teacher_name || null,
        character_name: draft.character_name || null,
        anime_name: draft.anime_name || null,
        hall: draft.hall || null,
        booth: draft.booth || null,
        marker_x: draft.marker_x,
        marker_y: draft.marker_y,
        note: draft.note || null,
        favorite: draft.favorite,
        rating: draft.rating,
        interactions: draft.interactions,
        contacts: draft.contacts.filter((c) => c.handle.trim()),
        tags: draft.tags,
        occurred_at: draft.occurred_at,
      };

      const quick = !!opts?.quick;
      // Existing records: upsert directly so we can navigate back to detail.
      if (draft.id) {
        const r = await upsertFn({ data: payload });
        return { id: r.id, quick, queued: false as const };
      }
      // New records: enqueue → fire-and-forget flush. Survives offline / flaky wifi.
      await enqueueDraft(payload, { quick });
      void flushDrafts();
      return { id: null, quick, queued: true as const };
    },
    onSuccess: ({ id, quick, queued }) => {
      qc.invalidateQueries();
      const continueAction = draft.event_id
        ? {
            label: "继续拍下一位",
            onClick: () =>
              navigate({
                to: "/records/new",
                search: { event: draft.event_id!, hall: draft.hall || undefined },
              }),
          }
        : undefined;
      if (queued) {
        toast.success("已入队 · 联网后自动上传", { action: continueAction });
        navigate({ to: "/records", search: quick ? { quick: "no_meta" } : {} });
      } else {
        toast.success("已保存", { action: continueAction });
        if (id) navigate({ to: "/records/$id", params: { id } });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "保存失败"),
  });


  return (
    <div className="pb-32">
      {/* Progress */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{step + 1} / {stepTitles.length}</span>
          <span className="font-medium text-foreground">{stepTitles[step]}</span>
        </div>
        <div className="flex gap-1">
          {stepTitles.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>
          {step === 0 && (
            <StepPhoto draft={draft} uploading={uploading} onPick={handlePhotoPick} onChange={update} />
          )}
          {step === 1 && (
            <StepAI analyzing={analyzing} photoPath={draft.photo_url} draft={draft} onAnalyze={runAiAnalyze} onChange={update} isEdit={!!draft.id} />
          )}
          {step === 2 && <StepTeacher draft={draft} onChange={update} />}
          {step === 3 && <StepEventHall draft={draft} events={events.data ?? []} historyHalls={historyHalls.data ?? []} onChange={update} />}
          {step === 4 && <StepFinish draft={draft} events={events.data ?? []} onChange={update} />}
        </motion.div>
      </AnimatePresence>

      {/* Nav */}
      <div className="fixed inset-x-0 bottom-0 z-40 glass border-t border-border safe-bottom">
        <div className="mx-auto flex max-w-md gap-2 p-3">
          <button onClick={prev} disabled={step === 0} className="flex h-12 flex-1 items-center justify-center gap-1 rounded-2xl border border-input font-medium disabled:opacity-40 active:scale-[0.98]">
            <ChevronLeft className="h-5 w-5" />上一步
          </button>
          {step === 0 && (draft.photo_url || draft.photo_urls.length > 0) && !draft.id && (
            <button
              onClick={() => save.mutate({ quick: true })}
              disabled={save.isPending || uploading}
              className="flex h-12 flex-1 items-center justify-center gap-1 rounded-2xl border border-primary/40 bg-primary/10 text-sm font-medium text-primary active:scale-[0.98] disabled:opacity-50"
              title="只存照片，稍后整理"
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "存草稿"}
            </button>
          )}
          {step < stepTitles.length - 1 ? (
            <button onClick={next} className="flex h-12 flex-[1.5] items-center justify-center gap-1 rounded-2xl bg-primary font-medium text-primary-foreground active:scale-[0.98]">
              下一步 <ChevronRight className="h-5 w-5" />
            </button>
          ) : (
            <button onClick={() => save.mutate({ quick: false })} disabled={save.isPending}
              className="flex h-12 flex-[1.5] items-center justify-center gap-2 rounded-2xl bg-primary font-medium text-primary-foreground active:scale-[0.98] disabled:opacity-60">
              {save.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "保存记录"}
            </button>
          )}
        </div>
      </div>

    </div>
  );
}

/* ---------- Step 0: Photo ---------- */

function StepPhoto({ draft, uploading, onPick, onChange }: { draft: RecordDraft; uploading: boolean; onPick: (f: File[]) => void; onChange: (p: Partial<RecordDraft>) => void }) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  function removeAt(i: number) {
    const list = draft.photo_urls.slice();
    const removed = list.splice(i, 1)[0];
    onChange({
      photo_urls: list,
      photo_url: draft.photo_url === removed ? (list[0] ?? null) : draft.photo_url,
    });
  }

  function move(i: number, dir: -1 | 1) {
    const list = draft.photo_urls.slice();
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    onChange({ photo_urls: list, photo_url: list[0] ?? null });
  }

  const cover = draft.photo_url ?? draft.photo_urls[0] ?? null;

  return (
    <section>
      <h2 className="text-xl font-bold">照片</h2>
      <p className="mt-1 text-sm text-muted-foreground">可以一次多选，第一张为封面（可换）。</p>

      {cover ? (
        <div className="relative mt-4">
          <StorageImage bucket="photos" path={cover} className="aspect-[4/5] w-full rounded-3xl" />
          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">封面</span>
        </div>
      ) : (
        <div className="mt-4 flex aspect-[4/5] w-full items-center justify-center rounded-3xl border-2 border-dashed border-border bg-muted/30">
          {uploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Camera className="h-10 w-10 text-muted-foreground" />}
        </div>
      )}

      {draft.photo_urls.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs text-muted-foreground">共 {draft.photo_urls.length} 张 · 点击设为封面</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {draft.photo_urls.map((p, i) => {
              const isCover = draft.photo_url === p;
              return (
                <div key={p} className="relative shrink-0">
                  <button
                    onClick={() => onChange({ photo_url: p })}
                    className={`overflow-hidden rounded-xl border-2 ${isCover ? "border-primary" : "border-transparent"}`}
                  >
                    <StorageImage bucket="photos" path={p} className="h-20 w-20" />
                  </button>
                  <div className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
                    <button onClick={() => move(i, -1)} className="rounded-full bg-background p-0.5 shadow" aria-label="前移"><ArrowLeft className="h-3 w-3" /></button>
                    <button onClick={() => move(i, 1)} className="rounded-full bg-background p-0.5 shadow" aria-label="后移"><ArrowRight className="h-3 w-3" /></button>
                  </div>
                  <button onClick={() => removeAt(i)} className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 shadow" aria-label="移除">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const list = e.target.files ? Array.from(e.target.files) : []; if (list.length) onPick(list); e.target.value = ""; }} />
      <input ref={galRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { const list = e.target.files ? Array.from(e.target.files) : []; if (list.length) onPick(list); e.target.value = ""; }} />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={() => camRef.current?.click()} className="h-12 rounded-2xl bg-primary font-medium text-primary-foreground active:scale-[0.98]">拍照</button>
        <button onClick={() => galRef.current?.click()} className="h-12 rounded-2xl border border-input font-medium active:scale-[0.98]">从相册（多选）</button>
      </div>
    </section>
  );
}

/* ---------- Step 1: AI + role ---------- */

function StepAI({ analyzing, photoPath, draft, onAnalyze, onChange, isEdit }: { analyzing: boolean; photoPath: string | null; draft: RecordDraft; onAnalyze: () => void; onChange: (p: Partial<RecordDraft>) => void; isEdit?: boolean }) {
  useEffect(() => { if (!isEdit && photoPath && !draft.character_name && !analyzing) onAnalyze(); /* eslint-disable-next-line */ }, []);

  return (
    <section>
      <h2 className="text-xl font-bold">角色识别</h2>
      <p className="mt-1 text-sm text-muted-foreground">AI 识别封面照的角色与作品，可自行修改。</p>
      <button onClick={onAnalyze} disabled={!photoPath || analyzing}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary/10 font-medium text-primary active:scale-[0.98] disabled:opacity-50">
        {analyzing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
        {analyzing ? "识别中…" : isEdit ? "重新识别（消耗 AI）" : "重新识别"}
      </button>
      <div className="mt-4 space-y-3">
        <Field label="角色"><input value={draft.character_name} onChange={(e) => onChange({ character_name: e.target.value })} className={inputCls} /></Field>
        <Field label="所属作品"><input value={draft.anime_name} onChange={(e) => onChange({ anime_name: e.target.value })} className={inputCls} /></Field>
      </div>
    </section>
  );
}

/* ---------- Step 2: Teacher + Contacts (chip style + smart paste) ---------- */

const PLATFORM_RULES: { platform: ContactPlatform; test: RegExp; extract?: (s: string) => string }[] = [
  { platform: "抖音", test: /(douyin\.com|v\.douyin\.com|iesdouyin\.com)/i, extract: (s) => s.match(/@[\w.\-]+/)?.[0] ?? s },
  { platform: "小红书", test: /(xiaohongshu\.com|xhslink\.com)/i },
  { platform: "微博", test: /(weibo\.com|weibo\.cn|m\.weibo\.cn)/i, extract: (s) => s.match(/@[\w.\-]+/)?.[0] ?? s },
  { platform: "B站", test: /(bilibili\.com|b23\.tv)/i },
  { platform: "X", test: /(x\.com|twitter\.com)/i, extract: (s) => s.match(/@?[\w]+/)?.[0]?.replace(/^@?/, "@") ?? s },
  { platform: "Instagram", test: /instagram\.com/i, extract: (s) => s.match(/instagram\.com\/([\w.\-]+)/i)?.[1] ? "@" + s.match(/instagram\.com\/([\w.\-]+)/i)![1] : s },
  { platform: "邮箱", test: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  { platform: "QQ", test: /^\d{5,12}$/ },
];

function detectPlatform(text: string): { platform: ContactPlatform; handle: string } | null {
  const trimmed = text.trim();
  for (const rule of PLATFORM_RULES) {
    if (rule.test.test(trimmed)) {
      return { platform: rule.platform, handle: rule.extract ? rule.extract(trimmed) : trimmed };
    }
  }
  return null;
}

function StepTeacher({ draft, onChange }: { draft: RecordDraft; onChange: (p: Partial<RecordDraft>) => void }) {
  function updateContact(i: number, patch: Partial<Contact>) {
    const list = draft.contacts.slice(); list[i] = { ...list[i], ...patch };
    onChange({ contacts: list });
  }
  function addContact(platform: string = "微博") {
    onChange({ contacts: [...draft.contacts, { platform, handle: "" }] });
  }
  function handleSmartPaste(i: number, text: string) {
    const detected = detectPlatform(text);
    if (detected) {
      updateContact(i, { platform: detected.platform, handle: detected.handle });
      toast.success(`识别为 ${detected.platform}`);
    } else {
      updateContact(i, { handle: text });
    }
  }

  return (
    <section>
      <h2 className="text-xl font-bold">老师 & 联系方式</h2>
      <p className="mt-1 text-sm text-muted-foreground">粘贴链接会自动识别平台。</p>

      <div className="mt-4 space-y-4">
        <Field label="老师昵称"><input value={draft.teacher_name} onChange={(e) => onChange({ teacher_name: e.target.value })} className={inputCls} placeholder="如：小葵老师" /></Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">联系方式</label>
            <button onClick={() => addContact()} className="flex items-center gap-1 text-xs font-medium text-primary">
              <Plus className="h-3.5 w-3.5" />添加
            </button>
          </div>

          <div className="space-y-3">
            {draft.contacts.map((c, i) => (
              <div key={i} className="rounded-2xl border border-border bg-muted/30 p-3">
                {/* platform chip row */}
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2">
                  {contactPlatforms.map((p) => {
                    const active = c.platform === p;
                    return (
                      <button
                        key={p}
                        onClick={() => updateContact(i, { platform: p })}
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${active ? "bg-primary text-primary-foreground" : "bg-background text-foreground/70 border border-border"}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
                {/* handle + delete */}
                <div className="flex items-center gap-2">
                  <input
                    value={c.handle}
                    onChange={(e) => updateContact(i, { handle: e.target.value })}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (text && (text.includes("http") || text.startsWith("@"))) {
                        e.preventDefault();
                        handleSmartPaste(i, text);
                      }
                    }}
                    className={`${inputCls} flex-1`}
                    placeholder="账号 / 链接 / @昵称"
                  />
                  <button onClick={() => onChange({ contacts: draft.contacts.filter((_, k) => k !== i) })} className="rounded-full p-2 text-muted-foreground active:scale-95">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {draft.contacts.length === 0 && (
              <div className="flex flex-wrap gap-1.5">
                <p className="w-full text-xs text-muted-foreground">快速添加：</p>
                {(["抖音", "微博", "小红书", "B站"] as const).map((p) => (
                  <button key={p} onClick={() => addContact(p)} className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">+ {p}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Step 3: Event + Hall (big button grid) ---------- */

function StepEventHall({ draft, events, historyHalls, onChange }: { draft: RecordDraft; events: EventRow[]; historyHalls: string[]; onChange: (p: Partial<RecordDraft>) => void }) {
  const currentEvent = events.find((e) => e.id === draft.event_id) ?? null;
  const mapPath = currentEvent?.map_image_url ?? null;
  const [showMap, setShowMap] = useState(false);

  function handleTap(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onChange({ marker_x: x, marker_y: y });
  }

  if (events.length === 0) {
    return (
      <section>
        <h2 className="text-xl font-bold">展会 & 展馆</h2>
        <p className="mt-1 text-sm text-muted-foreground">你还没有创建过展会。先建一次，之后所有老师都能直接选。</p>
        <Link to="/events/new" className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-medium text-primary-foreground active:scale-[0.98]">
          <Plus className="h-5 w-5" />去创建展会
        </Link>
        <p className="mt-3 text-xs text-muted-foreground">你也可以先跳过，稍后再补上。</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-xl font-bold">展会 & 展馆</h2>
      <p className="mt-1 text-sm text-muted-foreground">选展会 → 在该展会的展馆中一键选中。</p>

      {/* Event chip row */}
      <div className="mt-4">
        <label className="text-xs font-medium text-muted-foreground">展会</label>
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          <Link to="/events/new" className="flex h-10 shrink-0 items-center gap-1 rounded-full border border-dashed border-primary/50 bg-primary/5 px-3 text-sm font-medium text-primary">
            <Plus className="h-4 w-4" />新建
          </Link>
          {events.map((e) => {
            const active = draft.event_id === e.id;
            return (
              <button key={e.id} onClick={() => onChange({ event_id: e.id, hall: "", marker_x: null, marker_y: null })}
                className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground/80"}`}>
                {active && <Check className="h-3.5 w-3.5" />}{e.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hall grid */}
      {currentEvent && (
        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <label className="text-xs font-medium text-muted-foreground">展馆（{currentEvent.halls.length}）</label>
            {currentEvent.halls.length === 0 && (
              <Link to="/events/$id/edit" params={{ id: currentEvent.id }} className="text-xs font-medium text-primary">
                去补充展馆
              </Link>
            )}
          </div>

          {currentEvent.halls.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {currentEvent.halls.map((h) => {
                const active = draft.hall === h;
                return (
                  <button key={h} onClick={() => onChange({ hall: h })}
                    className={`flex h-14 items-center justify-center rounded-2xl text-base font-semibold transition ${active ? "bg-foreground text-background shadow-lg" : "border border-border bg-card text-foreground/80 hover:border-foreground/40"}`}>
                    {h}
                  </button>
                );
              })}
            </div>
          )}

          {/* History halls quick-pick */}
          {historyHalls.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] text-muted-foreground">最近用过</p>
              <div className="flex flex-wrap gap-1.5">
                {historyHalls.filter((h) => !currentEvent.halls.includes(h)).map((h) => (
                  <button key={h} onClick={() => onChange({ hall: h })}
                    className={`rounded-full px-3 py-1 text-xs ${draft.hall === h ? "bg-foreground text-background" : "bg-secondary"}`}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Booth number + manual hall */}
          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <input
              value={draft.hall}
              onChange={(e) => onChange({ hall: e.target.value })}
              className={inputCls}
              placeholder="展馆（如 6.1H）"
            />
            <input
              value={draft.booth}
              onChange={(e) => onChange({ booth: e.target.value })}
              className={inputCls + " w-24 text-center tabular"}
              placeholder="摊位"
              maxLength={16}
            />
          </div>



          {mapPath && (
            <div className="mt-4">
              <button onClick={() => setShowMap((s) => !s)} className="flex w-full items-center justify-between rounded-2xl border border-border px-3 py-2.5 text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />在地图上标记（可选）</span>
                <ChevronDown className={`h-3.5 w-3.5 transition ${showMap ? "rotate-180" : ""}`} />
              </button>
              {showMap && (
                <div className="relative mt-2 overflow-hidden rounded-3xl border border-border" onClick={handleTap}>
                  <StorageImage bucket="maps" path={mapPath} className="w-full" />
                  {draft.marker_x != null && draft.marker_y != null && (
                    <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${draft.marker_x * 100}%`, top: `${draft.marker_y * 100}%` }}>
                      <MapPin className="h-7 w-7 fill-foreground text-background drop-shadow" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------- Step 4: Finish (note + tags + rating + review) ---------- */

function StepFinish({ draft, events, onChange }: { draft: RecordDraft; events: EventRow[]; onChange: (p: Partial<RecordDraft>) => void }) {
  const [tagInput, setTagInput] = useState("");
  const suggestions = ["原神", "崩铁", "LOL", "鸣潮", "妮姬", "Hololive", "碧蓝", "FGO"];
  const eventName = draft.event_id ? events.find((e) => e.id === draft.event_id)?.name : "";

  function addTag(t: string) {
    const name = t.trim(); if (!name) return;
    if (!draft.tags.includes(name)) onChange({ tags: [...draft.tags, name] });
    setTagInput("");
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">完成</h2>
        <p className="mt-1 text-sm text-muted-foreground">补上备注、标签、评分，就完成啦。</p>
      </div>
      {/* Occurred date + time */}
      <OccurredAtEditor value={draft.occurred_at} onChange={(iso) => onChange({ occurred_at: iso })} />


      {/* Favorite + rating card */}
      <div className="flex items-center justify-between rounded-3xl border border-border/50 bg-card p-4">
        <button onClick={() => onChange({ favorite: !draft.favorite })} className="flex items-center gap-2 active:scale-95">
          <Heart className={`h-8 w-8 transition ${draft.favorite ? "fill-rose-500 text-rose-500" : "text-muted-foreground/50"}`} />
          <span className="text-sm font-medium">{draft.favorite ? "已收藏" : "收藏"}</span>
        </button>
        <StarRating value={draft.rating} onChange={(v) => onChange({ rating: v })} size={26} />
      </div>

      {/* Interaction badges */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">今天做了什么</label>
        <div className="mt-1.5">
          <InteractionChips
            value={draft.interactions}
            onChange={(next) => onChange({ interactions: next })}
          />
        </div>
      </div>

      {/* Note + voice */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">备注</label>
          <VoiceNoteButton
            onTranscribed={(text) => onChange({ note: draft.note ? draft.note + "\n" + text : text })}
          />
        </div>
        <textarea value={draft.note} onChange={(e) => onChange({ note: e.target.value })} rows={4}
          placeholder="聊了什么、老师特点、是否返图…"
          className="mt-1.5 w-full rounded-2xl border border-input bg-background p-3 text-sm outline-none focus:border-primary" />
      </div>


      {/* Tags */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">标签</label>
        <div className="mt-1.5 flex gap-2">
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag(tagInput))}
            className={inputCls + " flex-1"} placeholder="回车确认" />
          <button onClick={() => addTag(tagInput)} className="h-11 rounded-2xl bg-primary px-4 font-medium text-primary-foreground">加</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {draft.tags.map((t) => (
            <button key={t} onClick={() => onChange({ tags: draft.tags.filter((x) => x !== t) })}
              className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground">#{t} <X className="ml-1 inline h-3 w-3" /></button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.filter((s) => !draft.tags.includes(s)).map((s) => (
            <button key={s} onClick={() => addTag(s)} className="rounded-full bg-secondary px-3 py-1 text-xs">#{s}</button>
          ))}
        </div>
      </div>

      {/* Mini review */}
      <div className="rounded-2xl border border-border/50 bg-card/50 p-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>老师：<b className="text-foreground">{draft.teacher_name || "—"}</b></span>
          <span>角色：<b className="text-foreground">{draft.character_name || "—"}</b></span>
          <span>展会：<b className="text-foreground">{eventName || "—"}</b></span>
          <span>展馆：<b className="text-foreground">{draft.hall || "—"}</b></span>
          <span>照片：<b className="text-foreground">{draft.photo_urls.length || (draft.photo_url ? 1 : 0)} 张</b></span>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

const inputCls = "h-11 w-full rounded-2xl border border-input bg-background px-4 text-base outline-none focus:border-primary";

function toLocalDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function toLocalTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function mergeLocal(dateStr: string, timeStr: string): string {
  const [y, m, day] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const d = new Date(y, (m || 1) - 1, day || 1, hh || 0, mm || 0, 0, 0);
  return d.toISOString();
}

function OccurredAtEditor({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const dateStr = toLocalDate(value);
  const timeStr = toLocalTime(value);
  return (
    <div className="rounded-3xl border border-border/50 bg-card p-4">
      <div className="flex items-baseline justify-between">
        <label className="eyebrow">Occurred · 时间</label>
        <button
          type="button"
          onClick={() => onChange(new Date().toISOString())}
          className="text-[11px] tracking-wider uppercase text-muted-foreground hover:text-foreground transition"
        >
          现在
        </button>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <input
          type="date"
          value={dateStr}
          onChange={(e) => e.target.value && onChange(mergeLocal(e.target.value, timeStr))}
          className="h-11 rounded-2xl border border-input bg-background px-3 text-sm outline-none focus:border-primary tabular"
        />
        <input
          type="time"
          value={timeStr}
          onChange={(e) => e.target.value && onChange(mergeLocal(dateStr, e.target.value))}
          className="h-11 w-28 rounded-2xl border border-input bg-background px-3 text-sm outline-none focus:border-primary tabular"
        />
      </div>
    </div>
  );
}
