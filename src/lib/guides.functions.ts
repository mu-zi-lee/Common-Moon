import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { z } from "zod";

// -------- Schemas --------

const FileMeta = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("pdf"),
    name: z.string(),
    size: z.number().int().nonnegative(),
    data_url: z.string().startsWith("data:"),
  }),
  z.object({
    kind: z.literal("image"),
    name: z.string(),
    size: z.number().int().nonnegative(),
    data_url: z.string().startsWith("data:"),
  }),
  z.object({
    kind: z.literal("markdown"),
    name: z.string(),
    size: z.number().int().nonnegative(),
    text: z.string(),
  }),
]);

const ParseInput = z.object({
  event_id: z.string().uuid().nullable().optional(),
  title: z.string().max(120).optional(),
  text: z.string().max(200_000).optional(),
  files: z.array(FileMeta).max(20).default([]),
  chunks: z.array(z.string().max(300_000)).max(10).optional(),
});


export type ParsedGuide = {
  meta: {
    event_guess: string;
    date_range: string;
    author: string;
    kind: "booth" | "coser_roster" | "route" | "mixed";
  };
  booths: Array<{
    exhibitor: string;
    hall: string;
    booth_no: string;
    freebies: string[];
    guests: string[];
    activities: string[];
    time_slots: string[];
    scarcity: "low" | "mid" | "high" | "";
  }>;
  cosers: Array<{
    name: string;
    dates: string[];
    characters: string[];
    notes: string;
  }>;
  tips: string[];
  warnings: string[];
};

const EMPTY_PARSED: ParsedGuide = {
  meta: { event_guess: "", date_range: "", author: "", kind: "mixed" },
  booths: [],
  cosers: [],
  tips: [],
  warnings: [],
};

const SYSTEM_PROMPT = `你是漫展攻略解析助手。用户会给你一份或多份中文攻略（PDF / 图片 / 文本），请把它们**合并**成一份结构化 JSON。严格按 JSON 输出，不要输出任何解释文字。

字段规范（缺失就填空字符串或空数组）:
{
  "meta": {
    "event_guess": "推测的展会全名，如 BiliBili World 2026",
    "date_range": "日期范围，如 2026-07-10~2026-07-12 或 7/10-7/12",
    "author": "攻略作者昵称/来源",
    "kind": "booth | coser_roster | route | mixed"
  },
  "booths": [
    {
      "exhibitor": "展商名称，如 猫耳FM",
      "hall": "展馆号，如 1A / 3H / 6.1H",
      "booth_no": "摊位号，可留空",
      "freebies": ["无料/赠品清单"],
      "guests": ["签售嘉宾"],
      "activities": ["互动/活动"],
      "time_slots": ["7/11 14:00 签售"],
      "scarcity": "low | mid | high | ''（限量/爆抢=high，普通派发=low）"
    }
  ],
  "cosers": [
    {
      "name": "coser 昵称",
      "dates": ["7/10","7/11","7/12"（出席日期）],
      "characters": ["每日 cos 角色"],
      "notes": "备注（签售/小镇/摊位等）"
    }
  ],
  "tips": ["3-8 条通用小贴士，短句"],
  "warnings": ["3-5 条特别提醒，如爆款需早排、限购数量等"]
}

约束：
- 只输出 JSON，不要 markdown 代码块围栏，不要注释。
- 内容用中文。名称、编号保持原样。
- 无信息就填空字符串或空数组，不要编造。`;

function stripCodeFence(s: string): string {
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return t;
}

