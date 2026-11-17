export const MEDIA_BUCKET = "public-media";

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm" };
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export type UploadKind = "image" | "video";
export type UploadCheck = { ok: true; ext: string } | { ok: false; reason: "type" | "size" | "empty" };

/** Pre-flight check of what the browser claims. The bucket re-enforces mime type and size limits server-side. */
export function checkUpload(kind: UploadKind, mime: string, size: number): UploadCheck {
  const ext = (kind === "image" ? IMAGE_TYPES : VIDEO_TYPES)[mime];
  if (!ext) return { ok: false, reason: "type" };
  if (!(size > 0)) return { ok: false, reason: "empty" };
  if (size > (kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES)) return { ok: false, reason: "size" };
  return { ok: true, ext };
}

export const FOLDERS = ["gallery", "videos", "thumbnails", "testimonials", "blog", "editions", "misc"] as const;
export type Folder = (typeof FOLDERS)[number];

/** Public URL for an object path; null-safe. Paths are validated to be relative and traversal-free. */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path || path.includes("..") || path.startsWith("/")) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}` : null;
}
export const isSafeMediaPath = (p: string) => /^[a-z]+\/[A-Za-z0-9_-]+\.(jpg|png|webp|avif|mp4|webm)$/.test(p);
