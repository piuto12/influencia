import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageShell } from "@/components/public/PageShell";
import { Markdown } from "@/components/content/Markdown";
import { getArticle } from "@/modules/content/queries";
import { mediaUrl } from "@/modules/content/media";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const a = await getArticle((await params).slug);
  if (!a) return { title: "Article not found" };
  const img = mediaUrl(a.featured_image_path);
  return { title: a.seo?.title || `${a.title} · Influencia`, description: a.seo?.description || a.excerpt || undefined,
    openGraph: { title: a.seo?.title || a.title, description: a.seo?.description || a.excerpt || undefined, type: "article", images: img ? [img] : undefined } };
}

async function Article({ params }: P) {
  const a = await getArticle((await params).slug);
  if (!a) notFound();
  const img = mediaUrl(a.featured_image_path);
  return (
    <PageShell title={a.title} eyebrow={[a.media_categories?.name, a.author].filter(Boolean).join(" · ") || "Article"}>
      {img && <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-2xl"><Image src={img} alt="" fill priority sizes="(min-width:1024px) 896px, 100vw" className="object-cover" /></div>}
      <Markdown>{a.body}</Markdown>
    </PageShell>
  );
}
export default function Page(props: P) { return <Suspense fallback={<p className="p-8">Loading…</p>}><Article {...props} /></Suspense>; }
