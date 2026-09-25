import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { summarizeEvent, type EventSummary } from "@/lib/summarize.functions";

export function EventSummaryCard({ eventId }: { eventId: string }) {
  const summarizeFn = useServerFn(summarizeEvent);
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  const cached = useQuery({
    queryKey: ["event-summary", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("ai_summary, ai_summary_at")
        .eq("id", eventId)
        .single();
      return {
        summary: (data?.ai_summary ?? null) as EventSummary | null,
        at: data?.ai_summary_at ?? null,
      };
    },
  });

  async function run() {
    if (running) return;
    setRunning(true);
    try {
      await summarizeFn({ data: { event_id: eventId } });
      await qc.invalidateQueries({ queryKey: ["event-summary", eventId] });
      toast.success("AI 总结已生成");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成失败");
    } finally {
      setRunning(false);
    }
  }

  const summary = cached.data?.summary;
  const at = cached.data?.at;

  if (!summary) {
    return (
      <button
        onClick={run}
        disabled={running}
        className="mt-4 flex w-full items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-xs font-medium text-primary active:scale-[0.99] disabled:opacity-60"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        <span className="flex-1 text-left">{running ? "AI 总结中…" : "生成这次展会的 AI 小结"}</span>
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-3xl border border-border/50 bg-card p-4">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">AI Recap</p>
        <button
          onClick={run}
          disabled={running}
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          title="重新生成"
        >
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          重新生成
        </button>
      </div>
      <h3 className="display-title mt-2 text-[22px] leading-snug">{summary.headline}</h3>

      {summary.highlights.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm text-foreground/85">
          {summary.highlights.map((h, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}

      {summary.groups.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {summary.groups.map((g, i) => (
            <span key={i} className="rounded-full bg-surface-1 px-2.5 py-1 text-[11px] text-foreground/80">
              {g.theme}
              {g.characters.length > 0 && (
                <span className="ml-1 opacity-60">· {g.characters.slice(0, 3).join("/")}</span>
              )}
            </span>
          ))}
        </div>
      )}

      {summary.suggestions && (
        <p className="mt-3 text-xs text-muted-foreground">💡 {summary.suggestions}</p>
      )}

      {at && (
        <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {new Date(at).toLocaleString("zh-CN")}
        </p>
      )}
    </div>
  );
}
