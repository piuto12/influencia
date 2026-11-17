import type { Metadata } from "next";
import { CmsPage } from "@/components/public/CmsPage";
import { edition } from "@/modules/events/site-content";

export const metadata: Metadata = { title: "Programme · Influencia" };

export default async function Page() {
  void edition;
  return (
    <CmsPage slug="programme" title="Programme" eyebrow="{edition.editionLabel}">
      <p><strong>{edition.tagline}</strong></p><p className="mt-4">{edition.duration} · {edition.weekday}, {edition.dateLabel} · {edition.venue}, {edition.city}</p><p className="mt-4 opacity-80">The detailed session schedule will be published by the organizer.</p>
    </CmsPage>
  );
}
