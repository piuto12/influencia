import { z } from "zod";
import { clean } from "@/modules/registration/schemas";
import { parseVideoUrl } from "./video";
import { isValidSlug, RESERVED_SLUGS } from "./slug";
import { isSafeMediaPath, MEDIA_BUCKET as _b } from "./media";
import { isSectionType, safeHref } from "./sections";
void _b;

const txt = (max: number) => z.string().optional().transform((v) => clean(v ?? "")).pipe(z.string().max(max, "Too long"));
const longTxt = (max: number) => z.string().optional().transform((v) => (v ?? "").replace(/\r/g, "").trim()).pipe(z.string().max(max, "Too long"));
const check = z.preprocess((v) => v === "on" || v === "true", z.boolean());
const mediaPath = z.string().optional().transform((v) => (v ?? "").trim()).refine((v) => v === "" || isSafeMediaPath(v), "Invalid media path");
const status = z.enum(["draft", "published"]);
const order = z.coerce.number().int().min(-10000).max(10000).catch(0);

export const sectionSchema = z.object({
  type: z.string().refine(isSectionType, "Unknown section type"),
  eyebrow: txt(80), title: txt(160), body: longTxt(5000), cta_label: txt(60),
  cta_href: z.string().optional().transform((v) => (v ?? "").trim()).refine((v) => v === "" || safeHref(v) !== null, "Link must be a site path, https URL, tel: or mailto:"),
  status,
});

export const videoSchema = z.object({
  title: txt(160).pipe(z.string().min(2)), description: txt(600), url: z.string().optional().transform((v) => (v ?? "").trim()),
  source: z.enum(["link", "upload"]), storage_path: mediaPath, thumbnail_path: mediaPath, category: txt(60),
  featured: check, sort_order: order, status,
}).superRefine((v, ctx) => {
  if (v.source === "link" && !parseVideoUrl(v.url)) ctx.addIssue({ code: "custom", path: ["url"], message: "invalid_video_url" });
  if (v.source === "upload" && !v.storage_path) ctx.addIssue({ code: "custom", path: ["storage_path"], message: "invalid_media" });
});

export const testimonialSchema = z.object({
  name: txt(120).pipe(z.string().min(2)), designation: txt(120), organization: txt(160), feedback: longTxt(2000),
  video_url: z.string().optional().transform((v) => (v ?? "").trim()).refine((v) => v === "" || parseVideoUrl(v) !== null, "Enter a valid YouTube or Vimeo link"),
  photo_path: mediaPath, edition_code: txt(20), rating: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).max(5).nullable()),
  featured: check, status,
}).refine((v) => v.feedback.length > 0 || v.video_url.length > 0, { message: "Add written feedback or a video", path: ["feedback"] });

export const galleryItemSchema = z.object({ caption: txt(240), sort_order: order, featured: check, status });

export const articleSchema = z.object({
  title: txt(180).pipe(z.string().min(2)),
  slug: z.string().trim().toLowerCase().refine((s) => isValidSlug(s) && !RESERVED_SLUGS.has(s), "Use lowercase letters, numbers and hyphens"),
  excerpt: txt(300), body: longTxt(60000), author: txt(100), category: txt(60), featured_image_path: mediaPath,
  seo_title: txt(70), seo_description: txt(180), status,
});

export const pageSchema = z.object({
  slug: z.string().trim().toLowerCase().refine((s) => isValidSlug(s) && !RESERVED_SLUGS.has(s), "Use lowercase letters, numbers and hyphens"),
  title: txt(160).pipe(z.string().min(2)), body: longTxt(60000), seo_title: txt(70), seo_description: txt(180), status,
});

const SOCIAL_HOSTS: Record<string, RegExp> = {
  youtube: /(^|\.)youtube\.com$|^youtu\.be$/, instagram: /(^|\.)instagram\.com$/,
  facebook: /(^|\.)facebook\.com$|^fb\.com$|^fb\.me$/, linkedin: /(^|\.)linkedin\.com$/,
};
export const socialSchema = z.object({
  platform: z.enum(["youtube", "instagram", "facebook", "linkedin"]),
  url: z.string().trim().max(300), enabled: check,
}).superRefine((v, ctx) => {
  if (!v.url) return; // empty = remove
  try { const u = new URL(v.url); if (u.protocol !== "https:" || !SOCIAL_HOSTS[v.platform].test(u.hostname)) throw 0; }
  catch { ctx.addIssue({ code: "custom", path: ["url"], message: `Enter a valid https ${v.platform} link` }); }
});

export const navItemSchema = z.object({
  label: txt(40).pipe(z.string().min(1)),
  href: z.string().trim().refine((h) => /^\/(?!\/)[^\s]*$/.test(h) || /^https:\/\/[^\s]+$/.test(h), "Use a site path (/about) or an https link"),
  visible: z.boolean(),
});

export const editionCreateSchema = z.object({
  title: txt(160).pipe(z.string().min(2)), subtitle: txt(200),
  starts_at: z.string().optional(), venue_name: txt(160), venue_city: txt(160),
  capacity: z.coerce.number().int().min(0).max(100000),
});

/** Site branding: speaker portrait + logo. Paths must be our own uploads in the branding/ folder (images only). */
const brandingPath = z.string().optional().transform((v) => (v ?? "").trim())
  .refine((v) => v === "" || (isSafeMediaPath(v) && v.startsWith("branding/") && /\.(jpg|png|webp|avif)$/.test(v)), "Invalid image");
export const brandingSchema = z.object({
  speaker_path: brandingPath, speaker_style: z.enum(["cutout", "circle"]).catch("cutout"), speaker_alt: txt(120),
  logo_path: brandingPath, logo_alt: txt(120),
});
