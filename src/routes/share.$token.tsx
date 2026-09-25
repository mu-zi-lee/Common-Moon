import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { getSharedRecord } from "@/lib/share-public.functions";

export const Route = createFileRoute("/share/$token")({
  loader: async ({ params }) => {
    const data = await getSharedRecord({ data: { token: params.token } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [] };
    const title = [loaderData.teacher_name, loaderData.character_name]
      .filter(Boolean)
      .join(" · ") || "CosLog 分享";
    const desc =
      [loaderData.event?.name, loaderData.anime_name, loaderData.hall]
        .filter(Boolean)
        .join(" · ") || "来自 CosLog 的 cosplayer 遇见记录";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        ...(loaderData.photoUrl
          ? [
              { property: "og:image", content: loaderData.photoUrl },
              { name: "twitter:card", content: "summary_large_image" },
              { name: "twitter:image", content: loaderData.photoUrl },
            ]
          : [{ name: "twitter:card", content: "summary" }]),
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <h1 className="text-lg font-semibold">链接失效</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Link to="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-foreground px-6 text-sm text-background">
          回首页
        </Link>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <p className="display-title text-[48px] text-foreground/15">Expired</p>
        <h1 className="mt-4 text-lg font-semibold">链接已失效</h1>
        <p className="mt-2 text-sm text-muted-foreground">分享链接可能已过期或被撤回。</p>
      </div>
    </div>
  ),
  component: SharePage,
});

function SharePage() {
  const d = Route.useLoaderData();
  const dateStr = new Date(d.occurred_at).toLocaleDateString("zh-CN", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-md px-5 pb-16 pt-8">
        <p className="eyebrow">CosLog · Shared</p>
        <h1 className="display-title mt-2 text-[32px] leading-tight">
          {d.teacher_name || d.character_name || "Cosplay 记录"}
        </h1>
        {(d.character_name || d.anime_name) && (
          <p className="mt-1 text-sm text-muted-foreground">
            {[d.character_name, d.anime_name].filter(Boolean).join(" · ")}
          </p>
        )}

        {d.photoUrl && (
          <div className="mt-6 overflow-hidden rounded-3xl bg-surface-1">
            <img
              src={d.photoUrl}
              alt={d.character_name ?? d.teacher_name ?? "cosplay"}
              className="w-full object-cover"
              loading="eager"
            />
          </div>
        )}

        <dl className="mt-6 space-y-3 text-sm">
          {d.event && (
            <Row label="展会">
              {d.event.name}
              {d.event.year ? ` · ${d.event.year}` : ""}
              {d.event.city ? ` · ${d.event.city}` : ""}
            </Row>
          )}
          {d.hall && <Row label="展馆">{d.hall}</Row>}
          <Row label="时间">{dateStr}</Row>
          {d.note && <Row label="备注">{d.note}</Row>}
        </dl>

        <div className="mt-10 border-t border-divider pt-6 text-center text-xs text-muted-foreground">
          <p>由 <span className="font-semibold text-foreground">CosLog</span> 生成的分享</p>
          <Link
            to="/"
            className="mt-3 inline-flex h-9 items-center rounded-full border border-divider px-4 text-[11px] uppercase tracking-wider"
          >
            记录你自己的 · 遇见
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-14 shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground pt-0.5">
        {label}
      </dt>
      <dd className="flex-1 text-foreground/90">{children}</dd>
    </div>
  );
}
