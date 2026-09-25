import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Share2, Loader2, Copy, X } from "lucide-react";
import { createTeacherShare, revokeTeacherShare } from "@/lib/teacher-share.functions";

/**
 * Bottom sheet — mint / copy / revoke a 30-day public share link for
 * every record of one teacher.
 */
export function TeacherShareSheet({
  teacherName,
  open,
  onClose,
}: {
  teacherName: string;
  open: boolean;
  onClose: () => void;
}) {
  const createFn = useServerFn(createTeacherShare);
  const revokeFn = useServerFn(revokeTeacherShare);
  const [creating, setCreating] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  async function generate() {
    setCreating(true);
    try {
      const r = await createFn({ data: { teacher_name: teacherName, ttl_days: 30 } });
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setUrl(`${origin}/t/${r.token}`);
      setExpiresAt(r.expires_at);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成失败");
    } finally {
      setCreating(false);
    }
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success("链接已复制");
  }

  async function revoke() {
    try {
      await revokeFn({ data: { teacher_name: teacherName } });
      setUrl(null);
      setExpiresAt(null);
      toast.success("已撤回分享");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "撤回失败");
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-background p-6 safe-bottom shadow-editorial"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-divider" />
        <div className="flex items-baseline justify-between hairline-b pb-3">
          <div>
            <p className="eyebrow">Teacher share</p>
            <h3 className="display-title mt-1 text-[24px]">公开老师页</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          任何拿到链接的人都能看到 <b className="text-foreground">{teacherName}</b> 的所有记录（角色、展会、备注、照片），联系方式不会展示。链接 30 天后自动失效。
        </p>

        {!url ? (
          <button
            onClick={generate}
            disabled={creating}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-semibold text-background active:scale-[0.98] disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            {creating ? "生成中…" : "生成 30 天分享链接"}
          </button>
        ) : (
          <div className="mt-5">
            <div className="flex items-center gap-2 rounded-2xl border border-divider bg-surface-1 px-3 py-2.5">
              <span className="flex-1 truncate text-xs tabular">{url}</span>
              <button onClick={copy} className="rounded-full bg-foreground p-2 text-background" aria-label="复制">
                <Copy className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
            </div>
            {expiresAt && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                失效时间 · {new Date(expiresAt).toLocaleString("zh-CN")}
              </p>
            )}
            <button
              onClick={revoke}
              className="mt-4 h-10 w-full rounded-full border border-destructive/30 text-xs text-destructive active:scale-[0.98]"
            >
              立即撤回
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
