import type { Metadata } from "next";
import { CmsPage } from "@/components/public/CmsPage";
import { edition } from "@/modules/events/site-content";

export const metadata: Metadata = { title: "Terms and Conditions · Influencia" };

export default async function Page() {
  void edition;
  return (
    <CmsPage slug="terms" title="Terms and Conditions" eyebrow="Legal">
      <p className="opacity-80">Terms and conditions will be published here before registration opens. Draft pending organizer and legal review.</p>
    </CmsPage>
  );
}
