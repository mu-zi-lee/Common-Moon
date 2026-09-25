import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { upsertExpense, deleteExpense } from "@/lib/expenses.functions";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/schemas";

type Row = {
  id: string;
  category: string;
  amount: number;
  currency: string;
  occurred_at: string;
  note: string | null;
};

export function EventExpensesPanel({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertExpense);
  const delFn = useServerFn(deleteExpense);
  const [category, setCategory] = useState<ExpenseCategory>("ticket");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const q = useQuery({
    queryKey: ["event-expenses", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, category, amount, currency, occurred_at, note")
        .eq("event_id", eventId)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const n = Number(amount);
      if (!isFinite(n) || n <= 0) throw new Error("请输入金额");
      await upsertFn({
        data: {
          event_id: eventId,
          category,
          amount: n,
          currency: "CNY",
          occurred_at: new Date().toISOString(),
          note: note || null,
        },
      });
    },
    onSuccess: () => {
      setAmount("");
      setNote("");
      toast.success("已记录");
      qc.invalidateQueries({ queryKey: ["event-expenses", eventId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "失败"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await delFn({ data: { id } }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event-expenses", eventId] }),
  });

  const rows = q.data ?? [];
  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const byCat = new Map<string, number>();
  for (const r of rows) byCat.set(r.category, (byCat.get(r.category) ?? 0) + Number(r.amount || 0));

  return (
    <div className="space-y-4">
      {/* Total */}
      <div className="rounded-3xl bg-surface-1 p-4">
        <p className="eyebrow">Total spent</p>
        <p className="mt-1 display-title text-[38px] tabular">¥{total.toLocaleString()}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXPENSE_CATEGORIES.filter((c) => byCat.get(c.key)).map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-[11px]">
              <span>{c.emoji}</span>
              <span className="text-muted-foreground">{c.label}</span>
              <span className="tabular">¥{(byCat.get(c.key) ?? 0).toLocaleString()}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Add form */}
      <div className="rounded-3xl border border-divider p-3">
        <div className="flex gap-1.5 overflow-x-auto pb-2">
          {EXPENSE_CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs ${active ? "bg-foreground text-background" : "bg-secondary"}`}
              >
                <span>{c.emoji}</span>{c.label}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-stretch gap-2">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="金额"
            className="min-w-0 flex-1 rounded-2xl border border-divider bg-background px-4 h-11 text-base tabular outline-none"
          />
          <button
            onClick={() => add.mutate()}
            disabled={add.isPending || !amount.trim()}
            className="shrink-0 inline-flex h-11 items-center gap-1 rounded-full bg-foreground px-4 text-xs font-semibold text-background disabled:opacity-40"
          >
            <Plus className="h-4 w-4" /> 添加
          </button>
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="备注（可选）"
          className="mt-2 w-full rounded-2xl border border-divider bg-background px-4 h-10 text-sm outline-none"
        />
      </div>

      {/* List */}
      {q.isLoading ? (
        <div className="h-24 shimmer rounded-2xl" />
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-divider p-6 text-center text-xs text-muted-foreground">还没有花费记录</p>
      ) : (
        <ul className="divide-y divide-divider rounded-3xl bg-surface-1">
          {rows.map((r) => {
            const c = EXPENSE_CATEGORIES.find((x) => x.key === r.category);
            return (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-lg">{c?.emoji ?? "📦"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{c?.label ?? r.category}{r.note && <span className="ml-1 text-muted-foreground">· {r.note}</span>}</p>
                  <p className="text-[11px] text-muted-foreground tabular">{new Date(r.occurred_at).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <span className="tabular text-sm">¥{Number(r.amount).toLocaleString()}</span>
                <button onClick={() => remove.mutate(r.id)} className="p-1 text-muted-foreground active:scale-90"><Trash2 className="h-4 w-4" /></button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
