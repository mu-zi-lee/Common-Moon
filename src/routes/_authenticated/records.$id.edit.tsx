import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { RecordForm, type RecordDraft } from "@/components/records/RecordForm";

export const Route = createFileRoute("/_authenticated/records/$id/edit")({
  component: EditRecord,
});

function EditRecord() {
  const navigate = useNavigate();
  const goHome = () => navigate({ to: "/" });
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["record", id, "edit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("records")
        .select("*, contacts(platform, handle), record_tags(tags(name))")
        .eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading || !data) return <AppShell title="载入中" onBack={goHome} hideTabs><div className="h-64 animate-pulse rounded-2xl bg-muted" /></AppShell>;

  const initial: RecordDraft = {
    id: data.id,
    photo_url: data.photo_url,
    photo_urls: (data.photo_urls ?? []).length > 0 ? data.photo_urls : (data.photo_url ? [data.photo_url] : []),
    teacher_name: data.teacher_name ?? "",
    character_name: data.character_name ?? "",
    anime_name: data.anime_name ?? "",
    hall: data.hall ?? "",
    booth: data.booth ?? "",
    event_id: data.event_id,
    new_event_name: "",
    marker_x: data.marker_x,
    marker_y: data.marker_y,
    note: data.note ?? "",
    favorite: data.favorite,
    rating: data.rating,
    interactions: (data.interactions ?? []) as string[],
    contacts: (data.contacts ?? []).map((c: { platform: string; handle: string }) => ({ platform: c.platform, handle: c.handle })),
    tags: (data.record_tags ?? []).map((rt: { tags: { name: string } | null }) => rt.tags?.name).filter(Boolean) as string[],
    occurred_at: data.occurred_at,
  };


  return (
    <AppShell title="编辑记录" onBack={goHome} hideTabs>
      <RecordForm initial={initial} />
    </AppShell>
  );
}
