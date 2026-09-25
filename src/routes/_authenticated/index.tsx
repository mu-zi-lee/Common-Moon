import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { StorageImage } from "@/components/StorageImage";
import { PortraitCard, type PortraitRecord } from "@/components/records/PortraitCard";
import { Camera, Users, Landmark, BarChart3, ArrowUpRight, ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

function monthStartIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

type HomeStats = {
  monthRecords: number;
  monthTeachers: number;
  monthEvents: number;
  totalRecords: number;
};

function HomePage() {
  const stats = useQuery({
    queryKey: ["home-stats-v5"],
    queryFn: async () => {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const [aggRes, recent, latest, todayRow] = await Promise.all([
        supabase.rpc("home_stats"),
        supabase.from("records").select("id, photo_url, teacher_name, character_name, anime_name, hall, favorite, rating, occurred_at, event_id, events(name), record_tags(tags(name))").order("occurred_at", { ascending: false }).limit(6),
        supabase.from("records").select("id, photo_url, teacher_name, character_name, event_id, occurred_at, events(id, name)").order("occurred_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("records").select("id, photo_url, teacher_name, event_id, occurred_at, events(id, name)").gte("occurred_at", todayStart.toISOString()).not("event_id", "is", null).order("occurred_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      let agg = (aggRes.data ?? null) as HomeStats | null;
      if (!agg) {
        const monthStart = monthStartIso();
        const [monthRows, totalCnt] = await Promise.all([
          supabase.from("records").select("teacher_name, event_id").gte("occurred_at", monthStart),
          supabase.from("records").select("id", { count: "exact", head: true }),
        ]);
        const rows = monthRows.data ?? [];
        const teacherSet = new Set<string>();
        const eventSet = new Set<string>();
        for (const r of rows) {
          if (r.teacher_name) teacherSet.add(r.teacher_name);
          if (r.event_id) eventSet.add(r.event_id);
        }
        agg = {
          monthRecords: rows.length,
          monthTeachers: teacherSet.size,
          monthEvents: eventSet.size,
          totalRecords: totalCnt.count ?? 0,
        };
      }

      return {
        ...agg,
        recent: (recent.data ?? []).map((r) => ({
          ...r,
          tags: (r.record_tags ?? [])
            .map((rt: { tags: { name: string } | null }) => rt.tags?.name)
            .filter(Boolean) as string[],
        })),
        latest: latest.data,
        todayEvent: todayRow.data,
      };
    },
  });

  const now = new Date();
  const monthNumRoman = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][now.getMonth()];
  const yearStr = String(now.getFullYear());
  const latest = stats.data?.latest;
  const todayEvent = stats.data?.todayEvent;
  const latestEv = latest && (Array.isArray(latest.events) ? latest.events[0] : latest.events) as { id?: string; name?: string } | null;
  const todayEv = todayEvent && (Array.isArray(todayEvent.events) ? todayEvent.events[0] : todayEvent.events) as { id?: string; name?: string } | null;

  return (
    <AppShell>
      <div className="safe-top pt-1" />

      {/* Masthead */}
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="pt-2"
      >
        <div className="flex items-baseline justify-between hairline-b pb-3">
          <p className="eyebrow">Vol. {yearStr.slice(2)} · {monthNumRoman}</p>
          <p className="eyebrow tabular">{now.toLocaleDateString("zh-CN", { weekday: "short", month: "short", day: "numeric" })}</p>
        </div>
        <h1 className="display-title mt-4 text-[56px] leading-[0.9]">CosLog</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <em className="font-display not-italic text-foreground">今天</em> 又遇见了谁？
        </p>
      </motion.header>

      {/* Editorial monthly hero */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05, ease: [0.32, 0.72, 0, 1] }}
        className="mt-6 rounded-3xl bg-accent-brand p-6 text-accent-brand-foreground shadow-editorial"
      >
        <div className="flex items-baseline justify-between">
          <p className="eyebrow" style={{ color: "color-mix(in oklab, currentColor 50%, transparent)" }}>
            This month
          </p>
          <span className="text-[10px] tracking-widest opacity-60 tabular">
            TOTAL {stats.data?.totalRecords ?? 0}
          </span>
        </div>
        <div className="mt-3 flex items-end gap-4">
          <span className="display-title text-[88px]" style={{ lineHeight: 0.85 }}>{monthNumRoman}</span>
          <span className="mb-2 text-xs opacity-70">
            {now.toLocaleDateString("zh-CN", { month: "long" })}<br />
            <span className="opacity-60">of {yearStr}</span>
          </span>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-current/10 pt-4">
          <HeroStat label="老师" value={stats.data?.monthTeachers ?? 0} />
          <HeroStat label="展会" value={stats.data?.monthEvents ?? 0} />
          <HeroStat label="记录" value={stats.data?.monthRecords ?? 0} />
        </div>
      </motion.section>

      {/* Continue — smart: today's event if any, else last record */}
      {todayEvent && todayEv?.id ? (
        <Link
          to="/records/new"
          search={{ event: todayEv.id }}
          className="mt-4 flex items-center gap-3 rounded-3xl bg-accent-brand p-3 text-accent-brand-foreground active:scale-[0.99] transition ease-editorial shadow-editorial"
        >
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-background/20">
            {todayEvent.photo_url && <StorageImage bucket="photos" path={todayEvent.photo_url} className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="eyebrow" style={{ color: "color-mix(in oklab, currentColor 60%, transparent)" }}>Today · Continue</p>
            <p className="mt-0.5 truncate display-title text-[18px]">继续在 {todayEv.name} 记录</p>
            <p className="mt-0.5 truncate text-[11px] opacity-70">刚刚记录了 {todayEvent.teacher_name || "—"}</p>
          </div>
          <ArrowUpRight className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.5} />
        </Link>
      ) : latest ? (
        <Link
          to="/records/new"
          className="mt-4 flex items-center gap-3 rounded-3xl bg-surface-1 p-3 active:scale-[0.99] transition ease-editorial"
        >
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
            {latest.photo_url && <StorageImage bucket="photos" path={latest.photo_url} className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Continue</p>
            <p className="mt-0.5 truncate display-title text-[18px]">
              {latestEv?.name || "自由外拍"}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              上次记录了 {latest.teacher_name || "—"}
            </p>
          </div>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
        </Link>
      ) : null}

      {/* Quick actions – editorial grid */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <QuickCard to="/records/new" icon={<Camera className="h-5 w-5" strokeWidth={1.5} />} label="新增" sub="Capture" primary />
        <QuickCard to="/teachers" icon={<Users className="h-5 w-5" strokeWidth={1.5} />} label="老师" sub="People" />
        <QuickCard to="/events" icon={<Landmark className="h-5 w-5" strokeWidth={1.5} />} label="展会" sub="Events" />
        <QuickCard to="/stats" icon={<BarChart3 className="h-5 w-5" strokeWidth={1.5} />} label="洞察" sub="Insights" />
      </div>

      {/* AI 攻略助手入口 */}
      <Link
        to="/guides"
        className="mt-3 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 active:scale-[0.99]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Sparkles className="h-5 w-5" strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">AI 攻略助手</p>
          <p className="text-[11px] text-muted-foreground">
            扔一份攻略给 AI，秒变个性化行程
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-primary" />
      </Link>

      {/* Recent */}
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between hairline-b pb-2">
          <div>
            <p className="eyebrow">Recent</p>
            <h2 className="display-title mt-1 text-[24px]">最近的相遇</h2>
          </div>
          <Link to="/records" className="inline-flex items-center gap-1 text-xs tracking-wider uppercase text-muted-foreground hover:text-foreground transition">
            全部 <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
          </Link>
        </div>
        {stats.isLoading ? (
          <div className="grid grid-cols-3 gap-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-[10/13] shimmer rounded-2xl" />
            ))}
          </div>
        ) : stats.data?.recent.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-divider p-10 text-center">
            <p className="display-title text-[36px] text-foreground/20">Empty</p>
            <p className="mt-2 text-xs text-muted-foreground">还没有一次相遇被记录</p>
            <Link to="/records/new" className="mt-4 inline-flex h-10 items-center rounded-full bg-accent-brand px-5 text-xs font-semibold text-accent-brand-foreground">
              开始记录
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {((stats.data?.recent ?? []) as unknown as PortraitRecord[]).map((r, i) => (
              <PortraitCard key={r.id} record={r} index={i} variant="compact" />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function QuickCard({ to, icon, label, sub, primary }: { to: string; icon: React.ReactNode; label: string; sub: string; primary?: boolean }) {
  return (
    <Link
      to={to}
      className={`group flex h-28 flex-col justify-between rounded-3xl p-4 transition active:scale-[0.985] ease-editorial ${
        primary
          ? "bg-accent-brand text-accent-brand-foreground shadow-editorial"
          : "bg-surface-1 text-foreground"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className={primary ? "opacity-80" : "text-muted-foreground"}>{icon}</span>
        <span className={`eyebrow ${primary ? "" : ""}`} style={primary ? { color: "color-mix(in oklab, currentColor 55%, transparent)" } : undefined}>
          {sub}
        </span>
      </div>
      <span className="display-title text-[26px]">{label}</span>
    </Link>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="display-title text-[38px] tabular" style={{ lineHeight: 0.9 }}>{value}</div>
      <div className="mt-1 text-[10px] tracking-widest uppercase opacity-55">{label}</div>
    </div>
  );
}
