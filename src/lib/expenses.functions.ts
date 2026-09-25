import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { EXPENSE_CATEGORY_KEYS } from "./schemas";

const ExpenseInput = z.object({
  id: z.string().uuid().optional(),
  event_id: z.string().uuid(),
  category: z.enum(EXPENSE_CATEGORY_KEYS as [string, ...string[]]).default("other"),
  amount: z.number().min(0),
  currency: z.string().max(8).default("CNY"),
  occurred_at: z.string().optional(),
  note: z.string().max(500).optional().nullable(),
});

export const upsertExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => ExpenseInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...fields } = data;
    if (id) {
      const { error } = await supabase.from("expenses").update({ ...fields, user_id: userId })
        .eq("id", id).eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: ins, error } = await supabase.from("expenses").insert({ ...fields, user_id: userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("expenses").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
