import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";

export function Section({ id, eyebrow, title, children, tone = "light" }: {
  id?: string; eyebrow?: string; title: string; children: ReactNode; tone?: "light" | "white" | "dark";
}) {
  const bg = tone === "dark" ? "bg-maroon-deep text-white" : tone === "white" ? "bg-white" : "bg-warm";
  return (
    <section id={id} className={`${bg} py-20 sm:py-28`}>
      <div className="mx-auto max-w-7xl px-5">
        <Reveal>
          {eyebrow && <p className={`text-xs uppercase tracking-[0.35em] ${tone === "dark" ? "text-gold" : "text-crimson"}`}>{eyebrow}</p>}
          <h2 className="mt-3 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">{title}</h2>
        </Reveal>
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-current/30 p-10 text-center opacity-80">{children}</div>;
}
