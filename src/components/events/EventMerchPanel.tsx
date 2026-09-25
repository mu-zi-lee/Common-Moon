import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Package, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StorageImage } from "@/components/StorageImage";
import { MERCH_KINDS } from "@/lib/schemas";

type Row = {
  id: string;
  kind: string;
  name: string;
  price: number | null;
  currency: string;
  photo_urls: string[];
  favorite: boolean;
};

export function EventMerchPanel({ eventId }: { eventId: string }) {
  const q = useQuery({
    queryKey: ["event-merch", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merch")
        .select("id, kind, name, price, currency, photo_urls, favorite, acquired_at")
        .eq("event_id", eventId)
        .order("acquired_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = q.data ?? [];
  const total = rows.reduce((s, r) => s + (r.price ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between hairline-b pb-3">
        <div>
          <p className="eyebrow">Loot</p>
          <p className="mt-0.5 display-title text-[28px] tabular">{rows.length} <span className="text-[14px] text-muted-foreground">件</span></p>
        </div>
        <p className="text-xs text-muted-foreground">共 ¥<span className="tabular text-foreground">{total.toLocaleString()}</span></p>
      </div>

      <Link
        to="/collection/new"
        search={{ event: eventId }}
        className="flex items-center justify-center gap-1 rounded-full bg-foreground py-3 text-xs font-semibold text-background active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" /> 新增战利品
      </Link>

      {q.isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="aspect-square shimmer rounded-2xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-divider p-8 text-center text-xs text-muted-foreground">这场展会还没有战利品</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link to="/collection/$id" params={{ id: r.id }} className="block active:scale-[0.985] transition">
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
                  {r.photo_urls[0] ? (
                    <StorageImage bucket="merch" path={r.photo_urls[0]} className="h-full w-full" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Package className="h-8 w-8" strokeWidth={1.2} /></div>
                  )}
                  {r.favorite && (
                    <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground/90 text-background">
                      <Heart className="h-3 w-3 fill-current" strokeWidth={0} />
                    </div>
                  )}
                </div>
                <div className="mt-2 px-0.5">
                  <p className="truncate display-title text-[15px]">{r.name}</p>
                  <div className="mt-0.5 flex items-baseline justify-between text-[10px] text-muted-foreground/80">
                    <span>{MERCH_KINDS.find((k) => k.key === r.kind)?.label}</span>
                    {r.price != null && <span className="tabular text-foreground">¥{r.price}</span>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
