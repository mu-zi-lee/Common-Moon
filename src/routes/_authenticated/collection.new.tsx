import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { MerchForm, emptyMerch } from "@/components/merch/MerchForm";

const searchSchema = z.object({
  event: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/collection/new")({
  component: NewMerch,
  validateSearch: searchSchema,
});

function NewMerch() {
  const navigate = useNavigate();
  const goHome = () => navigate({ to: "/" });
  const { event } = Route.useSearch();
  const initial = event ? { ...emptyMerch, event_id: event } : undefined;
  return (
    <AppShell title="新增收藏" onBack={goHome} hideTabs>
      <MerchForm initial={initial} />
    </AppShell>
  );
}
