import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const db = () => createAdminClient();
const ok = <T,>(r: { data: T | null; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data as T; };

export const adminSections = async () => ok(await db().from("homepage_sections").select("*").order("sort_order"));
export const adminVideos = async () => ok(await db().from("media_videos").select("*,media_categories(name)").order("created_at", { ascending: false }));
export const adminTestimonials = async () => ok(await db().from("testimonials").select("*,event_editions(code)").order("created_at", { ascending: false }));
export const adminGallery = async (editionId: string) => ok(await db().from("media_gallery").select("*").eq("edition_id", editionId).order("sort_order").order("created_at", { ascending: false }));
export const adminArticles = async () => ok(await db().from("blog_articles").select("*,media_categories(name)").order("updated_at", { ascending: false }));
export const adminPages = async () => ok(await db().from("content_pages").select("*").order("slug"));
export const adminSocial = async () => ok(await db().from("social_links").select("*"));
export const adminNav = async () => { const r = await db().from("site_settings").select("value").eq("key", "nav").maybeSingle(); return (r.data?.value as { items?: { label: string; href: string; visible: boolean }[] } | undefined)?.items ?? null; };
export const adminEditions = async () => ok(await db().from("event_editions").select("id,code,edition_number,title,status,is_featured,starts_at,capacity,registration_open").order("edition_number", { ascending: false }));
