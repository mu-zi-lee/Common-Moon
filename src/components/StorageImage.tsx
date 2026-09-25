import { useEffect, useState, type ReactNode } from "react";
import { getSignedUrl, type Bucket } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";

export function StorageImage({
  bucket,
  path,
  className,
  alt,
  fallback,
}: {
  bucket: Bucket;
  path: string | null | undefined;
  className?: string;

  alt?: string;
  fallback?: ReactNode;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setErrored(false);
    setUrl(null);
    if (!path) return;
    getSignedUrl(bucket, path).then((u) => { if (!cancelled) setUrl(u); }).catch(() => { if (!cancelled) setErrored(true); });
    return () => { cancelled = true; };
  }, [bucket, path]);
  if (!path || errored) {
    if (fallback !== undefined) return <div className={cn("flex items-center justify-center bg-muted", className)}>{fallback}</div>;
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}>
        <ImageOff className="h-5 w-5 opacity-40" />
      </div>
    );
  }
  if (!url) return <div className={cn("shimmer", className)} />;
  return (
    <img
      src={url}
      alt={alt ?? ""}
      className={cn("object-cover", className)}
      loading="lazy"
      onError={() => setErrored(true)}
    />
  );
}
