import type { Metadata } from "next";
import { CmsPage } from "@/components/public/CmsPage";
import { edition } from "@/modules/events/site-content";

export const metadata: Metadata = { title: "Privacy Policy · Influencia" };

export default async function Page() {
  void edition;
  return (
    <CmsPage slug="privacy" title="Privacy Policy" eyebrow="Legal">
      <p className="opacity-80">The privacy policy will be published here before registration opens. Draft pending organizer and legal review.</p>
    </CmsPage>
  );
}
