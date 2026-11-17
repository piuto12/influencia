import type { Metadata } from "next";
import { PageShell } from "@/components/public/PageShell";
import { RegistrationForm } from "@/components/public/registration/RegistrationForm";
import { edition } from "@/modules/events/site-content";

export const metadata: Metadata = { title: "Register · Influencia", description: `Reserve your seat for ${edition.title} ${edition.editionLabel}, ${edition.dateLabel}.` };

export default function Page() {
  return (
    <PageShell title="Reserve Your Seat" eyebrow={`${edition.editionLabel} · ${edition.dateLabel}`}>
      <p className="mb-10 text-charcoal/80">Open to entrepreneurs, corporate professionals, college faculty, students, business owners, managers and leaders, and the general public. Registration is paid; seats are confirmed after payment verification and organizer approval.</p>
      <RegistrationForm />
    </PageShell>
  );
}
