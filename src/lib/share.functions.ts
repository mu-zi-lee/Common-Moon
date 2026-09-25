import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CreateInput = z.object({
  record_id: z.string().uuid(),
  ttl_days: z.number().int().min(1).max(365).default(7),
});

export const createShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => CreateInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify user owns the record.
    const { data: rec, error: re } = await supabase
      .from("records")
      .select("id")
      .eq("id", data.record_id)
      .eq("user_id", userId)
      .single();
    if (re || !rec) throw new Error("记录不存在");

    // Reuse an unexpired token if one already exists.
    const { data: existing } = await supabase
      .from("share_tokens")
      .select("token, expires_at")
      .eq("record_id", data.record_id)
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();
    if (existing) return { token: existing.token, expires_at: existing.expires_at };

    const token = crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + data.ttl_days * 86400 * 1000).toISOString();
    const { error } = await supabase.from("share_tokens").insert({
      record_id: data.record_id,
      user_id: userId,
      token,
      expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);
    return { token, expires_at: expiresAt };
  });

export const revokeShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ record_id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("share_tokens")
      .delete()
      .eq("record_id", data.record_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
