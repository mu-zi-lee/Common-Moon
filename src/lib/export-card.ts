import { toPng } from "html-to-image";
import { getSignedUrl, readAsDataUrl } from "@/lib/storage";

export async function pathToDataUrl(bucket: "photos" | "maps" | "avatars", path: string): Promise<string> {
  const signed = await getSignedUrl(bucket, path);
  const blob = await (await fetch(signed)).blob();
  return await readAsDataUrl(blob);
}

export async function nodeToPngBlob(node: HTMLElement, pixelRatio = 2): Promise<Blob> {
  const backgroundColor = getComputedStyle(node).backgroundColor;
  const dataUrl = await toPng(node, {
    pixelRatio,
    cacheBust: true,
    backgroundColor,
  });
  const res = await fetch(dataUrl);
  return await res.blob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
