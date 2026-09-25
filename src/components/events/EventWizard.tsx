import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Plus, Sparkles, X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { uploadImage, getSignedUrl, readAsDataUrl } from "@/lib/storage";
import { analyzeMap } from "@/lib/ai.functions";
import { upsertEvent } from "@/lib/records.functions";
import { matchPreset } from "@/lib/venue-presets";
import { StorageImage } from "@/components/StorageImage";

export type EventDraft = {
  id?: string;
  name: string;
  year: number | null;
  city: string;
  venue: string;
  halls: string[];
  map_image_url: string | null;
  map_extra_urls: string[];
};

const emptyDraft: EventDraft = {
  name: "",
  year: new Date().getFullYear(),
  city: "",
  venue: "",
  halls: [],
  map_image_url: null,
  map_extra_urls: [],
};

const steps = ["基本信息", "地图上传", "识别 & 展馆"] as const;

export function EventWizard({ initial }: { initial?: EventDraft }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<EventDraft>(initial ?? emptyDraft);
  const upsertFn = useServerFn(upsertEvent);
  const analyzeFn = useServerFn(analyzeMap);
  const [analyzing, setAnalyzing] = useState(false);

  const update = (p: Partial<EventDraft>) => setDraft((d) => ({ ...d, ...p }));
  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const save = useMutation({
    mutationFn: async () => {
      const r = await upsertFn({
        data: {
          id: draft.id,
          name: draft.name.trim() || "未命名展会",
          year: draft.year ?? null,
          city: draft.city || null,
          venue: draft.venue || null,
          halls: Array.from(new Set(draft.halls.map((h) => h.trim()).filter(Boolean))),
          map_image_url: draft.map_image_url,
          map_extra_urls: draft.map_extra_urls,
        },
      });
      return r.id;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success(draft.id ? "已更新" : "展会已创建");
      navigate({ to: "/events" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "保存失败"),
  });

  async function runAnalyze() {
    const paths = [draft.map_image_url, ...draft.map_extra_urls].filter(Boolean) as string[];
    if (!paths.length) {
      toast.error("请先上传至少一张地图");
      return;
    }
    setAnalyzing(true);
    try {
      const dataUrls = await Promise.all(
        paths.map(async (p) => {
          const url = await getSignedUrl("maps", p);
          const blob = await (await fetch(url)).blob();
          return readAsDataUrl(blob);
        }),
      );
      const r = await analyzeFn({ data: { imageDataUrls: dataUrls } });
      const preset = matchPreset({ venue: r.venue, event: r.event_guess, halls: r.halls });
      const patch: Partial<EventDraft> = {};
      if (!draft.venue) patch.venue = r.venue || preset?.venue || "";
      if (!draft.name.trim()) patch.name = r.event_guess || preset?.event || "";
      const merged = Array.from(new Set([...draft.halls, ...r.halls]));
      patch.halls = merged;
      update(patch);
      toast.success(`识别到 ${r.halls.length} 个展馆`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "识别失败");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="pb-32">
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{step + 1} / {steps.length}</span>
          <span>{steps[step]}</span>
        </div>
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>
          {step === 0 && <StepBasic draft={draft} update={update} />}
          {step === 1 && <StepMaps draft={draft} update={update} />}
          {step === 2 && <StepHalls draft={draft} update={update} analyzing={analyzing} onAnalyze={runAnalyze} />}
        </motion.div>
      </AnimatePresence>

      <div className="fixed inset-x-0 bottom-0 z-40 glass border-t border-border safe-bottom">
        <div className="mx-auto flex max-w-md gap-2 p-3">
          <button onClick={prev} disabled={step === 0} className="flex h-12 flex-1 items-center justify-center gap-1 rounded-2xl border border-input font-medium disabled:opacity-40 active:scale-[0.98]">
            <ChevronLeft className="h-5 w-5" />上一步
          </button>
          {step < steps.length - 1 ? (
            <button onClick={next} className="flex h-12 flex-[1.5] items-center justify-center gap-1 rounded-2xl bg-primary font-medium text-primary-foreground active:scale-[0.98]">
              下一步 <ChevronRight className="h-5 w-5" />
            </button>
          ) : (
            <button onClick={() => save.mutate()} disabled={save.isPending} className="flex h-12 flex-[1.5] items-center justify-center gap-2 rounded-2xl bg-primary font-medium text-primary-foreground active:scale-[0.98] disabled:opacity-60">
              {save.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "保存展会"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepBasic({ draft, update }: { draft: EventDraft; update: (p: Partial<EventDraft>) => void }) {
  return (
    <section>
      <h2 className="text-xl font-bold">基本信息</h2>
      <p className="mt-1 text-sm text-muted-foreground">先起个名字，剩下的可以先跳过。</p>
      <div className="mt-4 space-y-3">
        <Field label="展会名称"><input value={draft.name} onChange={(e) => update({ name: e.target.value })} className={inputCls} placeholder="如 BW2026 / CP31 / CJ2026" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="年份"><input type="number" value={draft.year ?? ""} onChange={(e) => update({ year: e.target.value ? Number(e.target.value) : null })} className={inputCls} /></Field>
          <Field label="城市"><input value={draft.city} onChange={(e) => update({ city: e.target.value })} className={inputCls} placeholder="上海 / 广州…" /></Field>
        </div>
        <Field label="场馆"><input value={draft.venue} onChange={(e) => update({ venue: e.target.value })} className={inputCls} placeholder="上海国家会展中心" /></Field>
      </div>
    </section>
  );
}

function StepMaps({ draft, update }: { draft: EventDraft; update: (p: Partial<EventDraft>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function pick(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    try {
      const paths = await Promise.all(files.map((f) => uploadImage("maps", f)));
      if (!draft.map_image_url) {
        update({ map_image_url: paths[0], map_extra_urls: [...draft.map_extra_urls, ...paths.slice(1)] });
      } else {
        update({ map_extra_urls: [...draft.map_extra_urls, ...paths] });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "上传失败");
    } finally { setUploading(false); }
  }

  return (
    <section>
      <h2 className="text-xl font-bold">上传地图</h2>
      <p className="mt-1 text-sm text-muted-foreground">第一张作为总图，其余作为各展馆细图（可多选）。</p>

      {draft.map_image_url ? (
        <div className="mt-4 space-y-2">
          <div className="relative overflow-hidden rounded-3xl border border-border">
            <StorageImage bucket="maps" path={draft.map_image_url} className="w-full" />
            <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">总图</span>
            <button onClick={() => update({ map_image_url: draft.map_extra_urls[0] ?? null, map_extra_urls: draft.map_extra_urls.slice(1) })} className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex aspect-video items-center justify-center rounded-3xl border-2 border-dashed border-border">
          {uploading ? <Loader2 className="h-8 w-8 animate-spin" /> : <p className="text-sm text-muted-foreground">还没有地图</p>}
        </div>
      )}

      {draft.map_extra_urls.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs text-muted-foreground">细图 · {draft.map_extra_urls.length} 张</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {draft.map_extra_urls.map((p) => (
              <div key={p} className="relative shrink-0">
                <StorageImage bucket="maps" path={p} className="h-20 w-20 rounded-xl border border-border" />
                <button onClick={() => update({ map_extra_urls: draft.map_extra_urls.filter((x) => x !== p) })} className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 shadow">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
        const list = e.target.files ? Array.from(e.target.files) : [];
        if (list.length) pick(list);
        e.target.value = "";
      }} />
      <button onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border font-medium active:scale-[0.98] disabled:opacity-50">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {draft.map_image_url ? "添加细图" : "上传地图（可多选）"}
      </button>
    </section>
  );
}

function StepHalls({ draft, update, analyzing, onAnalyze }: { draft: EventDraft; update: (p: Partial<EventDraft>) => void; analyzing: boolean; onAnalyze: () => void }) {
  const [input, setInput] = useState("");
  const totalMaps = (draft.map_image_url ? 1 : 0) + draft.map_extra_urls.length;

  function addHall(name: string) {
    const v = name.trim();
    if (!v) return;
    if (draft.halls.includes(v)) return;
    update({ halls: [...draft.halls, v] });
    setInput("");
  }

  return (
    <section>
      <h2 className="text-xl font-bold">展馆列表</h2>
      <p className="mt-1 text-sm text-muted-foreground">AI 会读所有地图并列出展馆；你也可以手动增删。</p>

      <button onClick={onAnalyze} disabled={!totalMaps || analyzing} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-foreground font-medium text-background active:scale-[0.98] disabled:opacity-50">
        {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {analyzing ? "识别中…" : `AI 识别（${totalMaps} 张）`}
      </button>

      <div className="mt-5">
        <label className="text-xs font-medium text-muted-foreground">展馆列表（{draft.halls.length}）</label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {draft.halls.map((h) => (
            <span key={h} className="inline-flex items-center gap-1 rounded-full border border-foreground/80 bg-foreground px-2.5 py-1 text-xs text-background">
              <Check className="h-3 w-3" />{h}
              <button onClick={() => update({ halls: draft.halls.filter((x) => x !== h) })} className="ml-1 opacity-70 hover:opacity-100"><X className="h-3 w-3" /></button>
            </span>
          ))}
          {draft.halls.length === 0 && <p className="text-xs text-muted-foreground">还没有展馆</p>}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHall(input))} className={`${inputCls} flex-1`} placeholder="手动添加，如 6.1H" />
        <button onClick={() => addHall(input)} className="h-11 rounded-2xl bg-primary px-4 font-medium text-primary-foreground">加</button>
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
