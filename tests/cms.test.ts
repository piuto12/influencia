import { describe, expect, it } from "vitest";
import { parseVideoUrl } from "@/modules/content/video";
import { isValidSlug, slugify } from "@/modules/content/slug";
import { checkUpload, isSafeMediaPath, mediaUrl, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from "@/modules/content/media";
import { safeHref, DEFAULT_SECTIONS, SECTION_TYPES } from "@/modules/content/sections";
import { articleSchema, brandingSchema, galleryItemSchema, navItemSchema, pageSchema, sectionSchema, socialSchema, testimonialSchema, videoSchema } from "@/modules/content/schemas";

describe("video embedding", () => {
  it("parses YouTube variants into privacy-enhanced embeds", () => {
    for (const u of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=5", "https://youtube.com/embed/dQw4w9WgXcQ", "https://www.youtube.com/shorts/dQw4w9WgXcQ"]) {
      const p = parseVideoUrl(u); expect(p?.source).toBe("youtube"); expect(p?.embedUrl).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    }
  });
  it("parses Vimeo", () => {
    expect(parseVideoUrl("https://vimeo.com/123456789")).toMatchObject({ source: "vimeo", id: "123456789" });
    expect(parseVideoUrl("https://player.vimeo.com/video/123456789")?.embedUrl).toContain("player.vimeo.com/video/123456789");
  });
  it("rejects other hosts, lookalikes, bad ids and non-http schemes", () => {
    for (const u of ["https://evil.com/watch?v=dQw4w9WgXcQ", "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ", "https://youtube.com/watch?v=short", "javascript:alert(1)", "not a url", "https://vimeo.com/abc", "ftp://youtu.be/dQw4w9WgXcQ"])
      expect(parseVideoUrl(u)).toBeNull();
  });
});

describe("slugs", () => {
  it("slugifies", () => { expect(slugify("Hello, World & Café!")).toBe("hello-world-and-cafe"); expect(isValidSlug("a-b-1")).toBe(true); expect(isValidSlug("A_b")).toBe(false); expect(isValidSlug("-x")).toBe(false); });
});

describe("media upload checks", () => {
  it("accepts images/videos within limits", () => {
    expect(checkUpload("image", "image/jpeg", 1000)).toEqual({ ok: true, ext: "jpg" });
    expect(checkUpload("video", "video/mp4", 1000)).toEqual({ ok: true, ext: "mp4" });
  });
  it("rejects svg/html/exe, wrong kind, empty and oversize", () => {
    expect(checkUpload("image", "image/svg+xml", 10)).toMatchObject({ ok: false, reason: "type" });
    expect(checkUpload("image", "text/html", 10)).toMatchObject({ ok: false });
    expect(checkUpload("image", "video/mp4", 10)).toMatchObject({ ok: false });
    expect(checkUpload("image", "image/png", 0)).toMatchObject({ reason: "empty" });
    expect(checkUpload("image", "image/png", MAX_IMAGE_BYTES + 1)).toMatchObject({ reason: "size" });
    expect(checkUpload("video", "video/webm", MAX_VIDEO_BYTES + 1)).toMatchObject({ reason: "size" });
  });
  it("only accepts folder/uuid-style object paths, no traversal", () => {
    expect(isSafeMediaPath("gallery/3f2a9c1e-5b7d-4e8a-9c3f-1a2b3c4d5e6f.jpg")).toBe(true);
    for (const p of ["../x.jpg", "gallery/../x.jpg", "/gallery/x.jpg", "gallery/x.svg", "gallery/a/b.jpg", "https://evil/x.jpg"]) expect(isSafeMediaPath(p)).toBe(false);
    expect(mediaUrl("../etc")).toBeNull(); expect(mediaUrl(null)).toBeNull();
  });
});

describe("links and sections", () => {
  it("only allows safe CTA targets", () => {
    for (const ok of ["/register", "https://example.com/x", "tel:+918589990060", "mailto:a@b.com"]) expect(safeHref(ok)).toBe(ok);
    for (const bad of ["javascript:alert(1)", "//evil.com", "http://insecure.com", "data:text/html,x", "/a b", ""]) expect(safeHref(bad)).toBeNull();
  });
  it("defaults cover every built-in type, hero excluded, in order", () => {
    const builtins = Object.entries(SECTION_TYPES).filter(([, v]) => !v.custom).map(([k]) => k);
    expect(DEFAULT_SECTIONS.map((s) => s.type)).toEqual(builtins);
  });
  it("section schema rejects unsafe CTA and unknown types", () => {
    const base = { type: "text", title: "T", status: "published" };
    expect(sectionSchema.safeParse(base).success).toBe(true);
    expect(sectionSchema.safeParse({ ...base, cta_href: "javascript:alert(1)" }).success).toBe(false);
    expect(sectionSchema.safeParse({ ...base, type: "script" }).success).toBe(false);
  });
});

describe("content schemas", () => {
  it("video: link requires a valid YouTube/Vimeo URL; upload requires a stored file", () => {
    const b = { title: "Promo", source: "link", status: "published" };
    expect(videoSchema.safeParse({ ...b, url: "https://youtu.be/dQw4w9WgXcQ" }).success).toBe(true);
    expect(videoSchema.safeParse({ ...b, url: "https://evil.com/x" }).success).toBe(false);
    expect(videoSchema.safeParse({ ...b, source: "upload" }).success).toBe(false);
    expect(videoSchema.safeParse({ ...b, source: "upload", storage_path: "videos/3f2a9c1e-5b7d-4e8a-9c3f-1a2b3c4d5e6f.mp4" }).success).toBe(true);
    expect(videoSchema.safeParse({ ...b, source: "upload", storage_path: "../x.mp4" }).success).toBe(false);
  });
  it("testimonial: needs feedback or video; rating 1-5; defaults to draft-able", () => {
    const b = { name: "Real Person", status: "draft" };
    expect(testimonialSchema.safeParse(b).success).toBe(false);
    expect(testimonialSchema.safeParse({ ...b, feedback: "Great day." }).success).toBe(true);
    expect(testimonialSchema.safeParse({ ...b, feedback: "x", rating: "6" }).success).toBe(false);
    expect(testimonialSchema.safeParse({ ...b, feedback: "x", rating: "4" }).success).toBe(true);
  });
  it("article/page slugs: valid, lowercase, not reserved", () => {
    const a = { title: "Hello", status: "draft", body: "x" };
    expect(articleSchema.safeParse({ ...a, slug: "hello-world" }).success).toBe(true);
    expect(articleSchema.safeParse({ ...a, slug: "Hello World" }).success).toBe(false);
    expect(articleSchema.safeParse({ ...a, slug: "new" }).success).toBe(false);
    expect(pageSchema.safeParse({ slug: "admin", title: "x", status: "draft" }).success).toBe(false);
  });
  it("social links: https and matching platform host only", () => {
    expect(socialSchema.safeParse({ platform: "youtube", url: "https://www.youtube.com/@influencia" }).success).toBe(true);
    expect(socialSchema.safeParse({ platform: "instagram", url: "https://youtube.com/x" }).success).toBe(false);
    expect(socialSchema.safeParse({ platform: "facebook", url: "http://facebook.com/x" }).success).toBe(false);
    expect(socialSchema.safeParse({ platform: "linkedin", url: "https://linkedin.com.evil.com/x" }).success).toBe(false);
    expect(socialSchema.safeParse({ platform: "linkedin", url: "" }).success).toBe(true);
  });
  it("nav items: site paths or https only", () => {
    expect(navItemSchema.safeParse({ label: "About", href: "/about", visible: true }).success).toBe(true);
    expect(navItemSchema.safeParse({ label: "X", href: "javascript:alert(1)", visible: true }).success).toBe(false);
    expect(navItemSchema.safeParse({ label: "X", href: "//evil.com", visible: true }).success).toBe(false);
  });
  it("gallery item schema coerces order and flags", () => {
    expect(galleryItemSchema.parse({ caption: " Hi ", sort_order: "3", featured: "on", status: "published" })).toMatchObject({ caption: "Hi", sort_order: 3, featured: true });
  });
});

describe("branding (speaker portrait + logo)", () => {
  const ok = "branding/3f2a9c1e-5b7d-4e8a-9c3f-1a2b3c4d5e6f.png";
  it("accepts our own branding uploads and defaults the style to cut-out", () => {
    const r = brandingSchema.parse({ speaker_path: ok, logo_path: "branding/3f2a9c1e-5b7d-4e8a-9c3f-1a2b3c4d5e70.webp" });
    expect(r.speaker_style).toBe("cutout"); expect(r.speaker_path).toBe(ok);
    expect(brandingSchema.parse({ speaker_path: ok, speaker_style: "circle" }).speaker_style).toBe("circle");
    expect(brandingSchema.parse({ speaker_path: ok, speaker_style: "weird" }).speaker_style).toBe("cutout");
  });
  it("allows empty slots (remove)", () => { expect(brandingSchema.parse({ speaker_path: "", logo_path: "" })).toMatchObject({ speaker_path: "", logo_path: "" }); });
  it("rejects other folders, videos, svg, traversal and URLs", () => {
    for (const bad of ["gallery/3f2a9c1e-5b7d-4e8a-9c3f-1a2b3c4d5e6f.png", "branding/x.mp4", "branding/x.svg", "../branding/x.png", "https://evil.example/x.png", "/branding/x.png"])
      expect(brandingSchema.safeParse({ speaker_path: bad }).success, bad).toBe(false);
  });
});
