import { SiteHeader } from "@/components/public/SiteHeader";
import { Hero } from "@/components/public/Hero";
import { Footer } from "@/components/public/Footer";
import { HomeSection } from "@/components/public/HomeSections";
import { getSections } from "@/modules/content/queries";
import { JsonLd } from "@/components/public/JsonLd";
import { edition } from "@/modules/events/site-content";

export default async function Home() {
  const sections = (await getSections()).filter((s) => s.status === "published").sort((a, b) => a.sort_order - b.sort_order);
  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Event", name: `${edition.title} – ${edition.editionLabel}`, description: edition.tagline,
        startDate: edition.startsAtIso.slice(0, 10), eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", eventStatus: "https://schema.org/EventScheduled",
        location: { "@type": "Place", name: edition.venue, address: { "@type": "PostalAddress", addressLocality: "Calicut", addressRegion: "Kerala", addressCountry: "IN" } },
        organizer: { "@type": "Organization", name: "Influencia Team" }, performer: { "@type": "Person", name: edition.speaker },
      }} />
      <SiteHeader />
      <main>
        <Hero />
        {sections.map((s) => <HomeSection key={s.id} s={s} />)}
      </main>
      <Footer />
    </>
  );
}
