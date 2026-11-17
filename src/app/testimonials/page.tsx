import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/public/PageShell";
import { TestimonialBlock } from "@/components/content/blocks";

export const metadata: Metadata = { title: "Testimonials · Influencia" };

export default function Page() {
  return <PageShell title="Testimonials" eyebrow="Media"><Suspense fallback={<p>Loading…</p>}><TestimonialBlock limit={50} /></Suspense></PageShell>;
}
