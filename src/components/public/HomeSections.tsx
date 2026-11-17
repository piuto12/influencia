import Link from "next/link";
import { Suspense } from "react";
import { Section } from "./Section";
import { PrpFramework } from "./PrpFramework";
import { ButtonLink } from "./Button";
import { Reveal } from "@/components/motion/Reveal";
import { AnimatedStat } from "@/components/motion/AnimatedStat";
import { Markdown } from "@/components/content/Markdown";
import { BlogBlock, EditionsTimeline, GalleryBlock, TestimonialBlock, VideoBlock } from "@/components/content/blocks";
import { audience, contacts, edition, highlights, waLink } from "@/modules/events/site-content";
import { isSectionType, safeHref, type SectionRow } from "@/modules/content/sections";

const Skeleton = () => <div className="h-48 animate-pulse rounded-2xl bg-charcoal/10" />;

export function HomeSection({ s }: { s: SectionRow }) {
  if (!isSectionType(s.type)) return null;
  const c = s.content ?? {};
  const common = { id: s.type, eyebrow: c.eyebrow, title: c.title ?? "" };
  const cta = safeHref(c.cta_href);
  switch (s.type) {
    case "speaker":
      return <Section {...common} tone="white"><Reveal><div className="max-w-2xl text-lg text-charcoal/80">
        {c.body ? <Markdown>{c.body}</Markdown> : <p>Influencia is led personally by {edition.speaker}, who guides every participant through the programme.</p>}
        <Link href="/about/rashid-gazzali" className="mt-3 inline-block font-semibold text-crimson underline underline-offset-4">Read more</Link></div></Reveal></Section>;
    case "about":
      return <Section {...common}>
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr]">
          <Reveal>{c.body ? <Markdown className="text-lg text-charcoal/80">{c.body}</Markdown> : <p className="text-lg text-charcoal/80">Influencia — {edition.editionLabel} is a {edition.duration} programming workshop on {edition.dateLabel} at {edition.venue}, {edition.city}. It is open to {audience.slice(0, -1).join(", ").toLowerCase()} and the {audience.at(-1)!.toLowerCase()}.</p>}</Reveal>
          <Reveal delay={0.1}><ul className="grid grid-cols-2 gap-2 text-sm">{audience.map((a) => <li key={a} className="rounded-full border border-crimson/25 bg-white px-4 py-2 text-center">{a}</li>)}</ul></Reveal>
        </div>
        <div className="mt-16 grid grid-cols-2 gap-8 md:grid-cols-4">
          <AnimatedStat value={7} label="Hours" /><AnimatedStat value={3} label="PRP pillars" /><AnimatedStat value={7} label="Audience categories" /><AnimatedStat value={edition.capacity} label="Seats" />
        </div></Section>;
    case "prp": return <Section {...common} tone="dark"><PrpFramework /></Section>;
    case "highlights":
      return <Section {...common} tone="white"><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{highlights.map((h, i) => (
        <Reveal key={h.title} delay={i * 0.06}><article className="h-full rounded-2xl border border-crimson/15 bg-warm p-7 transition hover:-translate-y-1 hover:shadow-xl">
          <span className="font-display text-3xl text-crimson">{String(i + 1).padStart(2, "0")}</span><h3 className="mt-3 font-serif text-xl">{h.title}</h3><p className="mt-2 text-charcoal/75">{h.body}</p></article></Reveal>))}</div></Section>;
    case "video": return <Section {...common}><Suspense fallback={<Skeleton />}><VideoBlock /></Suspense><p className="mt-6"><Link href="/videos" className="font-semibold text-crimson underline underline-offset-4">All videos</Link></p></Section>;
    case "editions": return <Section {...common} tone="white"><Suspense fallback={<Skeleton />}><EditionsTimeline /></Suspense></Section>;
    case "testimonials": return <Section {...common}><Suspense fallback={<Skeleton />}><TestimonialBlock /></Suspense></Section>;
    case "gallery": return <Section {...common} tone="white"><Suspense fallback={<Skeleton />}><GalleryBlock limit={8} /></Suspense><p className="mt-6"><Link href="/gallery" className="font-semibold text-crimson underline underline-offset-4">Full gallery</Link></p></Section>;
    case "blog": return <Section {...common}><Suspense fallback={<Skeleton />}><BlogBlock /></Suspense><p className="mt-6"><Link href="/blog" className="font-semibold text-crimson underline underline-offset-4">All articles</Link></p></Section>;
    case "contact":
      return <Section {...common} tone="dark"><div className="grid gap-5 sm:grid-cols-3">{contacts.map((ct) => (
        <div key={ct.name} className="rounded-2xl border border-white/20 p-6"><p className="text-xs uppercase tracking-[0.3em] text-gold">{ct.name}</p>
          <a href={`tel:${ct.phone.replace(/\s/g, "")}`} className="mt-2 block text-xl">{ct.phone}</a>
          <a href={waLink(ct.wa, `Hello, I have a question about ${edition.title} ${edition.editionLabel}.`)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm underline underline-offset-4">Chat on WhatsApp</a></div>))}</div>
        <div className="mt-12"><ButtonLink href="/register">Reserve Your Seat</ButtonLink></div></Section>;
    case "text": return <Section {...common}><Reveal><Markdown className="max-w-3xl text-lg text-charcoal/80">{c.body ?? ""}</Markdown></Reveal>{cta && c.cta_label && <div className="mt-8"><ButtonLink href={cta} variant="solid" external={!cta.startsWith("/")}>{c.cta_label}</ButtonLink></div>}</Section>;
    case "cta": return <Section {...common} tone="dark">{c.body && <Markdown className="max-w-2xl text-lg text-white/85">{c.body}</Markdown>}{cta && c.cta_label && <div className="mt-8"><ButtonLink href={cta} external={!cta.startsWith("/")}>{c.cta_label}</ButtonLink></div>}</Section>;
  }
}
