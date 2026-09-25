import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, X, User, Landmark, Camera, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StorageImage } from "@/components/StorageImage";

type Props = { open: boolean; onClose: () => void };

export function GlobalSearchSheet({ open, onClose }: Props) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 40);
    } else {
      setQ("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const term = q.trim();
  const enabled = open && term.length > 0;

  const results = useQuery({
    queryKey: ["global-search", term],
    enabled,
    queryFn: async () => {
      const like = `%${term}%`;
      const [records, events, teachers, merch] = await Promise.all([
        supabase.from("records").select("id, photo_url, teacher_name, character_name, anime_name, occurred_at")
          .or(`teacher_name.ilike.${like},character_name.ilike.${like},anime_name.ilike.${like},note.ilike.${like},booth.ilike.${like}`)
          .order("occurred_at", { ascending: false }).limit(8),
        supabase.from("events").select("id, name, year, city").ilike("name", like).limit(6),
        supabase.from("records").select("teacher_name").ilike("teacher_name", like).not("teacher_name", "is", null).limit(30),
        supabase.from("merch").select("id, name, kind, photo_urls").ilike("name", like).limit(6),
      ]);

      const teacherSet = new Map<string, number>();
      for (const r of teachers.data ?? []) {
        const n = (r.teacher_name ?? "").trim();
        if (n) teacherSet.set(n, (teacherSet.get(n) ?? 0) + 1);
      }
      return {
        records: records.data ?? [],
        events: events.data ?? [],
        teachers: Array.from(teacherSet.entries()).slice(0, 6),
        merch: merch.data ?? [],
      };
    },
  });

  const empty = useMemo(() => {
    if (!results.data) return true;
    const r = results.data;
    return r.records.length + r.events.length + r.teachers.length + r.merch.length === 0;
  }, [results.data]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background/80 backdrop-blur-xl">
      <div className="safe-top hairline-b">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索老师、角色、展会、周边……"
              className="w-full rounded-full border border-divider bg-background pl-9 pr-9 h-11 text-sm outline-none focus:border-foreground/40"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button onClick={onClose} className="rounded-full px-3 py-2 text-sm text-muted-foreground active:scale-95">取消</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md px-4 py-4 space-y-6">
          {!enabled ? (
            <div className="pt-16 text-center">
              <Search className="mx-auto h-8 w-8 text-muted-foreground/40" strokeWidth={1.2} />
              <p className="mt-4 text-xs text-muted-foreground">输入关键词开始搜索</p>
            </div>
          ) : results.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 shimmer rounded-2xl" />)}
            </div>
          ) : empty ? (
            <div className="pt-16 text-center">
              <p className="display-title text-[32px] text-foreground/20">Empty</p>
              <p className="mt-2 text-xs text-muted-foreground">没有匹配 "{term}" 的结果</p>
            </div>
          ) : (
            <>
              {results.data!.teachers.length > 0 && (
                <Group icon={<User className="h-3.5 w-3.5" />} label="老师">
                  {results.data!.teachers.map(([name, cnt]) => (
                    <Link
                      key={name}
                      to="/teachers/$name"
                      params={{ name: encodeURIComponent(name) }}
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-2xl bg-surface-1 px-4 py-3 active:scale-[0.98]"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-sm font-semibold">{name[0]}</div>
                      <span className="flex-1 truncate text-sm">{name}</span>
                      <span className="text-[11px] text-muted-foreground tabular">{cnt} 次</span>
                    </Link>
                  ))}
                </Group>
              )}

              {results.data!.events.length > 0 && (
                <Group icon={<Landmark className="h-3.5 w-3.5" />} label="展会">
                  {results.data!.events.map((e) => (
                    <Link
                      key={e.id}
                      to="/events/$id"
                      params={{ id: e.id }}
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-2xl bg-surface-1 px-4 py-3 active:scale-[0.98]"
                    >
                      <span className="text-lg">🎪</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{e.name}</p>
                        <p className="text-[11px] text-muted-foreground">{[e.year, e.city].filter(Boolean).join(" · ")}</p>
                      </div>
                    </Link>
                  ))}
                </Group>
              )}

              {results.data!.records.length > 0 && (
                <Group icon={<Camera className="h-3.5 w-3.5" />} label="记录">
                  <div className="grid grid-cols-4 gap-2">
                    {results.data!.records.map((r) => (
                      <Link
                        key={r.id}
                        to="/records/$id"
                        params={{ id: r.id }}
                        onClick={onClose}
                        className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted active:scale-[0.97]"
                      >
                        {r.photo_url && <StorageImage bucket="photos" path={r.photo_url} className="h-full w-full object-cover" />}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                          <p className="truncate text-[10px] font-medium text-white">{r.teacher_name || r.character_name || "—"}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </Group>
              )}

              {results.data!.merch.length > 0 && (
                <Group icon={<Package className="h-3.5 w-3.5" />} label="收藏">
                  <div className="grid grid-cols-3 gap-2">
                    {results.data!.merch.map((m) => (
                      <Link
                        key={m.id}
                        to="/collection/$id"
                        params={{ id: m.id }}
                        onClick={onClose}
                        className="active:scale-[0.97]"
                      >
                        <div className="aspect-square overflow-hidden rounded-xl bg-muted">
                          {m.photo_urls?.[0]
                            ? <StorageImage bucket="merch" path={m.photo_urls[0]} className="h-full w-full object-cover" />
                            : <div className="flex h-full items-center justify-center text-muted-foreground"><Package className="h-6 w-6" /></div>}
                        </div>
                        <p className="mt-1 truncate text-[11px]">{m.name}</p>
                      </Link>
                    ))}
                  </div>
                </Group>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="eyebrow mb-2 flex items-center gap-1">{icon} {label}</p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
