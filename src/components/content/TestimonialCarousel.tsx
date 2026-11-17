"use client";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

export interface TestimonialView { id: string; name: string; role: string; feedback: string | null; photo: string | null; rating: number | null }

export function TestimonialCarousel({ items }: { items: TestimonialView[] }) {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  if (!items.length) return null;
  const t = items[i % items.length];
  return (
    <div>
      <AnimatePresence mode="wait">
        <motion.blockquote key={t.id} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -8 }} transition={{ duration: 0.35 }}
          className="mx-auto max-w-3xl rounded-2xl border border-charcoal/10 bg-white p-8 shadow-sm">
          {t.rating && <p aria-label={`${t.rating} out of 5`} className="mb-3 text-gold">{"★".repeat(t.rating)}<span className="text-charcoal/20">{"★".repeat(5 - t.rating)}</span></p>}
          {t.feedback && <p className="font-serif text-xl leading-relaxed sm:text-2xl">“{t.feedback}”</p>}
          <footer className="mt-6 flex items-center gap-4">
            {t.photo && <Image src={t.photo} alt="" width={56} height={56} className="h-14 w-14 rounded-full object-cover" />}
            <div><p className="font-semibold">{t.name}</p><p className="text-sm text-charcoal/65">{t.role}</p></div>
          </footer>
        </motion.blockquote>
      </AnimatePresence>
      {items.length > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button type="button" aria-label="Previous testimonial" onClick={() => setI((i - 1 + items.length) % items.length)} className="h-10 w-10 rounded-full border border-charcoal/25 hover:border-crimson">‹</button>
          <span className="text-sm text-charcoal/70" aria-live="polite">{(i % items.length) + 1} / {items.length}</span>
          <button type="button" aria-label="Next testimonial" onClick={() => setI((i + 1) % items.length)} className="h-10 w-10 rounded-full border border-charcoal/25 hover:border-crimson">›</button>
        </div>)}
    </div>
  );
}
