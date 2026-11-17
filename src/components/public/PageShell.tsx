import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { Footer } from "./Footer";
import { TextReveal } from "@/components/motion/TextReveal";

export function PageShell({ title, eyebrow, children }: { title: string; eyebrow?: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="bg-[image:var(--gradient-hero)] px-5 pb-16 pt-32 text-white">
          <div className="mx-auto max-w-7xl">
            {eyebrow && <p className="text-xs uppercase tracking-[0.35em] text-white/70">{eyebrow}</p>}
            <h1 className="mt-3 font-serif text-4xl sm:text-6xl"><TextReveal text={title} /></h1>
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-5 py-16 text-lg leading-relaxed">{children}</div>
      </main>
      <Footer />
    </>
  );
}
