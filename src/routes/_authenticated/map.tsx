import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { MapPin, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { StorageImage } from "@/components/StorageImage";

export const Route = createFileRoute("/_authenticated/map")({
  component: MapPage,
});

function MapPage() {
  const navigate = useNavigate();
  const events = useQuery({
    queryKey: ["events-with-map"],
    queryFn: async () => (await supabase.from("events").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const [selected, setSelected] = useState<string | null>(null);
  const eventId = selected ?? events.data?.[0]?.id ?? null;
  const activeEvent = events.data?.find((e) => e.id === eventId);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const records = useQuery({
    queryKey: ["map-records", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data } = await supabase.from("records").select("id, teacher_name, character_name, marker_x, marker_y, photo_url").eq("event_id", eventId).not("marker_x", "is", null);
      return data ?? [];
    },
    enabled: !!eventId,
  });

  const onCanvasTap = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const point = "touches" in e ? e.changedTouches[0] : (e as React.MouseEvent);
    const x = (point.clientX - rect.left) / rect.width;
    const y = (point.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    setPending({ x, y });
    try { navigator.vibrate?.(10); } catch { /* noop */ }
  };

  return (
    <AppShell title="地图">
      {events.data && events.data.length > 0 ? (
        <>
          <div className="mb-4 -mx-1 flex gap-4 overflow-x-auto px-1 border-b border-border">
            {events.data.map((e) => {
              const active = e.id === eventId;
              return (
                <button
                  key={e.id}
                  onClick={() => { setSelected(e.id); setPending(null); }}
                  className={`shrink-0 border-b-2 pb-2 pt-1 text-sm transition ${active ? "border-foreground font-semibold text-foreground" : "border-transparent text-muted-foreground"}`}
                >
                  {e.name}
                </button>
              );
            })}
          </div>
          {activeEvent?.map_image_url ? (
            <>
              <div
                ref={canvasRef}
                onClick={onCanvasTap}
                className="relative overflow-hidden rounded-3xl border border-border bg-card select-none"
              >
                <StorageImage bucket="maps" path={activeEvent.map_image_url} className="w-full pointer-events-none" />
                {records.data?.map((r) => (
                  <Link
                    key={r.id}
                    to="/records/$id"
                    params={{ id: r.id }}
                    onClick={(ev) => ev.stopPropagation()}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${(r.marker_x ?? 0) * 100}%`, top: `${(r.marker_y ?? 0) * 100}%` }}
                    aria-label={r.teacher_name ?? r.character_name ?? "记录"}
                  >
                    <MapPin className="h-6 w-6 fill-foreground text-background drop-shadow" />
                  </Link>
                ))}
                {pending && (
                  <div
                    className="absolute -translate-x-1/2 -translate-y-full pointer-events-none animate-pulse"
                    style={{ left: `${pending.x * 100}%`, top: `${pending.y * 100}%` }}
                  >
                    <MapPin className="h-8 w-8 fill-accent text-background drop-shadow" strokeWidth={1.4} />
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {pending ? "已选点位 · 下方按钮新建记录" : `已标记 ${records.data?.length ?? 0} 位老师 · 轻点地图新建`}
              </p>
              {pending && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() =>
                      navigate({
                        to: "/records/new",
                        search: { event: eventId ?? undefined, mx: +pending.x.toFixed(4), my: +pending.y.toFixed(4) },
                      })
                    }
                    className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-foreground text-xs font-semibold uppercase tracking-wider text-background active:scale-[0.98]"
                  >
                    <Plus className="h-4 w-4" strokeWidth={1.8} /> 在此处新增
                  </button>
                  <button
                    onClick={() => setPending(null)}
                    className="h-11 rounded-full border border-divider px-5 text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    取消
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">此展会未上传地图</div>
          )}
        </>
      ) : (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">还没有展会，先去新增记录吧</div>
      )}
    </AppShell>
  );
}
