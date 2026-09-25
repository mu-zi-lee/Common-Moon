import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, Download, Loader2, RotateCcw, X, Check } from "lucide-react";
import { toast } from "sonner";
import { pathToDataUrl, nodeToPngBlob, downloadBlob } from "@/lib/export-card";
import { StorageImage } from "@/components/StorageImage";

export type PosterRecord = {
  id: string;
  photo_url: string | null;
  photo_urls: string[] | null;
  teacher_name: string | null;
  character_name: string | null;
  anime_name: string | null;
  hall: string | null;
  favorite: boolean;
  rating: number;
  occurred_at: string;
  note: string | null;
  events: { name?: string | null } | null;
  contacts: { platform: string; handle: string }[] | null;
};

/**
 * Renders a hidden 1080x1920 poster node and lets the user preview + download.
 */
export function ExportPosterSheet({ record, open, onClose, autoDownload = false }: { record: PosterRecord; open: boolean; onClose: () => void; autoDownload?: boolean }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [photoReady, setPhotoReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);

  const candidates = useMemo(() => {
    const list = [record.photo_url, ...(record.photo_urls ?? [])].filter(
      (p): p is string => !!p,
    );
    return Array.from(new Set(list));
  }, [record.photo_url, record.photo_urls]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(candidates[0] ?? null);
  useEffect(() => {
    setSelectedPhoto(candidates[0] ?? null);
  }, [candidates]);
  const cover = selectedPhoto;

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDark(root.classList.contains("dark"));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Default date / time from record.occurred_at (local timezone)
  const defaults = useMemo(() => {
    const d = new Date(record.occurred_at);
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  }, [record.occurred_at]);

  const [customDate, setCustomDate] = useState(defaults.date);
  const [customTime, setCustomTime] = useState(defaults.time);
  useEffect(() => {
    setCustomDate(defaults.date);
    setCustomTime(defaults.time);
  }, [defaults]);

  const edited = customDate !== defaults.date || customTime !== defaults.time;

  // Derive display strings from custom pickers
  const displayDate = useMemo(() => {
    const [y, m, d] = customDate.split("-").map(Number);
    if (!y || !m || !d) return "";
    return `${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")}`;
  }, [customDate]);
  const displayTime = useMemo(() => customTime || "", [customTime]);
  const displayDow = useMemo(() => {
    const [y, m, d] = customDate.split("-").map(Number);
    const [hh, mm] = customTime.split(":").map(Number);
    if (!y || !m || !d) return "";
    const dt = new Date(y, m - 1, d, hh || 0, mm || 0);
    return dt.toLocaleDateString("zh-CN", { weekday: "short" });
  }, [customDate, customTime]);

  // Preload cover as data URL to bypass CORS in html-to-image
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setPhotoReady(false);
    setPreviewUrl(null);
    setBlob(null);
    (async () => {
      try {
        if (cover) {
          const data = await pathToDataUrl("photos", cover);
          if (!cancelled) setPhotoData(data);
        } else {
          if (!cancelled) setPhotoData(null);
        }
      } catch (e) {
        if (!cancelled) {
          setPhotoData(null);
          toast.error(e instanceof Error ? e.message : "图片加载失败");
        }
      } finally {
        if (!cancelled) setPhotoReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [open, cover]);

  // Once photo ready, snapshot the node; also re-snapshot when custom date/time changes
  useEffect(() => {
    if (!open) return;
    if (!photoReady) return;
    if (!nodeRef.current) return;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const b = await nodeToPngBlob(nodeRef.current!, 2);
        setBlob(b);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(b);
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "生成失败");
      } finally {
        setLoading(false);
      }
    }, 240);
    return () => clearTimeout(t);
  }, [open, photoReady, photoData, customDate, customTime, isDark]);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSave() {
    if (!blob) return;
    const stamp = `${customDate.replace(/-/g, "")}_${customTime.replace(":", "")}`;
    const name = record.teacher_name || record.character_name || "coslog";
    downloadBlob(blob, `${name}_${record.events?.name ?? ""}_${stamp}.png`);
    toast.success("已开始下载");
  }

  // One-click export: as soon as the poster blob is ready, save & close.
  const autoFiredRef = useRef(false);
  useEffect(() => {
    if (!open) { autoFiredRef.current = false; return; }
    if (!autoDownload) return;
    if (autoFiredRef.current) return;
    if (loading || !blob) return;
    autoFiredRef.current = true;
    handleSave();
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoDownload, loading, blob]);

  const stars = Math.max(0, Math.min(5, record.rating || 0));
  const contacts = (record.contacts ?? []).filter((c) => c.handle?.trim());

  const serifStack = `'Instrument Serif', 'Songti SC', 'STSong', 'Noto Serif SC', Georgia, serif`;
  const sansStack = `'Work Sans', system-ui, -apple-system, 'PingFang SC', 'Hiragino Sans', 'Microsoft YaHei', sans-serif`;

  function resetDateTime() {
    setCustomDate(defaults.date);
    setCustomTime(defaults.time);
  }

  return (
    <>
      {/* Hidden render target for html-to-image */}
      {open && (
        <div style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none", opacity: 0 }}>
          <div
            ref={nodeRef}
            style={{
              width: 1080,
              height: 1920,
              background: "var(--poster-background)",
              color: "var(--poster-foreground)",
              fontFamily: sansStack,
              padding: "88px 80px 96px",
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Masthead */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              paddingBottom: 24, borderBottom: "1px solid var(--poster-divider)",
            }}>
              <div style={{ fontSize: 22, letterSpacing: 8, fontWeight: 600, textTransform: "uppercase" }}>CosLog</div>
              <div style={{ fontSize: 18, letterSpacing: 6, color: "var(--poster-muted)", textTransform: "uppercase", fontWeight: 500 }}>
                No.{record.id.slice(0, 6).toUpperCase()}
              </div>
            </div>

            {/* Eyebrow */}
            <div style={{
              marginTop: 44, fontSize: 20, letterSpacing: 8,
              color: "var(--poster-muted)", textTransform: "uppercase", fontWeight: 600,
            }}>
              Featured Encounter
            </div>

            {/* Editorial title */}
            <div style={{
              fontFamily: serifStack, marginTop: 16, fontSize: 128, lineHeight: 0.95,
              letterSpacing: -1, fontWeight: 400,
            }}>
              {record.teacher_name || "—"}
            </div>
            {record.character_name && (
              <div style={{
                fontFamily: serifStack, marginTop: 12, fontSize: 34,
                fontStyle: "italic", color: "var(--poster-soft)",
              }}>
                as {record.character_name}
                {record.anime_name ? ` · ${record.anime_name}` : ""}
              </div>
            )}

            {/* Portrait */}
            <div style={{
              position: "relative", marginTop: 40,
              borderRadius: 12, overflow: "hidden",
               background: "var(--poster-surface)",
              aspectRatio: "3 / 4", width: "100%",
               boxShadow: "var(--poster-photo-shadow)",
            }}>
              {photoData ? (
                <img
                  src={photoData}
                  alt=""
                  style={{
                    position: "absolute", inset: 0,
                    width: "100%", height: "100%",
                    objectFit: "cover", objectPosition: "center top",
                  }}
                />
              ) : (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: "100%", color: "var(--poster-faint)",
                  fontFamily: serifStack, fontSize: 42,
                }}>No photo</div>
              )}
            </div>

            {/* Metadata strip */}
            <div style={{
              marginTop: 36, display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: 24, paddingTop: 24, borderTop: "1px solid var(--poster-divider)",
            }}>
              <div>
                <div style={{ fontSize: 16, letterSpacing: 6, color: "var(--poster-muted)", textTransform: "uppercase", fontWeight: 600 }}>Date · Time</div>
                <div style={{ fontFamily: serifStack, fontSize: 30, marginTop: 8 }}>{displayDate}</div>
                <div style={{ fontFamily: serifStack, fontSize: 22, marginTop: 4, color: "var(--poster-soft)" }}>
                  {displayTime}{displayDow ? ` · ${displayDow}` : ""}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 16, letterSpacing: 6, color: "var(--poster-muted)", textTransform: "uppercase", fontWeight: 600 }}>Venue</div>
                <div style={{ fontFamily: serifStack, fontSize: 30, marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {record.events?.name || "自由外拍"}
                </div>
                {record.hall && (
                  <div style={{ fontSize: 18, marginTop: 4, color: "var(--poster-muted)" }}>{record.hall}</div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 16, letterSpacing: 6, color: "var(--poster-muted)", textTransform: "uppercase", fontWeight: 600 }}>Rating</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} style={{
                      display: "inline-block", height: 6, width: 28, borderRadius: 999,
                      background: i < stars ? "var(--poster-foreground)" : "var(--poster-divider)",
                    }} />
                  ))}
                </div>
                {record.favorite && (
                  <div style={{ fontSize: 16, marginTop: 10, color: "var(--poster-muted)", letterSpacing: 4, textTransform: "uppercase", fontWeight: 600 }}>
                    ♥ Favorite
                  </div>
                )}
              </div>
            </div>

            {/* Contact */}
            {contacts.length > 0 && (
              <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--poster-divider)" }}>
                <div style={{ fontSize: 16, letterSpacing: 6, color: "var(--poster-muted)", textTransform: "uppercase", fontWeight: 600 }}>Contact</div>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  {contacts.slice(0, 3).map((c, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 20, fontSize: 22 }}>
                      <span style={{
                        fontSize: 14, letterSpacing: 4, textTransform: "uppercase",
                         fontWeight: 600, color: "var(--poster-muted)", width: 110,
                      }}>{c.platform}</span>
                      <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "var(--poster-foreground)" }}>{c.handle}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Note */}
            {record.note && (
              <div style={{
                marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--poster-divider)",
                fontFamily: serifStack, fontStyle: "italic",
                fontSize: 26, lineHeight: 1.55, color: "var(--poster-soft)",
                whiteSpace: "pre-wrap", maxHeight: 180, overflow: "hidden",
              }}>
                &ldquo;{record.note}&rdquo;
              </div>
            )}

            {/* Colophon */}
            <div style={{
              marginTop: "auto", paddingTop: 32, display: "flex",
              justifyContent: "space-between", alignItems: "flex-end",
              fontSize: 16, letterSpacing: 5, color: "var(--poster-muted)",
              textTransform: "uppercase", fontWeight: 600,
            }}>
              <span>Made with CosLog</span>
              <span>{displayDate}{displayTime ? ` · ${displayTime}` : ""}</span>
            </div>
          </div>
        </div>
      )}

      {/* Preview sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-foreground/40 backdrop-blur-sm"
            onClick={onClose}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-x-0 bottom-0 top-14 flex flex-col rounded-t-3xl bg-background p-4 hairline-t"
            >
              <div className="flex items-center justify-between pb-3 hairline-b">
                <div className="flex items-baseline gap-3">
                  <span className="display-title text-[22px]">应援卡预览</span>
                  <span className="eyebrow tabular">1080 × 1920</span>
                </div>
                <button onClick={onClose} className="rounded-full p-2 text-muted-foreground active:scale-95" aria-label="关闭">
                  <X className="h-5 w-5" strokeWidth={1.6} />
                </button>
              </div>

              {/* Editable date / time strip */}
              <div className="mt-3 rounded-2xl bg-surface-1 p-3">
                <div className="flex items-center justify-between">
                  <span className="eyebrow">Custom Stamp · 自定义时间</span>
                  {edited && (
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-foreground/70">
                      已修改
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label
                    className="relative inline-flex h-10 flex-1 min-w-[8rem] items-center gap-2 rounded-full border border-divider bg-background px-3 focus-within:border-foreground/60 transition ease-editorial"
                    style={{ colorScheme: isDark ? "dark" : "light" }}
                  >
                    <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full bg-transparent font-display text-[16px] tabular text-foreground outline-none"
                    />
                  </label>
                  <label
                    className="relative inline-flex h-10 flex-1 min-w-[7rem] items-center gap-2 rounded-full border border-divider bg-background px-3 focus-within:border-foreground/60 transition ease-editorial"
                    style={{ colorScheme: isDark ? "dark" : "light" }}
                  >
                    <Clock className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
                    <input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="w-full bg-transparent font-display text-[16px] tabular text-foreground outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={resetDateTime}
                    disabled={!edited}
                    className={`inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-3 text-[10px] font-semibold uppercase tracking-widest transition ease-editorial ${
                      edited
                        ? "bg-foreground text-background active:scale-95"
                        : "border border-divider bg-background text-muted-foreground opacity-50 cursor-not-allowed"
                    }`}
                    aria-label="重置为记录时间"
                  >
                    <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.8} /> Reset
                  </button>
                </div>
              </div>

              {/* Photo picker */}
              {candidates.length > 1 && (
                <div className="mt-3 rounded-2xl bg-surface-1 p-3">
                  <div className="flex items-center justify-between">
                    <span className="eyebrow">Photo · 选择照片</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground tabular">
                      {candidates.indexOf(selectedPhoto ?? "") + 1} / {candidates.length}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {candidates.map((p) => {
                      const active = p === selectedPhoto;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setSelectedPhoto(p)}
                          className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border transition ease-editorial ${
                            active ? "border-foreground ring-2 ring-foreground/30" : "border-divider opacity-70"
                          }`}
                          aria-label="选择这张照片"
                        >
                          <StorageImage bucket="photos" path={p} className="h-full w-full" />
                          {active && (
                            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background">
                              <Check className="h-3 w-3" strokeWidth={2.4} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Preview canvas */}
              <div className="mt-3 flex flex-1 overflow-hidden rounded-2xl border border-divider bg-surface-1 p-4">
                {loading || !previewUrl ? (
                  <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.6} />
                    <span className="eyebrow">Rendering…</span>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center overflow-auto">
                    <img
                      src={previewUrl}
                      alt="应援卡预览"
                      className="mx-auto max-h-full w-auto rounded-xl"
                      style={{
                        border: "1px solid var(--poster-preview-border)",
                        boxShadow: "var(--poster-preview-shadow)",
                      }}
                    />
                  </div>
                )}
              </div>


              <div className="pt-3 safe-bottom">
                <button
                  onClick={handleSave}
                  disabled={!blob}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-semibold text-background disabled:opacity-50 active:scale-[0.98] transition ease-editorial"
                >
                  <Download className="h-4 w-4" strokeWidth={1.8} /> 保存到相册
                </button>
                <p className="mt-2 text-center eyebrow">Long-press to save · Share to IM</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

