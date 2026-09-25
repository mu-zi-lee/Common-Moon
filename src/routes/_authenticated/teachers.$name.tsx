import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { PortraitCard, type PortraitRecord } from "@/components/records/PortraitCard";
import { TeacherShareSheet } from "@/components/teachers/TeacherShareSheet";
import { SubscribeButton } from "@/components/SubscribeButton";
import { platformUrl } from "@/lib/contact-utils";
import { Copy, ExternalLink, Share2 } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/teachers/$name")({
  component: TeacherDetail,
});

function TeacherDetail() {
  const { name: encodedName } = Route.useParams();
  const name = decodeURIComponent(encodedName);
  const [shareOpen, setShareOpen] = useState(false);


  const q = useQuery({
    queryKey: ["teacher", name],
    queryFn: async () => {
      const { data, error } = await supabase.from("records")
        .select("id, photo_url, teacher_name, character_name, anime_name, hall, favorite, rating, occurred_at, event_id, events(name), contacts(id, platform, handle)")
        .eq("teacher_name", name)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const summary = useMemo(() => {
    const rows = q.data ?? [];
    const events = new Set<string>();
    let fav = 0, maxRating = 0;
    const contactMap = new Map<string, string>();
    for (const r of rows) {
      const evName = Array.isArray(r.events) ? r.events[0]?.name : (r.events as { name?: string } | null)?.name;
      if (evName) events.add(evName);
      if (r.favorite) fav += 1;
      if ((r.rating ?? 0) > maxRating) maxRating = r.rating ?? 0;
      for (const c of (r.contacts ?? []) as { platform: string; handle: string }[]) {
        const key = `${c.platform}::${c.handle}`;
        if (!contactMap.has(key)) contactMap.set(key, key);
      }
    }
    const contacts = Array.from(contactMap.keys()).map((k) => {
      const [platform, ...rest] = k.split("::");
      return { platform, handle: rest.join("::") };
    });
    return { events: Array.from(events), fav, maxRating, contacts, count: rows.length };
  }, [q.data]);

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast.success("已复制"); } catch { toast.error("复制失败"); }
  }

  return (
    <AppShell
      eyebrow="Teacher"
      title={name}
      onBack={() => history.back()}
      hideTabs
      right={
        <button
          onClick={() => setShareOpen(true)}
          className="rounded-full bg-surface-1 p-2 active:scale-95"
          aria-label="公开分享"
        >
          <Share2 className="h-4 w-4" strokeWidth={1.6} />
        </button>
      }
    >

      {q.isLoading ? (
        <div className="space-y-3">
          <div className="h-40 shimmer rounded-3xl" />
          <div className="h-24 shimmer rounded-3xl" />
        </div>
      ) : (
        <>
          {/* Editorial masthead */}
          <div className="hairline-b pb-5">
            <h1 className="display-title text-[52px]" style={{ lineHeight: 0.95 }}>{name}</h1>
            <p className="mt-2 text-sm text-muted-foreground italic font-display">
              {summary.count} {summary.count === 1 ? "encounter" : "encounters"}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <StatBlock label="记录" value={summary.count} />
              <StatBlock label="收藏" value={summary.fav} />
              <StatBlock label="展会" value={summary.events.length} />
            </div>
            <div className="mt-4"><SubscribeButton kind="teacher" teacherName={name} /></div>
          </div>

          {summary.contacts.length > 0 && (
            <section className="mt-6 hairline-b pb-5">
              <p className="eyebrow">Contact</p>
              <div className="mt-2 divide-y divide-divider">
                {summary.contacts.map((c) => {
                  const url = platformUrl(c.platform, c.handle);
                  return (
                    <div key={`${c.platform}${c.handle}`} className="flex items-center gap-2 py-3">
                      <span className="eyebrow w-16 shrink-0">{c.platform}</span>
                      <span className="flex-1 truncate font-mono text-sm">{c.handle}</span>
                      <button onClick={() => copy(c.handle)} className="rounded-full p-2 text-muted-foreground active:scale-95 transition" aria-label="复制">
                        <Copy className="h-3.5 w-3.5" strokeWidth={1.6} />
                      </button>
                      {url && (
                        <a href={url} target="_blank" rel="noreferrer noopener" className="rounded-full p-2 text-muted-foreground active:scale-95 transition" aria-label="打开">
                          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.6} />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {summary.events.length > 0 && (
            <section className="mt-6 hairline-b pb-5">
              <p className="eyebrow mb-3">Appeared at</p>
              <div className="flex flex-wrap gap-1.5">
                {summary.events.map((e) => (
                  <span key={e} className="rounded-full bg-surface-1 px-3 py-1 text-[11px] font-medium">{e}</span>
                ))}
              </div>
            </section>
          )}

          <section className="mt-6">
            <div className="mb-3 flex items-baseline justify-between hairline-b pb-2">
              <div>
                <p className="eyebrow">Archive</p>
                <h2 className="display-title mt-1 text-[22px]">所有记录</h2>
              </div>
              <Link to="/records" className="text-[10px] uppercase tracking-widest text-muted-foreground">返回列表</Link>
            </div>
            <ul className="grid grid-cols-2 gap-4">
              {(q.data ?? []).map((r, i) => (
                <li key={r.id}>
                  <PortraitCard record={r as unknown as PortraitRecord} index={i} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      <TeacherShareSheet teacherName={name} open={shareOpen} onClose={() => setShareOpen(false)} />
    </AppShell>
  );
}


function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="display-title text-[32px] tabular">{value}</div>
      <div className="eyebrow mt-1">{label}</div>
    </div>
  );
}