function normalizeParsed(raw: unknown): ParsedGuide {
  const r = (raw ?? {}) as Record<string, unknown>;
  const meta = (r.meta ?? {}) as Record<string, unknown>;
  return {
    meta: {
      event_guess: String(meta.event_guess ?? ""),
      date_range: String(meta.date_range ?? ""),
      author: String(meta.author ?? ""),
      kind: (["booth", "coser_roster", "route", "mixed"] as const).includes(meta.kind as never)
        ? (meta.kind as ParsedGuide["meta"]["kind"])
        : "mixed",
    },
    booths: (Array.isArray(r.booths) ? r.booths : []).slice(0, 200).map((b) => {
      const o = (b ?? {}) as Record<string, unknown>;
      return {
        exhibitor: String(o.exhibitor ?? ""),
        hall: String(o.hall ?? ""),
        booth_no: String(o.booth_no ?? ""),
        freebies: (Array.isArray(o.freebies) ? o.freebies : []).map(String).filter(Boolean),
        guests: (Array.isArray(o.guests) ? o.guests : []).map(String).filter(Boolean),
        activities: (Array.isArray(o.activities) ? o.activities : []).map(String).filter(Boolean),
        time_slots: (Array.isArray(o.time_slots) ? o.time_slots : []).map(String).filter(Boolean),
        scarcity: (["low", "mid", "high"] as const).includes(o.scarcity as never)
          ? (o.scarcity as "low" | "mid" | "high")
          : "",
      };
    }),
    cosers: (Array.isArray(r.cosers) ? r.cosers : []).slice(0, 500).map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        name: String(o.name ?? ""),
        dates: (Array.isArray(o.dates) ? o.dates : []).map(String).filter(Boolean),
        characters: (Array.isArray(o.characters) ? o.characters : []).map(String).filter(Boolean),
        notes: String(o.notes ?? ""),
      };
    }).filter((c) => c.name),
    tips: (Array.isArray(r.tips) ? r.tips : []).slice(0, 12).map(String).filter(Boolean),
    warnings: (Array.isArray(r.warnings) ? r.warnings : []).slice(0, 8).map(String).filter(Boolean),
  };
}

async function callGateway(payload: unknown, apiKey: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "raw-fetch",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI 网关失败 [${res.status}]: ${body.slice(0, 400)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

// -------- parseGuide --------

export const parseGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => ParseInput.parse(v))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const { supabase, userId } = context;

    if (!data.text && data.files.length === 0 && (data.chunks?.length ?? 0) === 0) {
      throw new Error("请至少提供 PDF、图片、Markdown 或粘贴文本");
    }


    // Insert row first (draft)
    const sourceMeta = data.files.map((f) => ({ name: f.name, kind: f.kind, size: f.size }));
    const { data: created, error: ie } = await supabase
      .from("guides")
      .insert({
        user_id: userId,
        event_id: data.event_id ?? null,
        title: data.title ?? null,
        source_kind: data.files.some((f) => f.kind === "pdf")
          ? "pdf"
          : data.files.length > 0
            ? "image"
            : "text",
        source_files: sourceMeta,
        source_text: data.text ?? null,
        status: "parsing",
      })
      .select("id")
      .single();
    if (ie || !created) throw new Error(ie?.message ?? "保存失败");

    try {
      const baseUserBlocks: Array<Record<string, unknown>> = [];
      if (data.text) {
        baseUserBlocks.push({
          type: "text",
          text: `--- 用户粘贴文本 ---\n${data.text}\n--- END ---`,
        });
      }
      for (const f of data.files) {
        if (f.kind === "image") {
          baseUserBlocks.push({ type: "image_url", image_url: { url: f.data_url } });
        } else if (f.kind === "pdf") {
          baseUserBlocks.push({
            type: "file",
            file: { filename: f.name, file_data: f.data_url },
          });
        } else if (f.kind === "markdown") {
          baseUserBlocks.push({
            type: "text",
            text: `--- 文件: ${f.name} (Markdown) ---\n${f.text}\n--- END ---`,
          });
        }
      }

      // Build one or more passes. If chunks were provided, each chunk is an
      // additional text-only pass, appended alongside base blocks.
      const passes: Array<Array<Record<string, unknown>>> = [];
      const chunkList = data.chunks ?? [];
      if (chunkList.length === 0) {
        passes.push([
          { type: "text", text: "请把下列攻略解析为规定的 JSON。" },
          ...baseUserBlocks,
        ]);
      } else {
        chunkList.forEach((chunk, i) => {
          passes.push([
            {
              type: "text",
              text: `这是攻略的第 ${i + 1}/${chunkList.length} 段，请解析成规定 JSON（只针对这一段的内容）。`,
            },
            ...baseUserBlocks,
            { type: "text", text: `--- Chunk ${i + 1} ---\n${chunk}\n--- END ---` },
          ]);
        });
      }

      const results: ParsedGuide[] = [];
      for (const blocks of passes) {
        const payload = {
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: blocks },
          ],
          response_format: { type: "json_object" },
        };
        const rawText = await callGateway(payload, key);
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(rawText);
        } catch {
          parsedJson = JSON.parse(stripCodeFence(rawText));
        }
        results.push(normalizeParsed(parsedJson));
      }

      const parsed = mergeParsed(results);

      const derivedTitle =
        data.title ||
        parsed.meta.event_guess ||
        (data.files[0]?.name.replace(/\.[^.]+$/, "") ?? "未命名攻略");

      await supabase
        .from("guides")
        .update({
          parsed: parsed as unknown as Json,
          status: "ready",
          title: derivedTitle,
          error: null,
        })
        .eq("id", created.id)
        .eq("user_id", userId);
      return { id: created.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabase
        .from("guides")
        .update({
          status: "failed",
          error: msg.slice(0, 500),
          parsed: EMPTY_PARSED as unknown as Json,
        })
        .eq("id", created.id)
        .eq("user_id", userId);
      throw new Error(msg);
    }
  });

