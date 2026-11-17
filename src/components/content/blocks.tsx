import Image from "next/image";
import Link from "next/link";
import { getArticles, getGallery, getPublicEditions, getTestimonials, getVideos } from "@/modules/content/queries";
import { mediaUrl } from "@/modules/content/media";
import { VideoCard } from "./VideoCard";
import { GalleryGrid } from "./GalleryGrid";
import { TestimonialCarousel } from "./TestimonialCarousel";
import { EmptyState } from "@/components/public/Section";
import { edition as fallbackEdition } from "@/modules/events/site-content";

export const toVideoProps = (v: Awaited<ReturnType<typeof getVideos>>[number]) => ({ title: v.title, description: v.description, source: v.source, url: v.url, storagePath: v.storage_path, thumbnailPath: v.thumbnail_path });

export async function VideoBlock({ limit = 3, featuredOnly = true }: { limit?: number; featuredOnly?: boolean }) {
  let vids = await getVideos({ featuredOnly, limit });
  if (!vids.length && featuredOnly) vids = await getVideos({ limit });
  if (!vids.length) return <EmptyState>Videos will appear here once published.</EmptyState>;
  return <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{vids.map((v) => <VideoCard key={v.id} v={toVideoProps(v)} />)}</div>;
}

export async function TestimonialBlock({ limit = 8 }: { limit?: number }) {
  const t = await getTestimonials({ limit });
  if (!t.length) return <EmptyState>Participant testimonials will be published here after approval.</EmptyState>;
  return <TestimonialCarousel items={t.map((x) => ({ id: x.id, name: x.name, role: [x.designation, x.organization].filter(Boolean).join(", "), feedback: x.feedback, photo: mediaUrl(x.photo_path), rating: x.rating }))} />;
}

export async function GalleryBlock({ limit = 8, editionCode }: { limit?: number; editionCode?: string }) {
  const { items } = await getGallery({ limit, editionCode });
  const images = items.flatMap((g) => { const src = mediaUrl(g.storage_path); return src ? [{ id: g.id, src, caption: g.caption }] : []; });
  if (!images.length) return <EmptyState>Gallery photos will appear here once uploaded.</EmptyState>;
  return <GalleryGrid images={images} />;
}

export async function BlogBlock({ limit = 3 }: { limit?: number }) {
  const a = await getArticles(limit);
  if (!a.length) return <EmptyState>Articles will appear here once published.</EmptyState>;
  return <ArticleGrid articles={a} />;
}
export function ArticleGrid({ articles }: { articles: Awaited<ReturnType<typeof getArticles>> }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{articles.map((a) => { const img = mediaUrl(a.featured_image_path); return (
      <article key={a.id} className="overflow-hidden rounded-2xl border border-charcoal/10 bg-white transition hover:-translate-y-1 hover:shadow-xl">
        <Link href={`/blog/${a.slug}`}>
          {img && <div className="relative aspect-[16/10]"><Image src={img} alt="" fill sizes="(min-width:1024px) 33vw, 100vw" className="object-cover" /></div>}
          <div className="p-5">{a.media_categories?.name && <p className="text-xs uppercase tracking-widest text-crimson">{a.media_categories.name}</p>}
            <h3 className="mt-1 font-serif text-xl">{a.title}</h3>{a.excerpt && <p className="mt-2 text-sm text-charcoal/70">{a.excerpt}</p>}</div>
        </Link>
      </article>); })}</div>
  );
}

export async function EditionsTimeline() {
  const eds = await getPublicEditions();
  const list = eds.length ? eds : [{ id: "f", code: fallbackEdition.code, edition_number: 3, title: `Influencia – ${fallbackEdition.editionLabel}`, subtitle: null, starts_at: fallbackEdition.startsAtIso, venue_name: fallbackEdition.venue, venue_city: null, status: "active" }];
  const label = (s: string) => ({ upcoming: "Upcoming", active: "Open now", completed: "Completed", archived: "Archived" }[s] ?? s);
  return (
    <ol className="relative grid gap-6 border-l-2 border-crimson/30 pl-8 md:grid-flow-col md:auto-cols-fr md:border-l-0 md:border-t-2 md:pl-0 md:pt-8">
      {list.map((e) => (
        <li key={e.id} className="relative list-none">
          <span aria-hidden className="absolute -left-[2.45rem] top-1 h-4 w-4 rounded-full bg-crimson md:-top-[2.45rem] md:left-0" />
          <h3 className="font-serif text-2xl"><Link href={`/editions#${e.code}`} className="hover:text-crimson">Edition {e.edition_number}</Link></h3>
          <p className="text-sm uppercase tracking-widest text-crimson">{label(e.status)}</p>
          <p className="text-charcoal/70">{e.starts_at ? new Date(e.starts_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" }) : "Date to be announced"}{e.venue_name ? ` · ${e.venue_name}` : ""}</p>
        </li>))}
    </ol>
  );
}
