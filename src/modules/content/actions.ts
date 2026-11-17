"use server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ForbiddenError, requirePermission } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getAdmin } from "@/lib/auth";
import { audit, run, text } from "@/modules/admin/helpers";
import { parseVideoUrl } from "./video";
import { slugify } from "./slug";
import { checkUpload, FOLDERS, isSafeMediaPath, MEDIA_BUCKET, type Folder, type UploadKind } from "./media";
import { SECTION_TYPES, type SectionType } from "./sections";
import { articleSchema, editionCreateSchema, galleryItemSchema, navItemSchema, pageSchema, sectionSchema, socialSchema, testimonialSchema, videoSchema } from "./schemas";
import { istToIso } from "@/modules/admin/schemas";

const db = () => createAdminClient();
const fail = (m = "invalid_input"): never => { throw new Error(m); };
const form = (fd: FormData) => Object.fromEntries(fd.entries());

async function ensureCategory(kind: "gallery" | "video" | "blog", name: string): Promise<string | null> {
  const n = name.trim(); if (!n) return null;
  const slug = slugify(n); if (!slug) return null;
  const { data } = await db().from("media_categories").upsert({ kind, name: n, slug }, { onConflict: "kind,slug" }).select("id").single();
  return data?.id ?? null;
}

// ---------- uploads (direct browser -> Storage via one-time signed URL) ----------
export type UploadTicket = { ok: true; path: string; token: string } | { ok: false; error: string };
export async function requestUpload(kind: UploadKind, folder: string, mime: string, size: number): Promise<UploadTicket> {
  try {
    const a = await getAdmin();
    if (!a || !(can(a.role, "media.manage") || can(a.role, "content.manage"))) return { ok: false, error: "forbidden" };
    if (!(FOLDERS as readonly string[]).includes(folder)) return { ok: false, error: "invalid_input" };
    const c = checkUpload(kind, mime, size);
    if (!c.ok) return { ok: false, error: c.reason };
    const path = `${folder as Folder}/${crypto.randomUUID()}.${c.ext}`;
    if (!isSafeMediaPath(path)) return { ok: false, error: "invalid_input" };
    const { data, error } = await db().storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
    if (error || !data) return { ok: false, error: "unavailable" };
    return { ok: true, path, token: data.token };
  } catch { return { ok: false, error: "unavailable" }; }
}