// -------- deleteGuide --------

const DeleteInput = z.object({ id: z.string().uuid() });

export const deleteGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => DeleteInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("guides")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function mergeParsed(list: ParsedGuide[]): ParsedGuide {
  if (list.length === 0) return EMPTY_PARSED;
  if (list.length === 1) return list[0];
  const out: ParsedGuide = {
    meta: { event_guess: "", date_range: "", author: "", kind: "mixed" },
    booths: [],
    cosers: [],
    tips: [],
    warnings: [],
  };
  for (const p of list) {
    if (!out.meta.event_guess && p.meta.event_guess) out.meta.event_guess = p.meta.event_guess;
    if (!out.meta.date_range && p.meta.date_range) out.meta.date_range = p.meta.date_range;
    if (!out.meta.author && p.meta.author) out.meta.author = p.meta.author;
  }
  const boothSeen = new Set<string>();
  for (const p of list) {
    for (const b of p.booths) {
      const k = `${b.exhibitor}::${b.hall}::${b.booth_no}`;
      if (boothSeen.has(k)) continue;
      boothSeen.add(k);
      out.booths.push(b);
    }
  }
  const coserSeen = new Set<string>();
  for (const p of list) {
    for (const c of p.cosers) {
      if (!c.name || coserSeen.has(c.name)) continue;
      coserSeen.add(c.name);
      out.cosers.push(c);
    }
  }
  const tipSeen = new Set<string>();
  for (const p of list) for (const t of p.tips) if (!tipSeen.has(t)) { tipSeen.add(t); out.tips.push(t); }
  const warnSeen = new Set<string>();
  for (const p of list) for (const w of p.warnings) if (!warnSeen.has(w)) { warnSeen.add(w); out.warnings.push(w); }
  return out;
}


// -------- personalizeGuide (AI narrative summary) --------

const NarrativeInput = z.object({ guide_id: z.string().uuid() });

export type GuideNarrative = {
  headline: string;
  suggestions: string[];
  route_plan: Array<{ day: string; stops: Array<{ hall: string; why: string }> }>;
};

