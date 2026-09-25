import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { createLovableAiGateway } from "./ai-gateway.server";

const SummarizeInput = z.object({ event_id: z.string().uuid() });

const SummarySchema = z.object({
  headline: z.string(),
  highlights: z.array(z.string()),
  groups: z.array(z.object({ theme: z.string(), characters: z.array(z.string()) })),
  suggestions: z.string(),
});

export type EventSummary = z.infer<typeof SummarySchema>;

export const summarizeEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => SummarizeInput.parse(v))
  .handler(async ({ data, context }): Promise<EventSummary> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const { supabase, userId } = context;

    const { data: ev, error: ee } = await supabase
      .from("events")
      .select("id, name, year, city, venue")
      .eq("id", data.event_id)
      .eq("user_id", userId)
      .single();
    if (ee || !ev) throw new Error("展会不存在");

    const { data: recs, error: re } = await supabase
      .from("records")
      .select("teacher_name, character_name, anime_name, hall, note, rating, favorite, occurred_at")
      .eq("event_id", data.event_id)
      .eq("user_id", userId)
      .order("occurred_at", { ascending: true });
    if (re) throw new Error(re.message);

    if (!recs || recs.length === 0) {
      throw new Error("这个展会还没有任何记录");
    }

    const digest = recs.map((r, i) => {
      const parts: string[] = [`${i + 1}.`];
      if (r.teacher_name) parts.push(r.teacher_name);
      if (r.character_name) parts.push(`饰演 ${r.character_name}`);
      if (r.anime_name) parts.push(`(${r.anime_name})`);
      if (r.hall) parts.push(`@${r.hall}`);
      if (r.favorite) parts.push("★收藏");
      if (r.rating) parts.push(`${r.rating}星`);
      if (r.note) parts.push(`// ${r.note.slice(0, 60)}`);
      return parts.join(" ");
    }).join("\n");

    const gateway = createLovableAiGateway(key);
    const model = gateway("google/gemini-2.5-flash");

    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: SummarySchema }),
        prompt: [
          `展会：${ev.name}${ev.year ? ` ${ev.year}` : ""}${ev.city ? ` · ${ev.city}` : ""}`,
          `以下是我在这次展会遇到的 cosplayer 记录（共 ${recs.length} 条）：`,
          digest,
          "",
          "请用亲切、有个性的中文，为这次展会写一份小结：",
          "- headline: 一句话高度概括这次展会（<= 25 字）",
          "- highlights: 3-5 条难忘瞬间/亮点，每条一句话",
          "- groups: 按作品/系列聚合角色，如 [{theme:'原神', characters:['雷电将军','纳西妲']}]，最多 5 组",
          "- suggestions: 一段 30-60 字的下次可以关注/拍摄的建议",
        ].join("\n"),
      });
      const summary: EventSummary = {
        headline: (output.headline || "").slice(0, 40),
        highlights: (output.highlights || []).slice(0, 5),
        groups: (output.groups || []).slice(0, 5),
        suggestions: output.suggestions || "",
      };
      await supabase.from("events").update({
        ai_summary: summary,
        ai_summary_at: new Date().toISOString(),
      }).eq("id", data.event_id).eq("user_id", userId);
      return summary;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("AI 没能生成合规的总结，请稍后再试");
      }
      throw error;
    }
  });
