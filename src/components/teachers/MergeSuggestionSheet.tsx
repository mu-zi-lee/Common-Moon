import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X, Merge, Loader2 } from "lucide-react";
import { mergeTeachers } from "@/lib/records.functions";

/** Damerau-Levenshtein (simplified, iterative) */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  if (!al) return bl;
  if (!bl) return al;
  const dp = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) dp[i][0] = i;
  for (let j = 0; j <= bl; j++) dp[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[al][bl];
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "").replace(/[·・_\-—–]/g, "");
}

type Cluster = { members: { name: string; count: number }[] };

function buildClusters(names: { name: string; count: number }[]): Cluster[] {
  const parent: Record<number, number> = {};
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };

  names.forEach((_, i) => (parent[i] = i));
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = normalize(names[i].name);
      const b = normalize(names[j].name);
      if (!a || !b) continue;
      const d = distance(a, b);
      const maxLen = Math.max(a.length, b.length);
      // ≤1 char diff for short names, ≤2 for longer, or one contains the other
      const similar = d <= (maxLen <= 3 ? 0 : maxLen <= 6 ? 1 : 2) || a.includes(b) || b.includes(a);
      if (similar) union(i, j);
    }
  }
  const groups: Record<number, number[]> = {};
  names.forEach((_, i) => {
    const r = find(i);
    (groups[r] ??= []).push(i);
  });
  return Object.values(groups)
    .filter((g) => g.length >= 2)
    .map((g) => ({
      members: g.map((i) => names[i]).sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.members.length - a.members.length);
}

export function MergeSuggestionSheet({
  names,
  onClose,
}: {
  names: { name: string; count: number }[];
  onClose: () => void;
}) {
  const clusters = useMemo(() => buildClusters(names), [names]);
  const [keepMap, setKeepMap] = useState<Record<number, string>>(() =>
    Object.fromEntries(clusters.map((c, i) => [i, c.members[0].name])),
  );
  const qc = useQueryClient();
  const mergeFn = useServerFn(mergeTeachers);
  const [busyIdx, setBusyIdx] = useState<number | null>(null);

  const merge = useMutation({
    mutationFn: async ({ keep, drop }: { keep: string; drop: string[] }) =>
      mergeFn({ data: { keep, drop } }),
    onSuccess: (res) => {
      toast.success(`已合并 ${res.updated} 条记录`);
      qc.invalidateQueries({ queryKey: ["teachers-aggregate"] });
      qc.invalidateQueries({ queryKey: ["records"] });
    },
    onError: (e: Error) => toast.error(e.message || "合并失败"),
    onSettled: () => setBusyIdx(null),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-background pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-divider bg-background/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="eyebrow">Merge</p>
            <h2 className="display-title mt-1 text-[22px]">相似昵称</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {clusters.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="display-title text-[36px] text-foreground/15">Clean</p>
            <p className="mt-2 text-xs text-muted-foreground">没有发现相似昵称</p>
          </div>
        ) : (
          <ul className="divide-y divide-divider px-5">
            {clusters.map((c, idx) => {
              const keep = keepMap[idx];
              const drop = c.members.map((m) => m.name).filter((n) => n !== keep);
              return (
                <li key={idx} className="py-5">
                  <p className="eyebrow mb-3">{c.members.length} 个候选 · 保留哪个？</p>
                  <div className="space-y-2">
                    {c.members.map((m) => {
                      const active = keep === m.name;
                      return (
                        <button
                          key={m.name}
                          onClick={() => setKeepMap((s) => ({ ...s, [idx]: m.name }))}
                          className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                            active
                              ? "border-foreground bg-foreground/5"
                              : "border-divider hover:border-foreground/40"
                          }`}
                        >
                          <span className="font-medium">{m.name}</span>
                          <span className="text-[11px] tabular text-muted-foreground">{m.count} 次</span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    disabled={busyIdx === idx || drop.length === 0}
                    onClick={() => {
                      setBusyIdx(idx);
                      merge.mutate({ keep, drop });
                    }}
                    className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-xs font-semibold uppercase tracking-wider text-background disabled:opacity-40"
                  >
                    {busyIdx === idx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Merge className="h-3.5 w-3.5" />}
                    合并到 {keep}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
