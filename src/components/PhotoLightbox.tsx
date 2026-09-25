import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { StorageImage } from "@/components/StorageImage";
import type { Bucket } from "@/lib/storage";

export function PhotoLightbox({
  photos,
  index,
  open,
  onClose,
  onIndexChange,
  bucket = "photos",
}: {
  photos: string[];
  index: number;
  open: boolean;
  onClose: () => void;
  onIndexChange?: (i: number) => void;
  bucket?: Bucket;
}) {

  const [scale, setScale] = useState(1);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setScale(1);
  }, [index, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onIndexChange?.(index - 1);
      if (e.key === "ArrowRight" && index < photos.length - 1) onIndexChange?.(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, photos.length, onClose, onIndexChange]);

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (!startRef.current || scale > 1.05) return;
    const dx = e.changedTouches[0].clientX - startRef.current.x;
    const dy = e.changedTouches[0].clientY - startRef.current.y;
    if (Math.abs(dy) > 80 && Math.abs(dy) > Math.abs(dx)) {
      onClose();
    } else if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && index < photos.length - 1) onIndexChange?.(index + 1);
      if (dx > 0 && index > 0) onIndexChange?.(index - 1);
    }
    startRef.current = null;
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] bg-black flex items-center justify-center touch-none"
          onClick={onClose}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white backdrop-blur-md safe-top"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>

          {photos.length > 1 && (
            <div className="absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white backdrop-blur-md safe-top">
              {index + 1} / {photos.length}
            </div>
          )}

          {photos.length > 1 && index > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onIndexChange?.(index - 1); }}
              className="absolute left-2 z-10 hidden rounded-full bg-white/10 p-3 text-white backdrop-blur-md md:block"
              aria-label="上一张"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {photos.length > 1 && index < photos.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onIndexChange?.(index + 1); }}
              className="absolute right-2 z-10 hidden rounded-full bg-white/10 p-3 text-white backdrop-blur-md md:block"
              aria-label="下一张"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          <div
            className="relative h-full w-full overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={() => setScale((s) => (s > 1 ? 1 : 2.2))}
          >
            <motion.div
              key={photos[index]}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex h-full w-full items-center justify-center"
              style={{ touchAction: scale > 1 ? "pan-x pan-y" : "none" }}
            >
              <div style={{ transform: `scale(${scale})`, transition: "transform 0.25s" }} className="max-h-full max-w-full">
                <StorageImage bucket={bucket} path={photos[index]} className="max-h-[100vh] max-w-full object-contain !bg-transparent" />
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
