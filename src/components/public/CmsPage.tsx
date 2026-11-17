import type { ReactNode } from "react";
import { getPage } from "@/modules/content/queries";
import { Markdown } from "@/components/content/Markdown";
import { PageShell } from "./PageShell";

/** If an admin has published a page with this slug it wins; otherwise the built-in fallback content renders. */
export async function CmsPage({ slug, title, eyebrow, children }: { slug: string; title: string; eyebrow?: string; children: ReactNode }) {
  const page = await getPage(slug);
  return (
    <PageShell title={page?.title || title} eyebrow={eyebrow}>
      {page ? <Markdown>{page.body}</Markdown> : children}
    </PageShell>
  );
}
