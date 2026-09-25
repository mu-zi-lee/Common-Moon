import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { RecordForm, type RecordDraft } from "@/components/records/RecordForm";

const searchSchema = z.object({
  event: z.string().uuid().optional().catch(undefined),
  hall: z.string().optional().catch(undefined),
  mx: z.coerce.number().min(0).max(1).optional().catch(undefined),
  my: z.coerce.number().min(0).max(1).optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/records/new")({
  component: NewRecord,
  validateSearch: searchSchema,
});

function NewRecord() {
  const navigate = useNavigate();
  const goHome = () => navigate({ to: "/" });
  const { event, hall, mx, my } = Route.useSearch();
  const key = `${event ?? "none"}:${hall ?? ""}:${mx ?? ""}:${my ?? ""}`;
  const initial: RecordDraft | undefined = event
    ? {
        photo_url: null,
        photo_urls: [],
        teacher_name: "",
        character_name: "",
        anime_name: "",
        hall: hall ?? "",
        booth: "",
        event_id: event,
        new_event_name: "",
        marker_x: mx ?? null,
        marker_y: my ?? null,
        note: "",
        favorite: false,
        rating: 0,
        interactions: [],
        contacts: [],
        tags: [],
        occurred_at: new Date().toISOString(),
      }
    : undefined;

  return (
    <AppShell title="新增记录" onBack={goHome} hideTabs>
      <RecordForm key={key} initial={initial} />
    </AppShell>
  );
}
