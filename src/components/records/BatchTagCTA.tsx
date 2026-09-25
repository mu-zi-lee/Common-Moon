import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { analyzePhoto } from "@/lib/ai.functions";
import { upsertRecord } from "@/lib/records.functions";
import { getSignedUrl, readAsDataUrl } from "@/lib/storage";

type Target = {
  id: string;
  photo_url: string | null;
  teacher_name: string | null;
  character_name: string | null;
  anime_name: string | null;
  hall: string | null;
  event_id: string | null;
  favorite: boolean;
  rating: number;
  _tags: string[];
};

/**
 * CTA that runs `analyzePhoto` sequentially over the currently-visible
 * `no_meta` records, writing back character/anime/tags via `upsertRecord`.
 * Kept purely client-side to avoid a new server fn.
 */
export function BatchTagCTA({ targets }: { targets: Target[] }) {
  const analyzeFn = useServerFn(analyzePhoto);
  const upsertFn = useServerFn(upsertRecord);
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);

  const runnable = targets.filter((t) => t.photo_url && !t.character_name && !t.teacher_name);
  if (runnable.length === 0) return null;

  async function run() {
    if (running) return;
    setRunning(true);
    setDone(0);
    let ok = 0;
    let fail = 0;
    for (const t of runnable) {
      try {
        const url = await getSignedUrl("photos", t.photo_url!);
        const blob = await (await fetch(url)).blob();
        const dataUrl = await readAsDataUrl(blob);
        const result = await analyzeFn({ data: { imageDataUrl: dataUrl } });
        const highConf = result.confidence >= 0.4;
        await upsertFn({
          data: {
            id: t.id,
            event_id: t.event_id,
            photo_url: t.photo_url,
            photo_urls: [],
            teacher_name: t.teacher_name,
            character_name: highConf ? (t.character_name || result.character) : t.character_name,
            anime_name: highConf ? (t.anime_name || result.anime) : t.anime_name,
            hall: t.hall,
            marker_x: null,
            marker_y: null,
            note: null,
            favorite: t.favorite,
            rating: t.rating,
            contacts: [],
            tags: Array.from(new Set([...t._tags, ...result.tags])),
            occurred_at: undefined,
          },
        });
        ok++;
      } catch {
        fail++;
      }
      setDone((d) => d + 1);
    }
    setRunning(false);
    qc.invalidateQueries();
    toast[fail ? "warning" : "success"](
      `识别完成 · 成功 ${ok}${fail ? ` · 失败 ${fail}` : ""}`,
    );
  }

  return (
    <button
      onClick={run}
      disabled={running}
      className="mb-3 flex w-full items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-xs font-medium text-primary active:scale-[0.99] disabled:opacity-70"
    >
      {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      <span className="flex-1 text-left">
        {running
          ? `AI 识别中 · ${done} / ${runnable.length}`
          : `一键 AI 识别 ${runnable.length} 张待整理`}
      </span>
      {!running && <span className="opacity-60">串行 · 慢</span>}
    </button>
  );
}
