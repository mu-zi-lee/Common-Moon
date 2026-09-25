import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { GuideUploader } from "@/components/guides/GuideUploader";

const searchSchema = z.object({
  event: z.string().uuid().optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/guides/new")({
  component: NewGuide,
  validateSearch: searchSchema,
});

function NewGuide() {
  const navigate = useNavigate();
  const goHome = () => navigate({ to: "/" });
  const { event } = Route.useSearch();
  return (
    <AppShell title="AI 攻略助手" eyebrow="Guide" onBack={goHome} hideTabs>
      <div className="mb-4 rounded-2xl bg-surface-1 p-3 text-[12px] text-muted-foreground">
        上传别人的展台/coser 攻略（PDF、图片）或粘贴文本，AI 会拆成结构化清单，
        并结合你关注的老师给出个性化行程。
      </div>
      <GuideUploader defaultEventId={event} />
    </AppShell>
  );
}
