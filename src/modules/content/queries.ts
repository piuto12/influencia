import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { DEFAULT_SECTIONS, type SectionRow } from "./sections";

/** Everything public is read with the anonymous client, so RLS (published-only) is the guard, and cached under one tag. */
export const CONTENT_TAG = "content";

export async function getSections(): Promise<SectionRow[]> {
  "use cache"; cacheTag(CONTENT_TAG); cacheLife("minutes");
  const { data, error } = await createPublicClient().from("homepage_sections").select("id,type,sort_order,status,content").order("sort_order");
  if (error || !data?.length) return DEFAULT_SECTIONS;
  return data as SectionRow[];
}

export interface VideoRow { id: string; source: "youtube" | "vimeo" | "upload"; url: string | null; storage_path: string | null; thumbnail_path: string | null; title: string; description: string | null; featured: boolean }
export async function getVideos(opts: { featuredOnly?: boolean; limit?: number } = {}): Promise<VideoRow[]> {
  "use cache"; cacheTag(CONTENT_TAG); cacheLife("minutes");
  let q = createPublicClient().from("media_videos").select("id,source,url,storage_path,thumbnail_path,title,description,featured").order("featured", { ascending: false }).order("sort_order");
  if (opts.featuredOnly) q = q.eq("featured", true);
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q; return (data ?? []) as VideoRow[];
}

export interface TestimonialRow { id: string; name: string; designation: string | null; organization: string | null; photo_path: string | null; feedback: string | null; video_url: string | null; rating: number | null; featured: boolean }
export async function getTestimonials(opts: { featuredOnly?: boolean; limit?: number } = {}): Promise<TestimonialRow[]> {
  "use cache"; cacheTag(CONTENT_TAG); cacheLife("minutes");
  let q = createPublicClient().from("testimonials").select("id,name,designation,organization,photo_path,feedback,video_url,rating,featured").order("featured", { ascending: false }).order("created_at", { ascending: false });
  if (opts.featuredOnly) q = q.eq("featured", true);
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q; return (data ?? []) as TestimonialRow[];
}

export interface GalleryRow { id: string; edition_id: string; storage_path: string; caption: string | null; featured: boolean }
export async function getGallery(opts: { editionCode?: string; limit?: number } = {}): Promise<{ items: GalleryRow[]; editions: { id: string; code: string; title: string }[] }> {
  "use cache"; cacheTag(CONTENT_TAG); cacheLife("minutes");
  const db = createPublicClient();
  const { data: eds } = await db.from("event_editions").select("id,code,title").order("edition_number");
  const editions = eds ?? [];
  let q = db.from("media_gallery").select("id,edition_id,storage_path,caption,featured").order("featured", { ascending: false }).order("sort_order").order("created_at", { ascending: false });
  const ed = opts.editionCode ? editions.find((e) => e.code === opts.editionCode) : null;
  if (ed) q = q.eq("edition_id", ed.id);
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q; return { items: (data ?? []) as GalleryRow[], editions };
}

export interface EditionPublic { id: string; code: string; edition_number: number; title: string; subtitle: string | null; starts_at: string | null; venue_name: string | null; venue_city: string | null; status: string }
export async function getPublicEditions(): Promise<EditionPublic[]> {
  "use cache"; cacheTag(CONTENT_TAG); cacheLife("minutes");
  const { data } = await createPublicClient().from("event_editions").select("id,code,edition_number,title,subtitle,starts_at,venue_name,venue_city,status").order("edition_number");
  return (data ?? []) as EditionPublic[];
}

export interface ArticleRow { id: string; slug: string; title: string; excerpt: string | null; body: string; author: string | null; featured_image_path: string | null; seo: { title?: string; description?: string }; published_at: string | null; media_categories: { name: string } | null }
const ART = "id,slug,title,excerpt,body,author,featured_image_path,seo,published_at,media_categories(name)";
export async function getArticles(limit?: number): Promise<ArticleRow[]> {
  "use cache"; cacheTag(CONTENT_TAG); cacheLife("minutes");
  let q = createPublicClient().from("blog_articles").select(ART).order("published_at", { ascending: false, nullsFirst: false });
  if (limit) q = q.limit(limit);
  const { data } = await q; return (data ?? []) as unknown as ArticleRow[];
}
export async function getArticle(slug: string): Promise<ArticleRow | null> {
  "use cache"; cacheTag(CONTENT_TAG); cacheLife("minutes");
  const { data } = await createPublicClient().from("blog_articles").select(ART).eq("slug", slug).maybeSingle();
  return (data as unknown as ArticleRow) ?? null;
}

export interface PageRow { slug: string; title: string; body: string; seo: { title?: string; description?: string } }
export async function getPage(slug: string): Promise<PageRow | null> {
  "use cache"; cacheTag(CONTENT_TAG); cacheLife("minutes");
  const { data } = await createPublicClient().from("content_pages").select("slug,title,body,seo").eq("slug", slug).maybeSingle();
  return (data as PageRow) ?? null;
}

export async function getSocialLinks(): Promise<{ platform: string; url: string }[]> {
  "use cache"; cacheTag(CONTENT_TAG); cacheLife("minutes");
  const { data } = await createPublicClient().from("social_links").select("platform,url").order("platform");
  return data ?? [];
}

export interface NavItem { label: string; href: string; visible: boolean }
export async function getNav(): Promise<NavItem[] | null> {
  "use cache"; cacheTag(CONTENT_TAG); cacheLife("minutes");
  const { data } = await createPublicClient().from("site_settings").select("value").eq("key", "nav").eq("is_public", true).maybeSingle();
  const items = (data?.value as { items?: NavItem[] } | undefined)?.items;
  return Array.isArray(items) && items.length ? items : null;
}

export interface Branding { speaker_path?: string; speaker_style?: "cutout" | "circle"; speaker_alt?: string; logo_path?: string; logo_alt?: string }
/** Admin-managed speaker portrait and logo (site_settings key "branding", public). Empty object when nothing is set. */
export async function getBranding(): Promise<Branding> {
  "use cache"; cacheTag(CONTENT_TAG); cacheLife("minutes");
  const { data } = await createPublicClient().from("site_settings").select("value").eq("key", "branding").eq("is_public", true).maybeSingle();
  return ((data?.value ?? {}) as Branding);
}
