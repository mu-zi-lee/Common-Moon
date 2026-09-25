import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { deleteGuide } from "@/lib/guides.functions";

export const Route = createFileRoute("/_authenticated/guides/")({
  component: GuidesList,
});

function GuidesList() {
  const qc = useQueryClient();
  const delFn = useServerFn(deleteGuide);

  const list = useQuery({
    queryKey: ["guides-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("guides")
        .select("id, title, status, created_at, parsed, event_id, events(name)")
        .order("created_at", { ascending: false })
        .limit(60);
      return data ?? [];
    },
  });

  async function onDelete(id: string, title: string | null) {
    if (!confirm(`删除「${title || "未命名攻略"}」？此操作不可恢复。`)) return;
    const t = toast.loading("删除中…");
    try {
      await delFn({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["guides-list"] });
      toast.success("已删除", { id: t });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败", { id: t });
    }
  }

  return (
    <AppShell
      title="AI 攻略"
      eyebrow="Guides"
      right={
        <Link
          to="/guides/new"
          className="rounded-full bg-foreground p-2 text-background active:scale-95"
          aria-label="新增"
        >
          <Plus className="h-4 w-4" />
        </Link>
      }
    >
      {list.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 shimmer rounded-2xl" />
          ))}
        </div>
      ) : (list.data ?? []).length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed p-8 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-primary/60" />
          <p className="mt-3 text-sm font-medium">还没有攻略</p>
          <p className="mt-1 text-xs text-muted-foreground">
            把别人写好的攻略丢给 AI，秒变你的个性化行程。
          </p>
          <Link
            to="/guides/new"
            className="mt-4 inline-flex items-center gap-1 rounded-full bg-foreground px-4 py-2 text-xs text-background"
          >
            <Plus className="h-3.5 w-3.5" /> 新建攻略
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.data!.map((g) => {
            const parsed = g.parsed as { booths?: unknown[]; cosers?: unknown[] } | null;
            const bc = parsed?.booths?.length ?? 0;
            const cc = parsed?.cosers?.length ?? 0;
            const failed = g.status === "failed";
            const parsing = g.status === "parsing";
            return (
              <li key={g.id} className="flex items-stretch gap-1.5">
                <Link
                  to="/guides/$id"
                  params={{ id: g.id }}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-surface-1 p-3 active:scale-[0.99]"
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl ${failed ? "bg-destructive/10 text-destructive" : parsing ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}
                  >
                    {failed ? (
                      <TriangleAlert className="h-4 w-4" />
                    ) : parsing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {g.title || "未命名攻略"}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {g.events?.name ? `${g.events.name} · ` : ""}
                      {failed
                        ? "解析失败"
                        : parsing
                          ? "解析中…"
                          : `${bc} 展台 · ${cc} coser`}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground tabular">
                    {new Date(g.created_at).toLocaleDateString("zh-CN", {
                      month: "numeric",
                      day: "numeric",
                    })}
                  </span>
                </Link>
                <button
                  onClick={() => onDelete(g.id, g.title)}
                  aria-label="删除"
                  className="flex w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-1 text-muted-foreground hover:text-destructive active:scale-95"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
