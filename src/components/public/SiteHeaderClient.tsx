"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

export function SiteHeaderClient({ nav }: { nav: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <Link href="/" className="font-display text-2xl uppercase tracking-wide text-white" onClick={() => setOpen(false)}>Influencia</Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 text-sm text-white/90 lg:flex">
          {nav.map((n) => <Link key={n.href} href={n.href} className="transition hover:text-white hover:underline hover:underline-offset-8">{n.label}</Link>)}
          <Link href="/register" className="rounded-full bg-white px-5 py-2 font-semibold text-crimson transition hover:bg-warm">Reserve Your Seat</Link>
        </nav>
        <button type="button" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"}
          className="flex h-11 w-11 flex-col items-center justify-center gap-1.5 lg:hidden" onClick={() => setOpen((v) => !v)}>
          <span className={`h-0.5 w-6 bg-white transition ${open ? "translate-y-2 rotate-45" : ""}`} />
          <span className={`h-0.5 w-6 bg-white transition ${open ? "opacity-0" : ""}`} />
          <span className={`h-0.5 w-6 bg-white transition ${open ? "-translate-y-2 -rotate-45" : ""}`} />
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav id="mobile-nav" aria-label="Mobile" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }} className="mx-4 rounded-2xl bg-maroon-deep/95 p-6 backdrop-blur lg:hidden">
            <ul className="flex flex-col gap-4 text-lg text-white">
              {nav.map((n) => <li key={n.href}><Link href={n.href} onClick={() => setOpen(false)}>{n.label}</Link></li>)}
              <li><Link href="/register" onClick={() => setOpen(false)} className="mt-2 inline-block rounded-full bg-white px-6 py-3 font-semibold text-crimson">Reserve Your Seat</Link></li>
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
