import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/public/PageShell";
import { VideoBlock } from "@/components/content/blocks";

export const metadata: Metadata = { title: "Videos · Influencia", description: "Watch videos from Influencia." };

export default function Page() {
  return <PageShell title="Videos" eyebrow="Media"><Suspense fallback={<p>Loading…</p>}><VideoBlock featuredOnly={false} limit={60} /></Suspense></PageShell>;
}
