import type { Metadata } from "next";
import { CmsPage } from "@/components/public/CmsPage";
import { edition } from "@/modules/events/site-content";

export const metadata: Metadata = { title: "Dr. Rashid Gazzali · Influencia" };

export default async function Page() {
  void edition;
  return (
    <CmsPage slug="rashid-gazzali" title="Dr. Rashid Gazzali" eyebrow="The speaker">
      <p>{edition.speaker} personally leads Influencia and guides participants through the programme. A full biography will be published here once supplied by the organizer.</p>
    </CmsPage>
  );
}
