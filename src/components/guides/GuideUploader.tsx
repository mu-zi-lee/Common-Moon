import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, ImageIcon, Loader2, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { readAsDataUrl } from "@/lib/storage";
import { parseGuide } from "@/lib/guides.functions";
import { preprocessPdf } from "@/lib/pdf-preprocess";

type Pending =
  | {
      id: string;
      name: string;
      kind: "pdf" | "image";
      size: number;
      data_url: string;
      status?: string;
    }
  | {
      id: string;
      name: string;
      kind: "markdown";
      size: number;
      text: string;
      chunks: string[];
      images: Array<{ name: string; dataUrl: string; bytes: number }>;
      pageCount: number;
      status?: string;
    };

const MAX_TOTAL = 100 * 1024 * 1024; // 100MB total (raw)
const MAX_FILES = 8;
const PDF_DIRECT_MAX_BYTES = 8 * 1024 * 1024; // > 8MB → preprocess

export function GuideUploader({ defaultEventId }: { defaultEventId?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Pending[]>([]);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [eventId, setEventId] = useState<string>(defaultEventId ?? "");
  const [running, setRunning] = useState(false);
  const navigate = useNavigate();
  const parseFn = useServerFn(parseGuide);

  const events = useQuery({
    queryKey: ["events-picker"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, year")
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  async function pickFiles(list: FileList | null) {
    if (!list) return;
    const next: Pending[] = [...files];
    let total = next.reduce((s, f) => s + f.size, 0);
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        toast.error(`最多 ${MAX_FILES} 个文件`);
        break;
      }
      const kind: "pdf" | "image" | null = f.type.startsWith("image/")
        ? "image"
        : f.type === "application/pdf" || /\.pdf$/i.test(f.name)
          ? "pdf"
          : null;
      if (!kind) {
        toast.error(`不支持的文件：${f.name}`);
        continue;
      }
      if (total + f.size > MAX_TOTAL) {
        toast.error("文件总大小超过 100MB");
        break;
      }
      total += f.size;

      if (kind === "pdf" && f.size > PDF_DIRECT_MAX_BYTES) {
        // Big PDF → preprocess locally to Markdown (+ image fallbacks)
        const id = crypto.randomUUID();
        const placeholder: Pending = {
          id,
          name: f.name,
          kind: "markdown",
          size: 0,
          text: "",
          chunks: [],
          images: [],
          pageCount: 0,
          status: "解析 PDF 中…",
        };
        next.push(placeholder);
        setFiles([...next]);
        try {
          const result = await preprocessPdf(f, {
            onProgress: (pct) => {
              setFiles((prev) =>
                prev.map((p) =>
                  p.id === id
                    ? { ...p, status: `解析 PDF ${Math.round(pct * 100)}%` }
                    : p,
                ),
              );
            },
          });
          const mdBytes = new Blob([result.markdown]).size;
          const imgBytes = result.imagePages.reduce((s, im) => s + im.bytes, 0);
          setFiles((prev) =>
            prev.map((p) =>
              p.id === id
                ? {
                    id,
                    name: f.name,
                    kind: "markdown",
                    size: mdBytes + imgBytes,
                    text: result.markdown,
                    chunks: result.chunks,
                    images: result.imagePages,
                    pageCount: result.pageCount,
                    status: `已转成 Markdown（${result.pageCount} 页${result.imagePages.length ? ` · ${result.imagePages.length} 张图` : ""}）`,
                  }
                : p,
            ),
          );
        } catch (err) {
          setFiles((prev) => prev.filter((p) => p.id !== id));
          toast.error(`PDF 解析失败：${err instanceof Error ? err.message : "未知错误"}`);
        }
      } else {
        const url = await readAsDataUrl(f);
        next.push({
          id: crypto.randomUUID(),
          name: f.name,
          kind,
          size: f.size,
          data_url: url,
        });
        setFiles([...next]);
      }
    }
  }

  async function submit() {
    if (running) return;
    if (files.length === 0 && !text.trim()) {
      toast.error("请上传攻略文件或粘贴文本");
      return;
    }
    if (files.some((f) => f.kind === "markdown" && f.status?.includes("解析 PDF"))) {
      toast.error("请等待 PDF 预处理完成");
      return;
    }
    setRunning(true);
    const t = toast.loading("AI 正在解析攻略…");
    try {
      // Assemble server-payload files + optional chunks
      const outFiles: Array<
        | { kind: "pdf" | "image"; name: string; size: number; data_url: string }
        | { kind: "markdown"; name: string; size: number; text: string }
      > = [];
      const chunks: string[] = [];
      for (const f of files) {
        if (f.kind === "markdown") {
          if (f.chunks.length > 1) {
            for (const c of f.chunks) chunks.push(c);
          } else {
            outFiles.push({ kind: "markdown", name: f.name, size: f.size, text: f.text });
          }
          for (const img of f.images) {
            outFiles.push({
              kind: "image",
              name: img.name,
              size: img.bytes,
              data_url: img.dataUrl,
            });
          }
        } else {
          outFiles.push({
            kind: f.kind,
            name: f.name,
            size: f.size,
            data_url: f.data_url,
          });
        }
      }

      const res = await parseFn({
        data: {
          event_id: eventId || null,
          title: title.trim() || undefined,
          text: text.trim() || undefined,
          files: outFiles,
          chunks: chunks.length > 0 ? chunks : undefined,
        },
      });
      toast.success("解析完成", { id: t });
      navigate({ to: "/guides/$id", params: { id: res.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "解析失败", { id: t });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-5">
      <section>
        <p className="eyebrow mb-2">Step 1 · 投喂攻略</p>
        <label
          htmlFor="guide-files"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-divider bg-surface-1/60 p-6 text-center transition active:scale-[0.99]"
        >
          <Sparkles className="h-6 w-6 text-primary/70" />
          <p className="text-sm font-medium">拖入 / 选择 PDF 或图片</p>
          <p className="text-[11px] text-muted-foreground">
            最多 {MAX_FILES} 个 · 总大小 ≤ 100MB · 大 PDF 会自动转 Markdown
          </p>
          <input
            id="guide-files"
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void pickFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {files.length > 0 && (
          <ul className="mt-3 space-y-2">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-2xl bg-surface-1 px-3 py-2 text-sm"
              >
                {f.kind === "image" ? (
                  <ImageIcon className="h-4 w-4 text-primary" />
                ) : (
                  <FileText className="h-4 w-4 text-primary" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate">{f.name}</p>
                  {f.status && (
                    <p className="truncate text-[10px] text-muted-foreground">{f.status}</p>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground tabular">
                  {f.size >= 1024 * 1024
                    ? `${(f.size / 1024 / 1024).toFixed(1)} MB`
                    : `${Math.max(1, Math.round(f.size / 1024))} KB`}
                </span>
                <button
                  onClick={() => setFiles((prev) => prev.filter((p) => p.id !== f.id))}
                  className="rounded-full p-1 text-muted-foreground active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="eyebrow mb-2">或粘贴文本（可选）</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="从公众号 / 小红书复制的攻略正文…"
          className="w-full rounded-2xl border border-divider bg-background p-3 text-sm outline-none focus:border-foreground/40"
        />
      </section>

      <section className="grid grid-cols-1 gap-3">
        <div>
          <p className="eyebrow mb-1">标题（可选）</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="留空自动填"
            className="h-10 w-full rounded-full border border-divider bg-background px-4 text-sm outline-none focus:border-foreground/40"
          />
        </div>
        <div>
          <p className="eyebrow mb-1">绑定到展会（可选）</p>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="h-10 w-full rounded-full border border-divider bg-background px-4 text-sm outline-none focus:border-foreground/40"
          >
            <option value="">不绑定</option>
            {(events.data ?? []).map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
                {ev.year ? ` · ${ev.year}` : ""}
              </option>
            ))}
          </select>
        </div>
      </section>

      <button
        onClick={submit}
        disabled={running}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-medium text-background active:scale-[0.99] disabled:opacity-60"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {running ? "AI 解析中…（约 10-30s）" : "开始 AI 解析"}
      </button>
    </div>
  );
}
