import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { StorageImage } from "@/components/StorageImage";
import { deleteEvent } from "@/lib/records.functions";
import { Plus, Edit2, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/events/")({
  component: EventsIndex,
});

function EventsIndex() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const delFn = useServerFn(deleteEvent);

  const { data, isLoading } = useQuery({
    queryKey: ["events-with-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("已删除"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "删除失败"),
  });

  return (
    <AppShell
      eyebrow="Events"
      title="展会"
      right={
        <button
          onClick={() => navigate({ to: "/events/new" })}
          className="rounded-full p-2 text-foreground active:scale-95 transition"
          aria-label="新建展会"
        >
          <Plus className="h-5 w-5" strokeWidth={1.6} />
        </button>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 shimmer rounded-3xl" />)}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="rounded-3xl border border-dashed border-divider p-12 text-center">
          <p className="display-title text-[42px] text-foreground/15">Empty</p>
          <p className="mt-2 text-xs text-muted-foreground">还没有展会</p>
          <button
            onClick={() => navigate({ to: "/events/new" })}
            className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground px-5 text-xs font-semibold text-background active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> 新建第一个展会
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {data!.map((e) => (
            <li key={e.id}>
              <Link
                to="/events/$id"
                params={{ id: e.id }}
                className="group flex gap-4 rounded-3xl bg-surface-1 p-3 active:scale-[0.99] transition ease-editorial"
              >
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-muted">
                  {e.map_image_url ? (
                    <StorageImage bucket="maps" path={e.map_image_url} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <MapPin className="h-6 w-6" strokeWidth={1.2} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 py-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="eyebrow tabular">{e.year || "—"}</p>
                      <h3 className="mt-0.5 truncate display-title text-[20px]">{e.name}</h3>
                    </div>
                    <div className="flex shrink-0 gap-1" onClick={(ev) => ev.preventDefault()}>
                      <Link
                        to="/events/$id/edit"
                        params={{ id: e.id }}
                        className="rounded-full p-1.5 text-muted-foreground active:scale-95 transition"
                        aria-label="编辑"
                      >
                        <Edit2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                      </Link>
                      <button
                        onClick={(ev) => { ev.preventDefault(); if (confirm(`删除「${e.name}」？记录不会被删除，但关联会解除。`)) del.mutate(e.id); }}
                        className="rounded-full p-1.5 text-destructive/70 active:scale-95 transition"
                        aria-label="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {[e.city, e.venue].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(e.halls ?? []).slice(0, 5).map((h) => (
                      <span key={h} className="rounded-full border border-divider px-2 py-0.5 text-[10px] tracking-wider uppercase text-muted-foreground">{h}</span>
                    ))}
                    {(e.halls?.length ?? 0) > 5 && <span className="text-[10px] text-muted-foreground">+{(e.halls?.length ?? 0) - 5}</span>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