export const personalizeGuide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => NarrativeInput.parse(v))
  .handler(async ({ data, context }): Promise<GuideNarrative> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const { supabase, userId } = context;

    const { data: g, error: ge } = await supabase
      .from("guides")
      .select("id, parsed, event_id")
      .eq("id", data.guide_id)
      .eq("user_id", userId)
      .single();
    if (ge || !g?.parsed) throw new Error("攻略未解析");
    const parsed = g.parsed as unknown as ParsedGuide;

    // Fetch personal signals
    const [subsRes, recsRes] = await Promise.all([
      supabase.from("subscriptions").select("kind, teacher_name, event_id").eq("user_id", userId),
      supabase.from("records").select("teacher_name, hall").eq("user_id", userId).not("teacher_name", "is", null).limit(500),
    ]);

    const followedTeachers = new Set(
      (subsRes.data ?? []).filter((s) => s.kind === "teacher" && s.teacher_name).map((s) => (s.teacher_name as string).trim()),
    );
    const pastTeachers = new Set((recsRes.data ?? []).map((r) => (r.teacher_name as string).trim()));

    const matchedCosers = parsed.cosers
      .filter((c) => followedTeachers.has(c.name) || pastTeachers.has(c.name))
      .slice(0, 20);

    const hallHits: Record<string, number> = {};
    for (const b of parsed.booths) if (b.hall) hallHits[b.hall] = (hallHits[b.hall] ?? 0) + 1;

    const digest = [
      `展会：${parsed.meta.event_guess || "未知"} ${parsed.meta.date_range}`,
      `攻略含 ${parsed.booths.length} 个展台、${parsed.cosers.length} 位 coser`,
      `我关注的 coser 匹配：${matchedCosers.map((c) => c.name).join("、") || "无"}`,
      `展馆分布：${Object.entries(hallHits).map(([h, n]) => `${h}(${n})`).join("、") || "无"}`,
      `高稀缺无料：${parsed.booths.filter((b) => b.scarcity === "high").map((b) => `${b.exhibitor}(${b.freebies.slice(0, 2).join("/")})`).slice(0, 8).join("；") || "无"}`,
    ].join("\n");

    const payload = {
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "你是漫展参展顾问。基于用户偏好和攻略摘要，生成个性化建议 JSON。严格 JSON，无解释。字段：{headline:一句话总览<=30字, suggestions:[3-5条建议<=40字], route_plan:[{day:'7/10',stops:[{hall:'3H',why:'关注的XX在这里'}]}]}",
        },
        { role: "user", content: digest },
      ],
      response_format: { type: "json_object" },
    };

    const raw = await callGateway(payload, key);
    let parsedJson: Record<string, unknown> = {};
    try {
      parsedJson = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      try {
        parsedJson = JSON.parse(stripCodeFence(raw)) as Record<string, unknown>;
      } catch {
        parsedJson = {};
      }
    }

    const narrative: GuideNarrative = {
      headline: String((parsedJson.headline as string) ?? "").slice(0, 60),
      suggestions: (Array.isArray(parsedJson.suggestions) ? parsedJson.suggestions : []).slice(0, 5).map(String),
      route_plan: (Array.isArray(parsedJson.route_plan) ? parsedJson.route_plan : []).slice(0, 5).map((d) => {
        const o = (d ?? {}) as Record<string, unknown>;
        return {
          day: String(o.day ?? ""),
          stops: (Array.isArray(o.stops) ? o.stops : []).slice(0, 8).map((s) => {
            const so = (s ?? {}) as Record<string, unknown>;
            return { hall: String(so.hall ?? ""), why: String(so.why ?? "") };
          }),
        };
      }),
    };

    await supabase
      .from("guides")
      .update({ personalized: narrative as unknown as Json })
      .eq("id", data.guide_id)
      .eq("user_id", userId);

    return narrative;
  });

// -------- guide_items mutations --------

const AddItemInput = z.object({
  guide_id: z.string().uuid(),
  kind: z.enum(["booth", "coser", "tip"]),
  payload: z.record(z.unknown()),
});

export const addGuideItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => AddItemInput.parse(v))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("guide_items")
      .insert({
        guide_id: data.guide_id,
        user_id: userId,
        kind: data.kind,
        payload: data.payload as Json,
        pinned: true,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "加入失败");
    return { id: row.id };
  });

const ToggleItemInput = z.object({
  id: z.string().uuid(),
  done: z.boolean().optional(),
  pinned: z.boolean().optional(),
});

export const toggleGuideItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => ToggleItemInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: { done?: boolean; pinned?: boolean } = {};
    if (data.done !== undefined) patch.done = data.done;
    if (data.pinned !== undefined) patch.pinned = data.pinned;
    const { error } = await supabase
      .from("guide_items")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
