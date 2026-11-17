"use client";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

export interface GalleryImage { id: string; src: string; caption: string | null }

export function GalleryGrid({ images }: { images: GalleryImage[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + images.length) % images.length)), [images.length]);
  useEffect(() => {
    if (open === null) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [open, close, step]);
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {images.map((im, i) => (
          <li key={im.id}><button type="button" onClick={() => setOpen(i)} aria-label={im.caption ? `Open photo: ${im.caption}` : "Open photo"} className="group relative block aspect-square w-full overflow-hidden rounded-xl bg-charcoal/10">
            <Image src={im.src} alt={im.caption ?? ""} fill sizes="(min-width:1024px) 25vw, 50vw" loading="lazy" className="object-cover transition duration-500 group-hover:scale-105" />
          </button></li>))}
      </ul>
      <AnimatePresence>
        {open !== null && (
          <motion.div role="dialog" aria-modal="true" aria-label="Photo viewer" className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
            <motion.figure key={open} initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative max-h-[85vh] w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
              <Image src={images[open].src} alt={images[open].caption ?? ""} width={1600} height={1200} className="mx-auto max-h-[78vh] w-auto rounded-lg object-contain" />
              {images[open].caption && <figcaption className="mt-3 text-center text-sm text-white/85">{images[open].caption}</figcaption>}
            </motion.figure>
            <button type="button" onClick={close} aria-label="Close" className="absolute right-4 top-4 h-11 w-11 rounded-full bg-white/10 text-2xl text-white hover:bg-white/20">×</button>
            {images.length > 1 && <>
              <button type="button" onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous photo" className="absolute left-3 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full bg-white/10 text-2xl text-white hover:bg-white/20">‹</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next photo" className="absolute right-3 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full bg-white/10 text-2xl text-white hover:bg-white/20">›</button></>}
          </motion.div>)}
      </AnimatePresence>
    </>
  );
}
