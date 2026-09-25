import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { StorageImage } from "@/components/StorageImage";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { deleteMerch } from "@/lib/merch.functions";
import { MERCH_KINDS } from "@/lib/schemas";
import { Edit2, Trash2, Heart, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/collection/$id/")({
  component: MerchDetail,
});

function MerchDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const delFn = useServerFn(deleteMerch);
  const [lightbox, setLightbox] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });

  const q = useQuery({
    queryKey: ["merch", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merch")
        .select("*, events(id, name, year, city)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("已删除");
      navigate({ to: "/collection" });
    },
  });

  if (q.isLoading || !q.data) {
    return (
      <AppShell title="载入中" onBack={() => history.back()} hideTabs>
        <div className="h-64 shimmer rounded-3xl" />
      </AppShell>
    );
  }

  const r = q.data;
  const kind = MERCH_KINDS.find((k) => k.key === r.kind)?.label ?? r.kind;
  const ev = r.events as { id?: string; name?: string; year?: number | null; city?: string | null } | null;
  const photos: string[] = r.photo_urls ?? [];
  const acquired = new Date(r.acquired_at).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });

  return (
    <AppShell title={r.name} onBack={() => history.back()} hideTabs>
      {photos.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={p}
              onClick={() => setLightbox({ open: true, index: i })}
              className="shrink-0"
            >
              <StorageImage bucket="merch" path={p} className="h-56 w-56 rounded-3xl" />
            </button>
          ))}
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
          <Package className="h-10 w-10" strokeWidth={1.2} />
        </div>
      )}

      <div className="mt-4 hairline-b pb-4">
        <div className="flex items-baseline gap-2">
          <span className="rounded-full bg-surface-1 px-2 py-0.5 text-[10px] tracking-wider uppercase text-foreground/70">
            {kind}
          </span>
          {r.favorite && (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background">
              <Heart className="h-3 w-3 fill-current" strokeWidth={0} />
            </span>
          )}
        </div>
        <h1 className="display-title mt-2 text-[26px]">{r.name}</h1>
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        {r.price != null && (
          <Row label="价格">
            <span className="tabular">
              {r.currency === "CNY" ? "¥" : r.currency === "JPY" ? "¥" : r.currency === "USD" ? "$" : r.currency + " "}
              {r.price}
            </span>
          </Row>
        )}
        {r.source && <Row label="来源">{r.source}</Row>}
        {ev?.id && (
          <Row label="展会">
            <Link to="/events/$id" params={{ id: ev.id! }} className="text-foreground underline decoration-divider decoration-dotted">
              {ev.name}
              {ev.year ? ` · ${ev.year}` : ""}
            </Link>
          </Row>
        )}
        <Row label="入手">{acquired}</Row>
        {r.rating > 0 && (
          <Row label="评价">{"★".repeat(r.rating)}<span className="text-muted-foreground">{"☆".repeat(5 - r.rating)}</span></Row>
        )}
        {r.note && <Row label="备注">{r.note}</Row>}
      </dl>

      <div className="fixed inset-x-0 bottom-0 z-30 hairline-t bg-background/95 backdrop-blur-md safe-bottom">
        <div className="mx-auto flex max-w-md gap-2 px-4 py-3">
          <Link
            to="/collection/$id/edit"
            params={{ id }}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-surface-1 text-sm font-medium"
          >
            <Edit2 className="h-4 w-4" /> 编辑
          </Link>
          <button
            onClick={() => { if (confirm("删除这件？")) del.mutate(); }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-1 text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <PhotoLightbox
        photos={photos}
        open={lightbox.open}
        index={lightbox.index}
        onClose={() => setLightbox({ open: false, index: 0 })}
        onIndexChange={(i) => setLightbox({ open: true, index: i })}
        bucket="merch"
      />
    </AppShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 hairline-b pb-3">
      <dt className="w-14 shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground pt-0.5">{label}</dt>
      <dd className="flex-1 text-foreground/90">{children}</dd>
    </div>
  );
}
