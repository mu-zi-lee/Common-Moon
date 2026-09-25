import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CreateInput = z.object({
  teacher_name: z.string().min(1).max(80),
  ttl_days: z.number().int().min(1).max(365).default(30),
});

export const createTeacherShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => CreateInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify the user actually has records with this teacher name.
    const { count, error: ce } = await supabase
      .from("records")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("teacher_name", data.teacher_name);
    if (ce) throw new Error(ce.message);
    if (!count) throw new Error("你没有这位老师的记录");

    const { data: existing } = await supabase
      .from("teacher_share_tokens")
      .select("token, expires_at")
      .eq("user_id", userId)
      .eq("teacher_name", data.teacher_name)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();
    if (existing) return { token: existing.token, expires_at: existing.expires_at };

    const token = crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + data.ttl_days * 86400 * 1000).toISOString();
    const { error } = await supabase.from("teacher_share_tokens").insert({
      user_id: userId,
      teacher_name: data.teacher_name,
      token,
      expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);
    return { token, expires_at: expiresAt };
  });

export const revokeTeacherShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ teacher_name: z.string().min(1) }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("teacher_share_tokens")
      .delete()
      .eq("user_id", context.userId)
      .eq("teacher_name", data.teacher_name);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
