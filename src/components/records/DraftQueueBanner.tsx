import { useEffect, useState, useSyncExternalStore } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { CloudUpload, Loader2, RefreshCw, X, AlertTriangle } from "lucide-react";
import { upsertRecord } from "@/lib/records.functions";
import {
  flush as flushDrafts,
  installAutoFlush,
  list as listDrafts,
  remove as removeDraft,
  setUploader,
  subscribe as subscribeDrafts,
  type Draft,
} from "@/lib/draft-queue";

let cache: Draft[] = [];

function useDrafts(): Draft[] {
  return useSyncExternalStore(
    (cb) => subscribeDrafts(() => { void listDrafts().then((rows) => { cache = rows; cb(); }); }),
    () => cache,
    () => cache,
  );
}

export function DraftQueueBanner() {
  const upsertFn = useServerFn(upsertRecord);
  const qc = useQueryClient();
  const drafts = useDrafts();
  const [flushing, setFlushing] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [expanded, setExpanded] = useState(false);

  // Wire uploader + auto-triggers + initial load once.
  useEffect(() => {
    setUploader(async (payload) => {
      await upsertFn({ data: payload });
    });
    installAutoFlush();
    void listDrafts().then((rows) => { cache = rows; });
    void flushDrafts().then((r) => { if (r.flushed) qc.invalidateQueries(); });
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [upsertFn, qc]);

  if (drafts.length === 0) return null;

  const errored = drafts.filter((d) => d.status === "error");
  const uploading = drafts.some((d) => d.status === "uploading");
  const hasError = errored.length > 0;

  async function retry() {
    setFlushing(true);
    try {
      const r = await flushDrafts();
      if (r.flushed) qc.invalidateQueries();
    } finally {
      setFlushing(false);
    }
  }

  return (
    <div
      className={`mb-3 rounded-2xl border px-3 py-2 text-xs ${
        hasError
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-divider bg-surface-1 text-foreground"
      }`}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2"
        onClick={() => setExpanded((v) => !v)}
      >
        {hasError ? (
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.6} />
        ) : uploading || flushing ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={1.6} />
        ) : (
          <CloudUpload className="h-4 w-4 shrink-0" strokeWidth={1.6} />
        )}
        <span className="flex-1 truncate text-left">
          {hasError
            ? `${errored.length} 条上传失败`
            : uploading || flushing
            ? `正在上传 ${drafts.length} 条…`
            : online
            ? `${drafts.length} 条待上传`
            : `${drafts.length} 条待上传 · 离线`}
        </span>
        <span
          onClick={(e) => { e.stopPropagation(); void retry(); }}
          className="inline-flex items-center gap-1 rounded-full border border-current/30 px-2 py-0.5 text-[10px] uppercase tracking-wider opacity-80"
        >
          <RefreshCw className="h-3 w-3" strokeWidth={1.8} />
          重试
        </span>
      </button>

      {expanded && (
        <ul className="mt-2 space-y-1 border-t border-current/15 pt-2">
          {drafts.map((d) => (
            <li key={d.id} className="flex items-center gap-2">
              <span className="flex-1 truncate">
                {d.payload.teacher_name || d.payload.character_name || "待整理照片"}
                <span className="ml-1 opacity-60">
                  · {new Date(d.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                </span>
                {d.status === "error" && d.error && (
                  <span className="ml-1 opacity-80">· {d.error}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => { void removeDraft(d.id); }}
                className="rounded-full p-1 opacity-70 hover:opacity-100"
                aria-label="删除草稿"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
