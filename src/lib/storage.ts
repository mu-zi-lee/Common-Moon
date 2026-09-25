import { supabase } from "@/integrations/supabase/client";

async function ensureUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("未登录");
  return data.user.id;
}

export type Bucket = "photos" | "maps" | "avatars" | "merch" | "audio";

export async function uploadImage(
  bucket: Bucket,
  file: File | Blob,
  ext?: string,
): Promise<string> {
  const userId = await ensureUserId();
  const extension = ext || (file instanceof File ? file.name.split(".").pop() : "jpg") || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: (file as File).type || "image/jpeg",
  });
  if (error) throw error;
  return path;
}

const urlCache = new Map<string, { url: string; expiresAt: number }>();

export async function getSignedUrl(
  bucket: Bucket,
  path: string,
  expiresIn = 3600,
): Promise<string> {
  const key = `${bucket}/${path}`;
  const cached = urlCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  urlCache.set(key, { url: data.signedUrl, expiresAt: Date.now() + expiresIn * 1000 });
  return data.signedUrl;
}

export async function readAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
