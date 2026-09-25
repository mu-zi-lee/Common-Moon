import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { LogOut, Palette, Download, Upload, BarChart3, Map as MapIcon, Sparkles, Package, Users, Bell, ChevronRight, Pencil, X, Camera } from "lucide-react";
import { uploadImage, getSignedUrl, readAsDataUrl } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/me/")({
  component: MePage,
});

type ImportPayload = {
  records?: unknown[];
  events?: unknown[];
  contacts?: unknown[];
  tags?: unknown[];
  record_tags?: unknown[];
};

function MePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);

  const profile = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.user!.id).maybeSingle();
      return { email: user.user?.email ?? "", profile: p, userId: user.user?.id };
    },
  });

  const subs = useQuery({
    queryKey: ["my-subscriptions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("id, kind, event_id, teacher_name, events(id, name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function exportData() {
    const [records, events, contacts, tags, rt] = await Promise.all([
      supabase.from("records").select("*"),
      supabase.from("events").select("*"),
      supabase.from("contacts").select("*"),
      supabase.from("tags").select("*"),
      supabase.from("record_tags").select("*"),
    ]);
    const blob = new Blob(
      [JSON.stringify({
        exported_at: new Date().toISOString(),
        version: 1,
        records: records.data, events: events.data, contacts: contacts.data, tags: tags.data, record_tags: rt.data,
      }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `coslog-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("已导出");
  }

  async function importData(file: File) {
    const userId = profile.data?.userId;
    if (!userId) { toast.error("未登录"); return; }
    if (!confirm("导入会合并到现有数据（不会删除已有内容）。继续？")) return;

    try {
      const text = await file.text();
      const payload: ImportPayload = JSON.parse(text);
      let ok = 0, fail = 0;

      // Events first (records reference event_id)
      if (payload.events?.length) {
        const rows = payload.events.map((e) => ({ ...(e as Record<string, unknown>), user_id: userId }));
        const { error } = await supabase.from("events").upsert(rows as never, { onConflict: "id" });
        if (error) fail += rows.length; else ok += rows.length;
      }
      if (payload.tags?.length) {
        const rows = payload.tags.map((t) => ({ ...(t as Record<string, unknown>), user_id: userId }));
        const { error } = await supabase.from("tags").upsert(rows as never, { onConflict: "id" });
        if (error) fail += rows.length; else ok += rows.length;
      }
      if (payload.records?.length) {
        const rows = payload.records.map((r) => ({ ...(r as Record<string, unknown>), user_id: userId }));
        const { error } = await supabase.from("records").upsert(rows as never, { onConflict: "id" });
        if (error) fail += rows.length; else ok += rows.length;
      }
      if (payload.contacts?.length) {
        const rows = payload.contacts.map((c) => ({ ...(c as Record<string, unknown>), user_id: userId }));
        const { error } = await supabase.from("contacts").upsert(rows as never, { onConflict: "id" });
        if (error) fail += rows.length; else ok += rows.length;
      }
      if (payload.record_tags?.length) {
        const rows = payload.record_tags.map((rt) => ({ ...(rt as Record<string, unknown>), user_id: userId }));
        const { error } = await supabase.from("record_tags").upsert(rows as never, { onConflict: "record_id,tag_id" });
        if (error) fail += rows.length; else ok += rows.length;
      }

      qc.invalidateQueries();
      toast.success(`导入完成 · 成功 ${ok} 条${fail ? ` · 失败 ${fail}` : ""}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "解析失败，请确认 JSON 文件");
    }
  }

  return (
    <AppShell title="我的">
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <Avatar path={profile.data?.profile?.avatar_url ?? null} fallback={(profile.data?.profile?.nickname?.[0] ?? profile.data?.email?.[0] ?? "?").toUpperCase()} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{profile.data?.profile?.nickname || "未设置昵称"}</p>
            <p className="truncate text-xs text-muted-foreground">{profile.data?.email}</p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground active:scale-95"
            aria-label="编辑资料"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>

      {editing && profile.data?.userId && (
        <ProfileEditor
          userId={profile.data.userId}
          currentNickname={profile.data.profile?.nickname ?? ""}
          currentAvatarPath={profile.data.profile?.avatar_url ?? null}
          onClose={() => setEditing(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["me"] }); setEditing(false); }}
        />
      )}

      {/* Following */}
      {(subs.data?.length ?? 0) > 0 && (
        <section className="mt-5">
          <div className="mb-2 flex items-baseline justify-between hairline-b pb-2">
            <div>
              <p className="eyebrow flex items-center gap-1"><Bell className="h-3 w-3" /> Following</p>
              <h2 className="display-title mt-0.5 text-[20px]">我的关注 <span className="text-muted-foreground tabular text-[14px]">{subs.data?.length}</span></h2>
            </div>
          </div>
          <ul className="divide-y divide-divider rounded-3xl bg-surface-1">
            {(subs.data ?? []).map((s) => {
              const ev = Array.isArray(s.events) ? s.events[0] : s.events;
              const isEvent = s.kind === "event";
              const label = isEvent ? (ev?.name ?? "展会") : (s.teacher_name ?? "老师");
              return (
                <li key={s.id}>
                  {isEvent && ev?.id ? (
                    <Link to="/events/$id" params={{ id: ev.id }} className="flex items-center gap-3 px-4 py-3 active:bg-muted">
                      <span className="text-lg">🎪</span>
                      <span className="flex-1 truncate text-sm">{label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ) : !isEvent && s.teacher_name ? (
                    <Link to="/teachers/$name" params={{ name: encodeURIComponent(s.teacher_name) }} className="flex items-center gap-3 px-4 py-3 active:bg-muted">
                      <span className="text-lg">👤</span>
                      <span className="flex-1 truncate text-sm">{label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">{label}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-4 overflow-hidden rounded-3xl border border-border bg-card">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground">
            <Palette className="h-5 w-5" />
          </span>
          <span className="flex-1 text-sm font-medium">外观</span>
          <ThemeToggle />
        </div>
        <div className="border-t border-border">
          <RowButton icon={<Users className="h-5 w-5" />} label="老师" onClick={() => navigate({ to: "/teachers" })} />
        </div>
        <div className="border-t border-border">
          <RowButton icon={<Package className="h-5 w-5" />} label="收藏册" onClick={() => navigate({ to: "/collection" })} />
        </div>
        <div className="border-t border-border">
          <RowButton icon={<BarChart3 className="h-5 w-5" />} label="统计洞察" onClick={() => navigate({ to: "/stats" })} />
        </div>

        <div className="border-t border-border">
          <RowButton icon={<Sparkles className="h-5 w-5" />} label={`${new Date().getFullYear()} 年度回顾`} onClick={() => navigate({ to: "/me/wrapped/$year", params: { year: new Date().getFullYear() } })} />
        </div>
        <div className="border-t border-border">
          <RowButton icon={<MapIcon className="h-5 w-5" />} label="展会地图墙" onClick={() => navigate({ to: "/map" })} />
        </div>
        <div className="border-t border-border">
          <RowButton icon={<Download className="h-5 w-5" />} label="导出数据 (JSON)" onClick={exportData} />
        </div>
        <div className="border-t border-border">
          <RowButton icon={<Upload className="h-5 w-5" />} label="从 JSON 导入" onClick={() => fileRef.current?.click()} />
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importData(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <button onClick={handleSignOut} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border font-medium text-destructive active:scale-[0.98]">
        <LogOut className="h-5 w-5" />退出登录
      </button>

      <p className="mt-6 text-center text-xs text-muted-foreground">CosLog · 记录每一次遇见</p>
    </AppShell>
  );
}

function RowButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-muted">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground">{icon}</span>
      <span className="flex-1 text-sm font-medium">{label}</span>
    </button>
  );
}

function Avatar({ path, fallback }: { path: string | null; fallback: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(null); return; }
    if (path.startsWith("http") || path.startsWith("data:")) { setUrl(path); return; }
    getSignedUrl("avatars", path).then((u) => { if (!cancelled) setUrl(u); }).catch(() => { if (!cancelled) setUrl(null); });
    return () => { cancelled = true; };
  }, [path]);
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted text-lg font-semibold">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : fallback}
    </div>
  );
}

function ProfileEditor({
  userId,
  currentNickname,
  currentAvatarPath,
  onClose,
  onSaved,
}: {
  userId: string;
  currentNickname: string;
  currentAvatarPath: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nickname, setNickname] = useState(currentNickname);
  const [avatarPath, setAvatarPath] = useState<string | null>(currentAvatarPath);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!currentAvatarPath) { setPreviewUrl(null); return; }
    if (currentAvatarPath.startsWith("http") || currentAvatarPath.startsWith("data:")) { setPreviewUrl(currentAvatarPath); return; }
    getSignedUrl("avatars", currentAvatarPath).then((u) => { if (!cancelled) setPreviewUrl(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, [currentAvatarPath]);

  async function handlePick(file: File) {
    setUploading(true);
    try {
      const dataUrl = await readAsDataUrl(file);
      setPreviewUrl(dataUrl);
      const path = await uploadImage("avatars", file);
      setAvatarPath(path);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, nickname: nickname.trim() || null, avatar_url: avatarPath }, { onConflict: "id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("已保存");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">编辑资料</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted" aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => fileInput.current?.click()}
            className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-2xl font-semibold active:scale-95"
          >
            {previewUrl ? (
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (nickname[0] ?? "?").toUpperCase()
            )}
            <span className="absolute inset-x-0 bottom-0 flex h-6 items-center justify-center bg-black/50 text-white">
              <Camera className="h-3.5 w-3.5" />
            </span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePick(f);
              e.target.value = "";
            }}
          />
          {uploading && <p className="text-xs text-muted-foreground">上传中…</p>}
        </div>

        <div className="mt-5">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">昵称</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={30}
            placeholder="给自己起个名字"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-border py-3 text-sm font-medium active:bg-muted">
            取消
          </button>
          <button
            onClick={save}
            disabled={saving || uploading}
            className="flex-1 rounded-2xl bg-primary py-3 text-sm font-medium text-primary-foreground active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
