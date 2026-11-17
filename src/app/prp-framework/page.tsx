import type { Metadata } from "next";
import { CmsPage } from "@/components/public/CmsPage";
import { edition } from "@/modules/events/site-content";

export const metadata: Metadata = { title: "The PRP Framework · Influencia" };

export default async function Page() {
  void edition;
  return (
    <CmsPage slug="prp-framework" title="The PRP Framework" eyebrow="Framework">
      <ol className="list-decimal space-y-3 pl-6"><li>Program Personal Mastery</li><li>Strengthen Relationships</li><li>Elevate Professional Excellence</li></ol>
    </CmsPage>
  );
}
