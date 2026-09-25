import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { GuideResult } from "@/components/guides/GuideResult";

export const Route = createFileRoute("/_authenticated/guides/$id")({
  component: GuideDetail,
});

function GuideDetail() {
  const { id } = Route.useParams();
  return (
    <AppShell title="AI 攻略" eyebrow="Guide" onBack={() => history.back()} hideTabs>
      <GuideResult guideId={id} />
    </AppShell>
  );
}
