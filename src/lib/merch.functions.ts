import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { MERCH_KIND_KEYS } from "./schemas";

const MerchInput = z.object({
  id: z.string().uuid().optional(),
  event_id: z.string().uuid().nullable().optional(),
  record_id: z.string().uuid().nullable().optional(),
  kind: z.enum(MERCH_KIND_KEYS as [string, ...string[]]).default("goods"),
  name: z.string().min(1).max(120),
  source: z.string().max(120).optional().nullable(),
  price: z.number().nonnegative().optional().nullable(),
  currency: z.string().max(8).default("CNY"),
  photo_urls: z.array(z.string()).default([]),
  note: z.string().max(2000).optional().nullable(),
  acquired_at: z.string().optional(),
  rating: z.number().int().min(0).max(5).default(0),
  favorite: z.boolean().default(false),
});

export const upsertMerch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => MerchInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...fields } = data;
    if (id) {
      const { error } = await supabase.from("merch").update({ ...fields, user_id: userId })
        .eq("id", id).eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: ins, error } = await supabase.from("merch").insert({ ...fields, user_id: userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteMerch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("merch").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
