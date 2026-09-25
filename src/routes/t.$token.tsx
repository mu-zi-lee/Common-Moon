import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { getSharedTeacher } from "@/lib/teacher-share-public.functions";

export const Route = createFileRoute("/t/$token")({
  loader: async ({ params }) => {
    const data = await getSharedTeacher({ data: { token: params.token } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [] };
    const title = `${loaderData.teacherName} · CosLog`;
    const desc = `${loaderData.teacherName} 的 ${loaderData.total} 张 cosplay 记录`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        ...(loaderData.heroUrl
          ? [
              { property: "og:image", content: loaderData.heroUrl },
              { name: "twitter:card", content: "summary_large_image" },
              { name: "twitter:image", content: loaderData.heroUrl },
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
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <p className="display-title text-[48px] text-foreground/15">Expired</p>
        <h1 className="mt-4 text-lg font-semibold">链接已失效</h1>
      </div>
    </div>
  ),
  component: TeacherSharePage,
});

function TeacherSharePage() {
  const d = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-md px-5 pb-20 pt-8">
        <p className="eyebrow">CosLog · Teacher</p>
        <h1 className="display-title mt-2 text-[42px] leading-none">{d.teacherName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">共 {d.total} 张记录</p>

        <ul className="mt-8 space-y-6">
          {d.records.map((r: (typeof d.records)[number]) => (
            <li key={r.id} className="rounded-3xl bg-surface-1 overflow-hidden">
              {r.photoUrl && (
                <img
                  src={r.photoUrl}
                  alt={r.character_name ?? ""}
                  className="aspect-[4/5] w-full object-cover"
                  loading="lazy"
                />
              )}
              <div className="p-4">
                <p className="display-title text-[22px]">
                  {r.character_name || "未命名角色"}
                </p>
                {r.anime_name && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.anime_name}</p>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground tabular">
                  {r.event?.name ?? "自由外拍"}
                  {r.event?.year ? ` · ${r.event.year}` : ""}
                  {r.hall ? ` · ${r.hall}` : ""}
                  {" · "}
                  {new Date(r.occurred_at).toLocaleDateString("zh-CN")}
                </p>
                {r.note && (
                  <p className="mt-3 whitespace-pre-wrap text-sm italic text-foreground/85">
                    "{r.note}"
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-12 border-t border-divider pt-6 text-center text-xs text-muted-foreground">
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
