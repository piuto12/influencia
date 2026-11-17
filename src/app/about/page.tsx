import type { Metadata } from "next";
import { CmsPage } from "@/components/public/CmsPage";
import { edition } from "@/modules/events/site-content";

export const metadata: Metadata = { title: "About Influencia · Influencia" };

export default async function Page() {
  void edition;
  return (
    <CmsPage slug="about" title="About Influencia" eyebrow="Influencia">
      <p>Influencia — {edition.editionLabel} is a {edition.duration} programming workshop led by {edition.speaker}, held on {edition.dateLabel} at {edition.venue}, {edition.city}. The framework behind it is the PRP Framework: Program Personal Mastery, Strengthen Relationships and Elevate Professional Excellence.</p>
    </CmsPage>
  );
}
