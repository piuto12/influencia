import type { Metadata } from "next";
import { CmsPage } from "@/components/public/CmsPage";
import { edition } from "@/modules/events/site-content";

export const metadata: Metadata = { title: "Contact · Influencia" };

export default async function Page() {
  void edition;
  return (
    <CmsPage slug="contact" title="Contact" eyebrow="Get in touch">
      <ul className="space-y-2"><li>Office: +91 8589990060</li><li>Sahla: +91 9544724262</li><li>Basil Baby: +91 9207097235</li></ul>
    </CmsPage>
  );
}
