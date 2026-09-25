import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { EventWizard } from "@/components/events/EventWizard";

export const Route = createFileRoute("/_authenticated/events/new")({
  component: NewEvent,
});

function NewEvent() {
  const navigate = useNavigate();
  const goHome = () => navigate({ to: "/" });
  return (
    <AppShell title="新建展会" onBack={goHome} hideTabs>
      <EventWizard />
    </AppShell>
  );
}
