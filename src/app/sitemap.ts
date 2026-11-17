import type { MetadataRoute } from "next";
import { getArticles } from "@/modules/content/queries";

const STATIC = ["", "/about", "/about/rashid-gazzali", "/prp-framework", "/programme", "/videos", "/testimonials", "/gallery", "/editions", "/blog", "/register", "/contact", "/privacy", "/terms", "/certificates/verify"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const articles = await getArticles(500).catch(() => []);
  return [
    ...STATIC.map((p) => ({ url: `${base}${p}`, changeFrequency: p === "" ? ("daily" as const) : ("weekly" as const), priority: p === "" ? 1 : p === "/register" ? 0.9 : 0.6 })),
    ...articles.map((a) => ({ url: `${base}/blog/${a.slug}`, lastModified: a.published_at ?? undefined, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
