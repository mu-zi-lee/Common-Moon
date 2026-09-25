import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { EventWizard, type EventDraft } from "@/components/events/EventWizard";

export const Route = createFileRoute("/_authenticated/events/$id/edit")({
  component: EditEvent,
});

function EditEvent() {
  const navigate = useNavigate();
  const goHome = () => navigate({ to: "/" });
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["event", id, "edit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading || !data) {
    return <AppShell title="载入中" onBack={goHome} hideTabs><div className="h-64 animate-pulse rounded-2xl bg-muted" /></AppShell>;
  }

  const initial: EventDraft = {
    id: data.id,
    name: data.name ?? "",
    year: data.year ?? null,
    city: data.city ?? "",
    venue: data.venue ?? "",
    halls: data.halls ?? [],
    map_image_url: data.map_image_url,
    map_extra_urls: data.map_extra_urls ?? [],
  };

  return (
    <AppShell title="编辑展会" onBack={goHome} hideTabs>
      <EventWizard initial={initial} />
    </AppShell>
  );
}
