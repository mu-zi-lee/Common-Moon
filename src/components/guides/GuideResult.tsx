import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bookmark,
  Camera,
  Check,
  Flame,
  Landmark,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  addGuideItem,
  deleteGuide,
  personalizeGuide,
  toggleGuideItem,
  type GuideNarrative,
  type ParsedGuide,
} from "@/lib/guides.functions";


type Tab = "route" | "cosers" | "booths" | "tips";

type GuideRow = {
  id: string;
  title: string | null;
  event_id: string | null;
  parsed: ParsedGuide | null;
  personalized: GuideNarrative | null;
  status: string;
  error: string | null;
  created_at: string;
};

type ItemRow = {
  id: string;
  kind: string;
  payload: Record<string, unknown> | null;
  done: boolean;
  pinned: boolean;
};

export function GuideResult({ guideId }: { guideId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("route");
  const [running, setRunning] = useState(false);
  const personalizeFn = useServerFn(personalizeGuide);
  const addFn = useServerFn(addGuideItem);
  const toggleFn = useServerFn(toggleGuideItem);
  const delFn = useServerFn(deleteGuide);

  async function onDelete() {
    if (!confirm("删除这条攻略？此操作不可恢复。")) return;
    try {
      await delFn({ data: { id: guideId } });
      await qc.invalidateQueries({ queryKey: ["guides-list"] });
      toast.success("已删除");
      navigate({ to: "/guides" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  }


  const guide = useQuery({
    queryKey: ["guide", guideId],
    queryFn: async (): Promise<GuideRow> => {
      const { data, error } = await supabase
        .from("guides")
        .select("id, title, event_id, parsed, personalized, status, error, created_at")
        .eq("id", guideId)
        .single();
      if (error) throw error;
      return {
        ...data,
        parsed: data.parsed as unknown as ParsedGuide | null,
        personalized: data.personalized as unknown as GuideNarrative | null,
      };
    },
  });

  const items = useQuery({
    queryKey: ["guide-items", guideId],
    queryFn: async (): Promise<ItemRow[]> => {
      const { data } = await supabase
        .from("guide_items")
        .select("id, kind, payload, done, pinned")
        .eq("guide_id", guideId);
      return (data ?? []).map((r) => ({
        ...r,
        payload: r.payload as Record<string, unknown> | null,
      }));
    },
  });

  // Personal signals for matching
  const signals = useQuery({
    queryKey: ["guide-signals"],
    queryFn: async () => {
      const [subs, recs] = await Promise.all([
        supabase.from("subscriptions").select("kind, teacher_name").eq("kind", "teacher"),
        supabase.from("records").select("teacher_name").not("teacher_name", "is", null).limit(500),
      ]);
      const followed = new Set<string>();
      for (const s of subs.data ?? []) if (s.teacher_name) followed.add(s.teacher_name.trim());
      const past = new Set<string>();
      for (const r of recs.data ?? []) if (r.teacher_name) past.add(r.teacher_name.trim());
      return { followed, past };
    },
  });

  const parsed = guide.data?.parsed;

  const cosersScored = useMemo(() => {
    if (!parsed) return [];
    const followed = signals.data?.followed ?? new Set<string>();
    const past = signals.data?.past ?? new Set<string>();
    return parsed.cosers
      .map((c) => {
        const isFollowed = followed.has(c.name);
        const isPast = past.has(c.name);
        const score = (isFollowed ? 100 : 0) + (isPast ? 30 : 0);
        return { ...c, isFollowed, isPast, score };
      })
      .sort((a, b) => b.score - a.score);
  }, [parsed, signals.data]);

  const boothsScored = useMemo(() => {
    if (!parsed) return [];
    return parsed.booths
      .map((b) => {
        const score =
          (b.scarcity === "high" ? 60 : b.scarcity === "mid" ? 30 : 10) +
          b.freebies.length * 3 +
          b.guests.length * 5;
        return { ...b, score };
      })
      .sort((a, b) => b.score - a.score);
  }, [parsed]);

  const savedKeys = useMemo(() => {
    const s = new Set<string>();
    for (const it of items.data ?? []) {
      const p = it.payload ?? {};
      if (it.kind === "coser" && typeof p.name === "string") s.add(`coser:${p.name}`);
      if (it.kind === "booth" && typeof p.exhibitor === "string")
        s.add(`booth:${p.exhibitor}:${(p.hall as string) ?? ""}`);
    }
    return s;
  }, [items.data]);

  async function pin(
    kind: "booth" | "coser" | "tip",
    payload: Record<string, unknown>,
    key: string,
  ) {
    if (savedKeys.has(key)) {
      toast.info("已在行程中");
      return;
    }
    try {
      await addFn({ data: { guide_id: guideId, kind, payload: payload as unknown as Json } });
      await qc.invalidateQueries({ queryKey: ["guide-items", guideId] });
      toast.success("已加入行程");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "加入失败");
    }
  }

  async function markDone(id: string, done: boolean) {
    try {
      await toggleFn({ data: { id, done } });
      await qc.invalidateQueries({ queryKey: ["guide-items", guideId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新失败");
    }
  }

  async function runNarrative() {
    if (running) return;
    setRunning(true);
    try {
      await personalizeFn({ data: { guide_id: guideId } });
      await qc.invalidateQueries({ queryKey: ["guide", guideId] });
      toast.success("行程建议已生成");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成失败");
    } finally {
      setRunning(false);
    }
  }

  if (guide.isLoading || !guide.data) {
    return <div className="h-40 shimmer rounded-3xl" />;
  }

  const g = guide.data;

  if (g.status === "failed") {
    return (
      <div className="space-y-3">
        <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-medium">解析失败</p>
          <p className="mt-1 opacity-80">{g.error ?? "未知错误"}</p>
        </div>
        <button
          onClick={onDelete}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-destructive/40 text-sm text-destructive active:scale-[0.99]"
        >
          <Trash2 className="h-4 w-4" /> 删除这条攻略
        </button>
      </div>
    );
  }
  if (g.status === "parsing" || !parsed) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2 rounded-3xl bg-surface-1 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> AI 解析中…
        </div>
        <button
          onClick={onDelete}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-divider text-sm text-muted-foreground active:scale-[0.99]"
        >
          <Trash2 className="h-4 w-4" /> 取消并删除
        </button>
      </div>
    );
  }


  const narrative = g.personalized;
  const matchedCosers = cosersScored.filter((c) => c.isFollowed || c.isPast);
  const highBooths = boothsScored.filter((b) => b.scarcity === "high").length;

  return (
    <div className="space-y-5">
      {/* Meta card */}
      <div className="rounded-3xl border border-border/50 bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="eyebrow">AI Guide</p>
          <button
            onClick={onDelete}
            aria-label="删除攻略"
            className="-mt-1 rounded-full p-1.5 text-muted-foreground hover:text-destructive active:scale-95"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <h2 className="display-title mt-1 text-[24px] leading-snug">
          {g.title || parsed.meta.event_guess || "未命名攻略"}
        </h2>

        <p className="mt-1 text-xs text-muted-foreground">
          {[parsed.meta.event_guess, parsed.meta.date_range, parsed.meta.author]
            .filter(Boolean)
            .join(" · ") || "—"}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="展台" value={parsed.booths.length} />
          <Stat label="Coser" value={parsed.cosers.length} />
          <Stat label="⭐ 匹配" value={matchedCosers.length} accent />
        </div>
        {highBooths > 0 && (
          <p className="mt-3 flex items-center gap-1 text-xs text-orange-500">
            <Flame className="h-3.5 w-3.5" /> {highBooths} 个高稀缺无料，建议早排
          </p>
        )}
      </div>

      {/* AI narrative */}
      {narrative ? (
        <div className="rounded-3xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow text-primary">AI 行程建议</p>
            <button
              onClick={runNarrative}
              disabled={running}
              className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              {running ? <Loader2 className="inline h-3 w-3 animate-spin" /> : <RefreshCw className="inline h-3 w-3" />}{" "}
              重新生成
            </button>
          </div>
          <p className="mt-2 text-[15px] font-medium leading-snug">{narrative.headline}</p>
          {narrative.suggestions.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-foreground/85">
              {narrative.suggestions.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <button
          onClick={runNarrative}
          disabled={running}
          className="flex w-full items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-xs font-medium text-primary active:scale-[0.99] disabled:opacity-60"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          <span className="flex-1 text-left">
            {running ? "生成中…" : "结合我关注的老师，生成个性化行程建议"}
          </span>
        </button>
      )}

      {/* Tabs */}
      <div className="flex gap-5 border-b border-divider text-sm">
        {(
          [
            { k: "route" as const, label: "行程" },
            { k: "cosers" as const, label: `Coser (${cosersScored.length})` },
            { k: "booths" as const, label: `展台 (${boothsScored.length})` },
            { k: "tips" as const, label: "贴士" },
          ]
        ).map((t) => {
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`-mb-px border-b-2 pb-2.5 font-medium transition ${active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "route" && (
        <RouteTab
          narrative={narrative}
          items={items.data ?? []}
          onDone={markDone}
          guideEventId={g.event_id}
        />
      )}

      {tab === "cosers" && (
        <div className="space-y-2">
          {cosersScored.length === 0 && <EmptyBlock text="攻略里没抓到 coser" />}
          {cosersScored.map((c) => {
            const key = `coser:${c.name}`;
            const saved = savedKeys.has(key);
            return (
              <div
                key={c.name + c.dates.join(",")}
                className={`flex items-center gap-3 rounded-2xl border p-3 ${c.isFollowed ? "border-primary/40 bg-primary/5" : c.isPast ? "border-amber-400/40 bg-amber-400/5" : "border-border/50 bg-card"}`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-sm font-semibold">
                  {c.name[0] || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    {c.isFollowed && (
                      <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                    )}
                    {c.isPast && !c.isFollowed && (
                      <Camera className="h-3.5 w-3.5 text-amber-500" />
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {[c.dates.join("/"), c.characters.join("、"), c.notes]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button
                  onClick={() =>
                    pin(
                      "coser",
                      {
                        name: c.name,
                        dates: c.dates,
                        characters: c.characters,
                        notes: c.notes,
                      },
                      key,
                    )
                  }
                  className={`rounded-full p-2 ${saved ? "text-primary" : "text-muted-foreground active:scale-95"}`}
                >
                  {saved ? <BadgeCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tab === "booths" && (
        <div className="space-y-2">
          {boothsScored.length === 0 && <EmptyBlock text="攻略里没抓到展台" />}
          {boothsScored.map((b, i) => {
            const key = `booth:${b.exhibitor}:${b.hall}`;
            const saved = savedKeys.has(key);
            return (
              <div key={i} className="rounded-2xl border border-border/50 bg-card p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-1 text-[11px] font-semibold">
                    {b.hall || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium">{b.exhibitor}</p>
                      {b.scarcity === "high" && (
                        <Flame className="h-3.5 w-3.5 text-orange-500" />
                      )}
                    </div>
                    {b.booth_no && (
                      <p className="text-[11px] text-muted-foreground">摊位 {b.booth_no}</p>
                    )}
                    {b.freebies.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {b.freebies.slice(0, 8).map((f, j) => (
                          <span
                            key={j}
                            className="rounded-full bg-surface-1 px-2 py-0.5 text-[10px]"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                    {b.guests.length > 0 && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-primary">
                        <User className="h-3 w-3" /> {b.guests.join("、")}
                      </p>
                    )}
                    {b.activities.length > 0 && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {b.activities.join(" · ")}
                      </p>
                    )}
                    {b.time_slots.length > 0 && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        ⏱ {b.time_slots.join(" / ")}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      pin(
                        "booth",
                        {
                          exhibitor: b.exhibitor,
                          hall: b.hall,
                          booth_no: b.booth_no,
                          freebies: b.freebies,
                          guests: b.guests,
                          activities: b.activities,
                          time_slots: b.time_slots,
                          scarcity: b.scarcity,
                        },
                        key,
                      )
                    }
                    className={`rounded-full p-2 ${saved ? "text-primary" : "text-muted-foreground active:scale-95"}`}
                  >
                    {saved ? <BadgeCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "tips" && (
        <div className="space-y-3">
          {parsed.warnings.length > 0 && (
            <section className="rounded-2xl border border-orange-400/30 bg-orange-500/5 p-3">
              <p className="eyebrow text-orange-500">重要提醒</p>
              <ul className="mt-2 space-y-1 text-sm">
                {parsed.warnings.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-orange-500" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {parsed.tips.length > 0 && (
            <section className="rounded-2xl border border-border/50 bg-card p-3">
              <p className="eyebrow">通用贴士</p>
              <ul className="mt-2 space-y-1 text-sm">
                {parsed.tips.map((t, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {parsed.tips.length === 0 && parsed.warnings.length === 0 && (
            <EmptyBlock text="攻略里没有额外的贴士" />
          )}
        </div>
      )}

      {g.event_id && (
        <Link
          to="/events/$id"
          params={{ id: g.event_id }}
          className="mt-2 flex items-center justify-center gap-1 rounded-full bg-surface-1 px-4 py-3 text-sm text-foreground/80 active:scale-[0.99]"
        >
          <MapPin className="h-4 w-4" /> 回到展会详情
        </Link>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface-1 py-2">
      <p className={`display-title text-[22px] tabular ${accent ? "text-primary" : ""}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed p-8 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

function RouteTab({
  narrative,
  items,
  onDone,
  guideEventId,
}: {
  narrative: GuideNarrative | null;
  items: ItemRow[];
  onDone: (id: string, done: boolean) => void;
  guideEventId: string | null;
}) {
  const pinned = items.filter((i) => i.pinned);
  if (!narrative && pinned.length === 0) {
    return (
      <EmptyBlock text='还没有行程。点击"AI 行程建议"或在 Coser/展台 标签里把想去的加入行程。' />
    );
  }
  return (
    <div className="space-y-4">
      {narrative && narrative.route_plan.length > 0 && (
        <section>
          <p className="eyebrow mb-2 flex items-center gap-1">
            <Landmark className="h-3 w-3" /> AI 推荐路线
          </p>
          <div className="space-y-2">
            {narrative.route_plan.map((day, i) => (
              <div key={i} className="rounded-2xl border border-border/50 bg-card p-3">
                <p className="text-sm font-medium">{day.day || `Day ${i + 1}`}</p>
                <ol className="mt-2 space-y-1.5">
                  {day.stops.map((s, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-1 text-[10px] tabular">
                        {j + 1}
                      </span>
                      <span>
                        <span className="font-medium">{s.hall}</span>
                        <span className="ml-1 text-muted-foreground">{s.why}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      )}

      {pinned.length > 0 && (
        <section>
          <p className="eyebrow mb-2 flex items-center gap-1">
            <Bookmark className="h-3 w-3" /> 我的行程 ({pinned.filter((p) => !p.done).length} 待办)
          </p>
          <ul className="space-y-2">
            {pinned.map((it) => {
              const p = it.payload ?? {};
              const label =
                it.kind === "coser"
                  ? String(p.name ?? "")
                  : `${String(p.exhibitor ?? "")}${p.hall ? ` @${String(p.hall)}` : ""}`;
              const sub =
                it.kind === "coser"
                  ? [
                      Array.isArray(p.dates) ? (p.dates as string[]).join("/") : "",
                      Array.isArray(p.characters) ? (p.characters as string[]).join("、") : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : Array.isArray(p.freebies)
                    ? (p.freebies as string[]).slice(0, 3).join("、")
                    : "";
              return (
                <li
                  key={it.id}
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${it.done ? "border-border/40 bg-surface-1 opacity-60" : "border-border/60 bg-card"}`}
                >
                  <button
                    onClick={() => onDone(it.id, !it.done)}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${it.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}
                    aria-label="标记完成"
                  >
                    {it.done && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm ${it.done ? "line-through" : "font-medium"}`}
                    >
                      {label}
                    </p>
                    {sub && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</p>
                    )}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {it.kind === "coser" ? "Coser" : "展台"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {guideEventId && (
        <p className="mt-1 text-center text-[11px] text-muted-foreground">
          绑定的展会详情里可以看到已加入的行程。
        </p>
      )}
    </div>
  );
}
