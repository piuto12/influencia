import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/public/PageShell";
import { BlogBlock } from "@/components/content/blocks";

export const metadata: Metadata = { title: "Blog · Influencia", description: "Articles from the Influencia team." };

export default function Page() {
  return <PageShell title="Blog" eyebrow="Articles"><Suspense fallback={<p>Loading…</p>}><BlogBlock limit={60} /></Suspense></PageShell>;
}
