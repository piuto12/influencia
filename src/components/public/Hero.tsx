import Image from "next/image";
import fs from "node:fs";
import path from "node:path";
import { edition } from "@/modules/events/site-content";
import { CircleField } from "@/components/motion/CircleField";
import { TextReveal } from "@/components/motion/TextReveal";
import { Countdown } from "@/components/motion/Countdown";
import { ImageReveal } from "@/components/motion/ImageReveal";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink } from "./Button";

/** Optional official cut-out. Drop the file in public/brand/speaker/; no placeholder person is ever generated. */
function speakerSrc() {
  for (const f of ["rashid-gazzali.webp", "rashid-gazzali.png"]) {
    if (fs.existsSync(path.join(process.cwd(), "public/brand/speaker", f))) return `/brand/speaker/${f}`;
  }
  return null;
}

export function Hero() {
  const photo = speakerSrc();
  return (
    <section className="relative isolate overflow-hidden bg-[image:var(--gradient-hero)] text-white">
      <CircleField className="absolute -left-40 -top-40 -z-10 w-[40rem] opacity-80 sm:w-[52rem]" />
      <CircleField className="absolute -bottom-52 -right-40 -z-10 w-[36rem] opacity-70 sm:w-[48rem]" />
      <span aria-hidden className="absolute right-[-2%] top-16 -z-10 select-none font-display text-[22vw] uppercase leading-none text-black/10">Edition3</span>

      <div className="mx-auto grid min-h-[100svh] max-w-7xl items-center gap-8 px-5 pb-16 pt-28 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <TextReveal as="p" text="Programming 2027" className="font-serif text-3xl sm:text-5xl" delay={0.5} />
          <h1 className="mt-2 font-display text-[clamp(4.5rem,17vw,12rem)] uppercase leading-[0.85] tracking-tight drop-shadow-[0_6px_0_rgba(0,0,0,0.18)]">
            <TextReveal text="Influencia" delay={0.15} />
          </h1>
          <Reveal delay={0.7}><p className="mt-3 text-lg tracking-[0.55em] sm:text-2xl">EDITION 3</p></Reveal>
          <Reveal delay={0.9}>
            <p className="mt-8 text-2xl font-semibold">{edition.speaker}’s</p>
            <p className="mt-1 max-w-md text-lg text-white/85">{edition.duration} Programming Workshop — {edition.tagline}</p>
          </Reveal>
          <Reveal delay={1.1} className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-2 text-white/90">
            <span><strong className="font-display text-4xl text-white">19</strong> <span className="uppercase tracking-widest">Dec 2026 · {edition.weekday}</span></span>
            <span>{edition.venue}, Calicut</span>
          </Reveal>
          <Reveal delay={1.25} className="mt-8"><Countdown targetIso={edition.startsAtIso} /></Reveal>
          <Reveal delay={1.4} className="mt-9 flex flex-wrap gap-4">
            <ButtonLink href="/register">Reserve Your Seat</ButtonLink>
            <ButtonLink href="/programme" variant="ghost">View Programme</ButtonLink>
          </Reveal>
        </div>

        <ImageReveal delay={0.9} className={`relative mx-auto aspect-[4/5] w-full max-w-md ${photo ? "" : "hidden lg:block"}`}>
          <div aria-hidden className="absolute inset-[8%] rounded-full bg-black/15 ring-1 ring-white/25" />
          {photo ? (
            <Image src={photo} alt={edition.speaker} fill priority sizes="(min-width:1024px) 40vw, 90vw" className="object-contain object-bottom" />
          ) : (
            <div className="absolute inset-0 flex items-end justify-center pb-6 text-center text-xs uppercase tracking-[0.3em] text-white/50">
              {edition.speaker}
            </div>
          )}
        </ImageReveal>
      </div>
    </section>
  );
}
