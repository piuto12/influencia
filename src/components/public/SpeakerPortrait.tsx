import Image from "next/image";
import { getBranding } from "@/modules/content/queries";
import { mediaUrl } from "@/modules/content/media";
import { edition } from "@/modules/events/site-content";

/** Round portrait for light sections. Renders nothing until an admin uploads one. */
export async function SpeakerPortrait({ size = 224 }: { size?: number }) {
  const b = await getBranding(); const src = mediaUrl(b.speaker_path);
  if (!src) return null;
  const circle = b.speaker_style === "circle";
  return (
    <div className="relative shrink-0 overflow-hidden rounded-full bg-[image:var(--gradient-hero)] ring-4 ring-crimson/15" style={{ width: size, height: size }}>
      <Image src={src} alt={b.speaker_alt || edition.speaker} fill sizes={`${size}px`} className={circle ? "object-cover object-top" : "object-contain object-bottom"} />
    </div>
  );
}
