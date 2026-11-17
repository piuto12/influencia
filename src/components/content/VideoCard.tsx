"use client";
import Image from "next/image";
import { useState } from "react";
import { parseVideoUrl } from "@/modules/content/video";
import { mediaUrl } from "@/modules/content/media";

export interface VideoProps { title: string; description?: string | null; source: "youtube" | "vimeo" | "upload"; url: string | null; storagePath: string | null; thumbnailPath: string | null }

/** Nothing third-party loads until the visitor clicks play (privacy + performance). Never autoplays audio on load. */
export function VideoCard({ v }: { v: VideoProps }) {
  const [playing, setPlaying] = useState(false);
  const parsed = v.source !== "upload" && v.url ? parseVideoUrl(v.url) : null;
  const thumb = mediaUrl(v.thumbnailPath) ?? parsed?.thumbnail ?? null;
  const upload = v.source === "upload" ? mediaUrl(v.storagePath) : null;
  if (!parsed && !upload) return null;
  return (
    <figure className="group overflow-hidden rounded-2xl border border-charcoal/10 bg-white shadow-sm">
      <div className="relative aspect-video bg-maroon-deep">
        {playing ? (
          upload ? <video src={upload} poster={thumb ?? undefined} controls autoPlay playsInline className="h-full w-full" />
            : <iframe src={parsed!.embedUrl} title={v.title} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} aria-label={`Play video: ${v.title}`} className="absolute inset-0 grid place-items-center">
            {thumb && (thumb.startsWith("https://i.ytimg.com") || thumb.includes(".supabase.co")) && <Image src={thumb} alt="" fill sizes="(min-width:1024px) 33vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" unoptimized={thumb.startsWith("https://i.ytimg.com")} />}
            <span className="absolute inset-0 bg-black/30 transition group-hover:bg-black/15" />
            <span className="relative grid h-16 w-16 place-items-center rounded-full bg-white/95 text-crimson shadow-xl transition group-hover:scale-110" aria-hidden>
              <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 fill-current"><path d="M8 5v14l11-7z" /></svg>
            </span>
          </button>
        )}
      </div>
      <figcaption className="p-5"><h3 className="font-serif text-xl">{v.title}</h3>{v.description && <p className="mt-1 text-sm text-charcoal/70">{v.description}</p>}</figcaption>
    </figure>
  );
}
