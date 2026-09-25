import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { INTERACTION_KEYS } from "./interactions";

const RecordInput = z.object({
  id: z.string().uuid().optional(),
  event_id: z.string().uuid().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  photo_urls: z.array(z.string()).default([]),
  teacher_name: z.string().nullable().optional(),
  character_name: z.string().nullable().optional(),
  anime_name: z.string().nullable().optional(),
  hall: z.string().nullable().optional(),
  booth: z.string().nullable().optional(),
  marker_x: z.number().nullable().optional(),
  marker_y: z.number().nullable().optional(),
  note: z.string().nullable().optional(),
  favorite: z.boolean().default(false),
  rating: z.number().int().min(0).max(5).default(0),
  interactions: z.array(z.enum(INTERACTION_KEYS as [string, ...string[]])).default([]),
  occurred_at: z.string().optional(),
  contacts: z.array(z.object({ platform: z.string(), handle: z.string() })).default([]),
  tags: z.array(z.string()).default([]),
});

export const upsertRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => RecordInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { contacts, tags, id, ...fields } = data;
    let recordId = id;
    if (recordId) {
      const { error } = await supabase.from("records").update({ ...fields, user_id: userId }).eq("id", recordId).eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else {
      const { data: ins, error } = await supabase.from("records").insert({ ...fields, user_id: userId }).select("id").single();
      if (error) throw new Error(error.message);
      recordId = ins.id;
    }
    // contacts: replace all
    await supabase.from("contacts").delete().eq("record_id", recordId);
    if (contacts.length) {
      const rows = contacts.filter(c => c.handle.trim()).map(c => ({ record_id: recordId!, user_id: userId, platform: c.platform, handle: c.handle }));
      if (rows.length) {
        const { error: ce } = await supabase.from("contacts").insert(rows);
        if (ce) throw new Error(ce.message);
      }
    }
    // tags: ensure exist, then replace record_tags
    await supabase.from("record_tags").delete().eq("record_id", recordId);
    if (tags.length) {
      const uniq = Array.from(new Set(tags.map(t => t.trim()).filter(Boolean)));
      for (const name of uniq) {
        await supabase.from("tags").upsert({ user_id: userId, name }, { onConflict: "user_id,name" });
      }
      const { data: tagRows } = await supabase.from("tags").select("id,name").in("name", uniq).eq("user_id", userId);
      if (tagRows?.length) {
        const rt = tagRows.map(t => ({ record_id: recordId!, tag_id: t.id, user_id: userId }));
        await supabase.from("record_tags").insert(rt);
      }
    }
    return { id: recordId! };
  });

export const deleteRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("records").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1),
    year: z.number().int().optional().nullable(),
    city: z.string().optional().nullable(),
    venue: z.string().optional().nullable(),
    halls: z.array(z.string()).optional(),
    map_image_url: z.string().optional().nullable(),
    map_extra_urls: z.array(z.string()).optional(),
  }).parse(v))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase.from("events").update({ ...data, user_id: context.userId }).eq("id", data.id).eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase.from("events").insert({ ...data, user_id: context.userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("events").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Merge teachers: rename every record whose `teacher_name` matches any of `drop`
 * so it becomes `keep`. Copies contacts too (best-effort, RLS filters to owner).
 */
export const mergeTeachers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    keep: z.string().min(1),
    drop: z.array(z.string().min(1)).min(1),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const targets = data.drop.filter((n) => n !== data.keep);
    if (targets.length === 0) return { updated: 0 };
    const { data: updated, error } = await supabase
      .from("records")
      .update({ teacher_name: data.keep })
      .eq("user_id", userId)
      .in("teacher_name", targets)
      .select("id");
    if (error) throw new Error(error.message);
    return { updated: updated?.length ?? 0 };
  });
