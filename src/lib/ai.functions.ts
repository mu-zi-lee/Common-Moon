import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { createLovableAiGateway } from "./ai-gateway.server";

const PhotoInput = z.object({
  imageDataUrl: z.string().startsWith("data:image/"),
});

const PhotoOutput = z.object({
  character: z.string(),
  anime: z.string(),
  confidence: z.number(),
  tags: z.array(z.string()),
  outfit: z.string(),
  notes: z.string(),
});

export type PhotoAnalysis = z.infer<typeof PhotoOutput>;

export const analyzePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => PhotoInput.parse(v))
  .handler(async ({ data }): Promise<PhotoAnalysis> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGateway(key);
    const model = gateway("google/gemini-2.5-flash");

    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: PhotoOutput }),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "分析这张 Cosplay 照片。识别角色名与所属作品，给出0-1置信度，给出3-8个中文标签(如作品名、系列、风格),简短描述服装(outfit)和其他备注(notes)。若无法识别，字段留空字符串，confidence 为 0。返回中文。" },
              { type: "image", image: data.imageDataUrl } as never,
            ],
          },
        ],
      });
      return {
        character: output.character || "",
        anime: output.anime || "",
        confidence: Math.max(0, Math.min(1, output.confidence || 0)),
        tags: (output.tags || []).slice(0, 8),
        outfit: output.outfit || "",
        notes: output.notes || "",
      };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        return { character: "", anime: "", confidence: 0, tags: [], outfit: "", notes: "" };
      }
      throw error;
    }
  });

const MapInput = z.object({
  imageDataUrl: z.string().startsWith("data:image/").optional(),
  imageDataUrls: z.array(z.string().startsWith("data:image/")).optional(),
}).refine((v) => v.imageDataUrl || (v.imageDataUrls && v.imageDataUrls.length > 0), {
  message: "至少提供一张地图图片",
});
const MapOutput = z.object({
  venue: z.string(),
  event_guess: z.string(),
  hall: z.string(),
  halls: z.array(z.string()),
  confidence: z.number(),
  notes: z.string(),
});


export type MapAnalysis = z.infer<typeof MapOutput>;

export const analyzeMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => MapInput.parse(v))
  .handler(async ({ data }): Promise<MapAnalysis> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGateway(key);
    const model = gateway("google/gemini-2.5-flash");
    const images = data.imageDataUrls?.length ? data.imageDataUrls : [data.imageDataUrl!];
    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: MapOutput }),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  "你是漫展展馆平面图识别助手。用户会一次性上传多张相关的图片（通常包含 1 张展会总平面图 + 若干张单个展馆的细图）。请综合所有图片，输出唯一一组结构化结果（中文）：",
                  "- venue: 场馆名称（如：上海国家会展中心 / 深圳会展中心 / 上海世博展览馆）",
                  "- event_guess: 展会名称（如：BiliBili World / ComicUp / ChinaJoy / IDO / 漫游）",
                  "- halls: 所有图片中出现的所有展馆编号，去重后的数组（如 [\"1.1H\",\"3H\",\"6.1H\"]）",
                  "- hall: 用户最可能想标记的**当前**单个展馆。判断优先级：a) 出现在细图（非总图）里的编号；b) 面积占比最大或独立成图的编号；c) 若无法判断，留空字符串。",
                  "- confidence: 0-1 的整体置信度",
                  "- notes: 一句话补充（主色调/主题区/图片张数等）",
                  "识别提示：",
                  "1) 若任一图出现 “BiliBiliWorld” Logo、X.XH（如 1.1H/2.1H/3H/4.1H/5.1H/6.1H/7.1H/8.1H）编号或 “上海·国家会展中心” 字样，event_guess 填 “BiliBili World”，venue 填 “上海国家会展中心”。",
                  "2) 总图上常有多个 hall 的缩略/索引，不要把它当作当前 hall；细图（单独一张放大的 hall 平面）才是当前 hall。",
                  "3) 无法识别的字段返回空字符串或空数组，confidence 为 0。",
                ].join("\n"),
              },
              ...images.map((image) => ({ type: "image", image } as never)),
            ],
          },
        ],
      });

      return {
        venue: output.venue || "",
        event_guess: output.event_guess || "",
        hall: output.hall || "",
        halls: output.halls || [],
        confidence: Math.max(0, Math.min(1, output.confidence || 0)),
        notes: output.notes || "",
      };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        return { venue: "", event_guess: "", hall: "", halls: [], confidence: 0, notes: "" };
      }
      throw error;
    }
  });
