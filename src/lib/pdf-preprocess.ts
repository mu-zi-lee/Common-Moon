// Browser-side PDF preprocessing: convert large PDFs to Markdown text + a few
// page image fallbacks so we don't ship a 50MB base64 blob to the AI gateway.
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

// Configure worker exactly once
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
}

export type PreprocessResult = {
  markdown: string;
  imagePages: Array<{ name: string; dataUrl: string; bytes: number }>;
  pageCount: number;
  chunks: string[]; // markdown split into <=20-page chunks
};

const CHUNK_PAGES = 20;
const IMG_MAX_WIDTH = 1400;
const IMG_QUALITY = 0.72;

export async function preprocessPdf(
  file: File,
  opts?: { onProgress?: (pct: number) => void },
): Promise<PreprocessResult> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const pageCount = doc.numPages;

  const pageMd: string[] = [];
  const imagePages: PreprocessResult["imagePages"] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const text = tc.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length >= 20) {
      pageMd.push(`## Page ${i}\n\n${text}`);
    } else {
      // Likely image-only page — rasterize and send as an image fallback.
      // Cap the total number of image pages to keep payload small.
      if (imagePages.length < 8) {
        const dataUrl = await renderPageToJpeg(page);
        const bytes = Math.floor((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
        imagePages.push({ name: `${file.name}-p${i}.jpg`, dataUrl, bytes });
      }
      pageMd.push(`## Page ${i}\n\n_(纯图页，已作为图片附件)_`);
    }
    opts?.onProgress?.(i / pageCount);
  }

  const markdown = pageMd.join("\n\n");

  // Split into chunks of CHUNK_PAGES pages
  const chunks: string[] = [];
  for (let start = 0; start < pageMd.length; start += CHUNK_PAGES) {
    chunks.push(pageMd.slice(start, start + CHUNK_PAGES).join("\n\n"));
  }

  return { markdown, imagePages, pageCount, chunks };
}

async function renderPageToJpeg(page: pdfjsLib.PDFPageProxy): Promise<string> {
  const viewport = page.getViewport({ scale: 1 });
  const scale = Math.min(IMG_MAX_WIDTH / viewport.width, 2);
  const scaled = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(scaled.width);
  canvas.height = Math.ceil(scaled.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not available");
  await page.render({ canvas, canvasContext: ctx, viewport: scaled } as unknown as Parameters<typeof page.render>[0]).promise;
  return canvas.toDataURL("image/jpeg", IMG_QUALITY);
}
