import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { MerchForm, type MerchDraft } from "@/components/merch/MerchForm";
import type { MerchKind } from "@/lib/schemas";

export const Route = createFileRoute("/_authenticated/collection/$id/edit")({
  component: EditMerch,
});

function EditMerch() {
  const navigate = useNavigate();
  const goHome = () => navigate({ to: "/" });
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["merch", id, "edit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("merch").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  if (q.isLoading || !q.data) {
    return (
      <AppShell title="载入中" onBack={goHome} hideTabs>
        <div className="h-64 shimmer rounded-3xl" />
      </AppShell>
    );
  }

  const r = q.data;
  const initial: MerchDraft = {
    id: r.id,
    event_id: r.event_id,
    kind: (r.kind as MerchKind) ?? "goods",
    name: r.name,
    source: r.source ?? "",
    price: r.price != null ? String(r.price) : "",
    currency: r.currency ?? "CNY",
    photo_urls: r.photo_urls ?? [],
    note: r.note ?? "",
    acquired_at: r.acquired_at,
    rating: r.rating,
    favorite: r.favorite,
  };

  return (
    <AppShell title="编辑收藏" onBack={goHome} hideTabs>
      <MerchForm initial={initial} />
    </AppShell>
  );
}
