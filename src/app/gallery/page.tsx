import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/public/PageShell";
import { GalleryGrid } from "@/components/content/GalleryGrid";
import { EmptyState } from "@/components/public/Section";
import { getGallery } from "@/modules/content/queries";
import { mediaUrl } from "@/modules/content/media";

export const metadata: Metadata = { title: "Photo Gallery · Influencia" };

async function Galleries() {
  const { items, editions } = await getGallery({});
  const groups = editions.map((e) => ({ e, imgs: items.filter((i) => i.edition_id === e.id).flatMap((g) => { const src = mediaUrl(g.storage_path); return src ? [{ id: g.id, src, caption: g.caption }] : []; }) })).filter((g) => g.imgs.length);
  if (!groups.length) return <EmptyState>Gallery photos will appear here once uploaded.</EmptyState>;
  return <div className="space-y-14">{groups.map(({ e, imgs }) => <section key={e.id} aria-labelledby={`g-${e.code}`}><h2 id={`g-${e.code}`} className="mb-4 font-serif text-2xl">{e.title}</h2><GalleryGrid images={imgs} /></section>)}</div>;
}
export default function Page() {
  return <PageShell title="Photo Gallery" eyebrow="Media"><Suspense fallback={<p>Loading…</p>}><Galleries /></Suspense></PageShell>;
}