// ---------- homepage sections ----------
export async function saveSection(fd: FormData) {
  const id = text(fd, "id"); const path = "/admin/content/sections";
  await run(path, id ? "Section saved." : "Section added.", async () => {
    const a = await requirePermission("content.manage");
    const p = sectionSchema.safeParse(form(fd)); if (!p.success) fail();
    const d = p.data!;
    const content = { eyebrow: d.eyebrow, title: d.title, body: d.body, cta_label: d.cta_label, cta_href: d.cta_href };
    if (id) {
      const { data: before } = await db().from("homepage_sections").select("content,status").eq("id", id).single();
      const { error } = await db().from("homepage_sections").update({ content, status: d.status, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) fail(error.message);
      await audit(a.adminId, "section.updated", "homepage_section", id, before, { content, status: d.status });
    } else {
      if (!SECTION_TYPES[d.type as SectionType]?.custom) fail();
      const { data: last } = await db().from("homepage_sections").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
      const { data, error } = await db().from("homepage_sections").insert({ type: d.type, content, status: d.status, sort_order: (last?.sort_order ?? 0) + 10 }).select("id").single();
      if (error) fail(error.message);
      await audit(a.adminId, "section.created", "homepage_section", data!.id, null, { type: d.type });
    }
  });
}
export async function moveSection(fd: FormData) {
  const id = text(fd, "id"); const dir = text(fd, "dir") === "up" ? -1 : 1;
  await run("/admin/content/sections", "Order updated.", async () => {
    const a = await requirePermission("content.manage");
    const { data: all } = await db().from("homepage_sections").select("id,sort_order").order("sort_order");
    const list = all ?? []; const i = list.findIndex((s) => s.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    // renumber so equal/odd sort_order values can never block a swap
    const ids = list.map((s) => s.id); [ids[i], ids[j]] = [ids[j], ids[i]];
    for (let k = 0; k < ids.length; k++) await db().from("homepage_sections").update({ sort_order: (k + 1) * 10 }).eq("id", ids[k]);
    await audit(a.adminId, "section.reordered", "homepage_section", id, null, { dir });
  });
}
export async function deleteSection(fd: FormData) {
  const id = text(fd, "id");
  await run("/admin/content/sections", "Section removed.", async () => {
    const a = await requirePermission("content.manage");
    const { data: s } = await db().from("homepage_sections").select("type").eq("id", id).single();
    if (!s || !SECTION_TYPES[s.type as SectionType]?.custom) fail(); // built-in sections can be hidden, not deleted
    await db().from("homepage_sections").delete().eq("id", id);
    await audit(a.adminId, "section.deleted", "homepage_section", id);
  });
}

// ---------- videos ----------
export async function saveVideo(fd: FormData) {
  const id = text(fd, "id"); const path = "/admin/media/videos";
  await run(path, "Video saved.", async () => {
    const a = await requirePermission("media.manage");
    const p = videoSchema.safeParse(form(fd)); if (!p.success) fail(p.error.issues[0]?.message === "invalid_video_url" ? "invalid_video_url" : "invalid_input");
    const d = p.data!; const parsed = d.source === "link" ? parseVideoUrl(d.url)! : null;
    const row = { title: d.title, description: d.description || null, source: parsed ? parsed.source : "upload", url: parsed ? parsed.watchUrl : null,
      storage_path: d.source === "upload" ? d.storage_path : null, thumbnail_path: d.thumbnail_path || null,
      category_id: await ensureCategory("video", d.category), featured: d.featured, sort_order: d.sort_order, status: d.status };
    const q = id ? db().from("media_videos").update(row).eq("id", id).select("id").single() : db().from("media_videos").insert(row).select("id").single();
    const { data, error } = await q; if (error) fail(error.message);
    await audit(a.adminId, id ? "video.updated" : "video.created", "video", data!.id, null, { title: d.title, status: d.status });
  });
}
export async function deleteVideo(fd: FormData) { await del(fd, "media_videos", "video", "/admin/media/videos"); }

// ---------- testimonials (only status=published is public: "approved") ----------
export async function saveTestimonial(fd: FormData) {
  const id = text(fd, "id");
  await run("/admin/media/testimonials", "Testimonial saved.", async () => {
    const a = await requirePermission("media.manage");
    const p = testimonialSchema.safeParse(form(fd)); if (!p.success) fail();
    const d = p.data!;
    let edition_id: string | null = null;
    if (d.edition_code) { const { data } = await db().from("event_editions").select("id").eq("code", d.edition_code).maybeSingle(); edition_id = data?.id ?? null; }
    const row = { name: d.name, designation: d.designation || null, organization: d.organization || null, feedback: d.feedback || null,
      video_url: d.video_url ? parseVideoUrl(d.video_url)!.watchUrl : null, photo_path: d.photo_path || null, rating: d.rating, edition_id, featured: d.featured, status: d.status };
    const q = id ? db().from("testimonials").update(row).eq("id", id).select("id").single() : db().from("testimonials").insert(row).select("id").single();
    const { data, error } = await q; if (error) fail(error.message);
    await audit(a.adminId, id ? "testimonial.updated" : "testimonial.created", "testimonial", data!.id, null, { status: d.status });
  });
}
export async function deleteTestimonial(fd: FormData) { await del(fd, "testimonials", "testimonial", "/admin/media/testimonials"); }

// ---------- gallery ----------
export async function addGalleryItems(editionCode: string, paths: string[], publish: boolean): Promise<{ ok: boolean; added: number }> {
  try {
    const a = await requirePermission("media.manage");
    const safe = paths.filter((p) => p.startsWith("gallery/") && isSafeMediaPath(p)).slice(0, 100);
    const { data: ed } = await db().from("event_editions").select("id").eq("code", editionCode).maybeSingle();
    if (!ed || !safe.length) return { ok: false, added: 0 };
    const { error } = await db().from("media_gallery").insert(safe.map((storage_path) => ({ edition_id: ed.id, storage_path, status: publish ? "published" : "draft" })));
    if (error) return { ok: false, added: 0 };
    await audit(a.adminId, "gallery.uploaded", "edition", ed.id, null, { count: safe.length, publish });
    const { updateTag } = await import("next/cache"); const { CONTENT_TAG } = await import("./queries"); updateTag(CONTENT_TAG);
    return { ok: true, added: safe.length };
  } catch (e) { if (e instanceof ForbiddenError) return { ok: false, added: 0 }; throw e; }
}
export async function saveGalleryItem(fd: FormData) {
  const id = text(fd, "id"); const code = text(fd, "code");
  await run(`/admin/media/gallery?edition=${code}`, "Photo saved.", async () => {
    const a = await requirePermission("media.manage");
    const p = galleryItemSchema.safeParse(form(fd)); if (!p.success) fail();
    const d = p.data!;
    const { error } = await db().from("media_gallery").update({ caption: d.caption || null, sort_order: d.sort_order, featured: d.featured, status: d.status }).eq("id", id);
    if (error) fail(error.message);
    await audit(a.adminId, "gallery.updated", "gallery_item", id, null, { status: d.status });
  });
}
export async function deleteGalleryItem(fd: FormData) {
  const code = text(fd, "code");
  await del(fd, "media_gallery", "gallery_item", `/admin/media/gallery?edition=${code}`, true);
}

// ---------- blog & pages ----------
export async function saveArticle(fd: FormData) {
  const id = text(fd, "id");
  await run("/admin/content/blog", "Article saved.", async () => {
    const a = await requirePermission("content.manage");
    const p = articleSchema.safeParse(form(fd)); if (!p.success) fail();
    const d = p.data!;
    const { data: clash } = await db().from("blog_articles").select("id").eq("slug", d.slug).maybeSingle();
    if (clash && clash.id !== id) fail("slug_taken");
    const { data: cur } = id ? await db().from("blog_articles").select("published_at,status").eq("id", id).maybeSingle() : { data: null };
    const row = { title: d.title, slug: d.slug, excerpt: d.excerpt || null, body: d.body, author: d.author || null, featured_image_path: d.featured_image_path || null,
      category_id: await ensureCategory("blog", d.category), seo: { title: d.seo_title || undefined, description: d.seo_description || undefined }, status: d.status,
      published_at: d.status === "published" ? (cur?.published_at ?? new Date().toISOString()) : null, updated_at: new Date().toISOString() };
    const q = id ? db().from("blog_articles").update(row).eq("id", id).select("id").single() : db().from("blog_articles").insert(row).select("id").single();
    const { data, error } = await q; if (error) fail(error.message);
    await audit(a.adminId, id ? "article.updated" : "article.created", "article", data!.id, cur, { slug: d.slug, status: d.status });
  });
}
export async function deleteArticle(fd: FormData) { await del(fd, "blog_articles", "article", "/admin/content/blog"); }

export async function savePage(fd: FormData) {
  await run("/admin/content/pages", "Page saved.", async () => {
    const a = await requirePermission("content.manage");
    const p = pageSchema.safeParse(form(fd)); if (!p.success) fail();
    const d = p.data!;
    const row = { slug: d.slug, title: d.title, body: d.body, seo: { title: d.seo_title || undefined, description: d.seo_description || undefined }, status: d.status, updated_at: new Date().toISOString() };
    const { error } = await db().from("content_pages").upsert(row, { onConflict: "slug" }); if (error) fail(error.message);
    await audit(a.adminId, "page.saved", "content_page", d.slug, null, { status: d.status });
  });
}
export async function deletePage(fd: FormData) { await del(fd, "content_pages", "page", "/admin/content/pages", false, "slug"); }

// ---------- social links & navigation ----------
export async function saveSocial(fd: FormData) {
  await run("/admin/settings/social", "Social links saved.", async () => {
    const a = await requirePermission("settings.manage");
    for (const platform of ["youtube", "instagram", "facebook", "linkedin"]) {
      const p = socialSchema.safeParse({ platform, url: text(fd, `${platform}_url`), enabled: text(fd, `${platform}_enabled`) });
      if (!p.success) fail();
      const d = p.data!;
      if (!d.url) await db().from("social_links").delete().eq("platform", platform);
      else { const { error } = await db().from("social_links").upsert({ platform, url: d.url, enabled: d.enabled }, { onConflict: "platform" }); if (error) fail(error.message); }
    }
    await audit(a.adminId, "social.updated", "social_links", "all");
  });
}
export async function saveNavigation(fd: FormData) {
  await run("/admin/settings/navigation", "Navigation saved.", async () => {
    const a = await requirePermission("settings.manage");
    const items = [];
    for (let i = 0; i < 20; i++) {
      const label = text(fd, `label_${i}`).trim(); const href = text(fd, `href_${i}`).trim();
      if (!label && !href) continue;
      const p = navItemSchema.safeParse({ label, href, visible: text(fd, `visible_${i}`) === "on" }); if (!p.success) fail();
      items.push(p.data!);
    }
    if (!items.length) { await db().from("site_settings").delete().eq("key", "nav"); } // empty = use built-in navigation
    else { const { error } = await db().from("site_settings").upsert({ key: "nav", value: { items }, is_public: true }, { onConflict: "key" }); if (error) fail(error.message); }
    await audit(a.adminId, "navigation.updated", "site_settings", "nav", null, { count: items.length });
  });
}

// ---------- editions ----------
export async function createEdition(fd: FormData) {
  await run("/admin/settings/editions", "Edition created as a draft. Configure payments next.", async () => {
    const a = await requirePermission("events.manage");
    const p = editionCreateSchema.safeParse(form(fd)); if (!p.success) fail();
    const d = p.data!;
    const { data: ev } = await db().from("events").select("id").eq("slug", "influencia").single();
    const { data: last } = await db().from("event_editions").select("edition_number").order("edition_number", { ascending: false }).limit(1).maybeSingle();
    const n = (last?.edition_number ?? 0) + 1;
    const { data: ed, error } = await db().from("event_editions").insert({ event_id: ev!.id, edition_number: n, code: `INF${n}`, title: d.title, subtitle: d.subtitle || null,
      starts_at: istToIso(d.starts_at), venue_name: d.venue_name || null, venue_city: d.venue_city || null, capacity: d.capacity, status: "draft", registration_open: false }).select("id").single();
    if (error) fail(error.message);
    const { data: methods } = await db().from("payment_methods").select("code");
    await db().from("payment_settings").insert((methods ?? []).map((m) => ({ edition_id: ed!.id, method_code: m.code, enabled: false, fee_amount: 0 })));
    await audit(a.adminId, "edition.created", "edition", ed!.id, null, { code: `INF${n}`, title: d.title });
  });
}

// ---------- shared delete ----------
async function del(fd: FormData, table: string, entity: string, path: string, withCode = false, key = "id") {
  const id = text(fd, key);
  await run(path, "Deleted.", async () => {
    const a = await requirePermission(table === "blog_articles" || table === "content_pages" ? "content.manage" : "media.manage");
    const { error } = await db().from(table).delete().eq(key, id); if (error) fail(error.message);
    await audit(a.adminId, `${entity}.deleted`, entity, id);
  });
  void withCode;
}
