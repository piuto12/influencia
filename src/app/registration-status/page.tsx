import type { Metadata } from "next";
import { PageShell } from "@/components/public/PageShell";
import { StatusForm } from "@/components/public/registration/StatusForm";

export const metadata: Metadata = { title: "Registration Status · Influencia" };

export default function Page() {
  return (
    <PageShell title="Registration Status" eyebrow="Check your registration">
      <StatusForm />
    </PageShell>
  );
}
