import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { StorageImage } from "@/components/StorageImage";
import { MERCH_KINDS, type MerchKind } from "@/lib/schemas";
import { Plus, Package, Heart } from "lucide-react";

const searchSchema = z.object({
  kind: z.enum(["all", ...MERCH_KINDS.map((k) => k.key)] as [string, ...string[]]).optional().catch("all"),
});

export const Route = createFileRoute("/_authenticated/collection/")({
  component: CollectionList,
  validateSearch: searchSchema,
});

type Row = {
  id: string;
  kind: string;
  name: string;
  source: string | null;
  price: number | null;
  currency: string;
  photo_urls: string[];
  favorite: boolean;
  rating: number;
  acquired_at: string;
  event_id: string | null;
  events: { name: string } | { name: string }[] | null;
};

function evName(e: Row["events"]): string | null {
  if (!e) return null;
  if (Array.isArray(e)) return e[0]?.name ?? null;
  return e.name ?? null;
}

function CollectionList() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const activeKind = search.kind ?? "all";

  const q = useQuery({
    queryKey: ["merch-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merch")
        .select("id, kind, name, source, price, currency, photo_urls, favorite, rating, acquired_at, event_id, events(name)")
        .order("acquired_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const items = useMemo(() => {
    const rows = q.data ?? [];
    if (activeKind === "all") return rows;
    return rows.filter((r) => r.kind === activeKind);
  }, [q.data, activeKind]);

  const totalSpend = useMemo(() => {
    const rows = q.data ?? [];
    return rows.reduce((s, r) => s + (r.price ?? 0), 0);
  }, [q.data]);

  return (
    <AppShell
      eyebrow="Collection"
      title="收藏册"
      right={
        <Link
          to="/collection/new"
          className="rounded-full bg-foreground p-2 text-background active:scale-95"
          aria-label="新增"
        >
          <Plus className="h-4 w-4" />
        </Link>
      }
    >
      {/* Total */}
      <div className="hairline-b pb-4">
        <p className="eyebrow">Total</p>
        <div className="mt-1 flex items-baseline gap-3">
          <p className="display-title text-[42px] tabular">{q.data?.length ?? 0}</p>
          <p className="text-sm text-muted-foreground">
            件 · ¥ <span className="tabular text-foreground">{totalSpend.toLocaleString()}</span>
          </p>
        </div>
      </div>

      {/* Kind chips */}
      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(["all", ...MERCH_KINDS.map((k) => k.key)] as (MerchKind | "all")[]).map((k) => {
          const active = activeKind === k;
          const label = k === "all" ? "全部" : MERCH_KINDS.find((m) => m.key === k)?.label ?? k;
          const cnt = k === "all" ? (q.data?.length ?? 0) : (q.data ?? []).filter((r) => r.kind === k).length;
          return (
            <button
              key={k}
              onClick={() => navigate({ search: { kind: k === "all" ? undefined : k }, replace: true })}
              className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[11px] tracking-wider uppercase transition ${
                active ? "bg-foreground text-background" : "bg-surface-1 text-foreground/70"
              }`}
            >
              {label}
              {cnt > 0 && <span className="opacity-70 tabular">{cnt}</span>}
            </button>
          );
        })}
      </div>

      {q.isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square shimmer rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-divider p-12 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.4} />
          <p className="display-title mt-3 text-[26px] text-foreground/40">Empty</p>
          <p className="mt-2 text-xs text-muted-foreground">周边、门票、礼物、拍立得都可以收进来</p>
          <Link
            to="/collection/new"
            className="mt-5 inline-flex h-10 items-center gap-1 rounded-full bg-foreground px-5 text-xs font-semibold text-background active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> 新增第一件
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3">
          {items.map((r) => (
            <li key={r.id}>
              <Link
                to="/collection/$id"
                params={{ id: r.id }}
                className="group block active:scale-[0.985] transition ease-editorial"
              >
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
                  {r.photo_urls[0] ? (
                    <StorageImage bucket="merch" path={r.photo_urls[0]} className="h-full w-full" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Package className="h-8 w-8" strokeWidth={1.2} />
                    </div>
                  )}
                  {r.favorite && (
                    <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground/90 text-background">
                      <Heart className="h-3 w-3 fill-current" strokeWidth={0} />
                    </div>
                  )}
                </div>
                <div className="mt-2 px-0.5">
                  <p className="truncate display-title text-[16px]">{r.name}</p>
                  <div className="mt-0.5 flex items-baseline justify-between text-[10px] text-muted-foreground/80">
                    <span className="truncate">{evName(r.events) ?? r.source ?? MERCH_KINDS.find((k) => k.key === r.kind)?.label}</span>
                    {r.price != null && (
                      <span className="tabular text-foreground">¥{r.price}</span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
