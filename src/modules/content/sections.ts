/** Section-type registry shared by the homepage renderer and the admin section manager. */
export const SECTION_TYPES = {
  speaker: { label: "Speaker introduction", custom: false },
  about: { label: "About Influencia", custom: false },
  prp: { label: "PRP Framework", custom: false },
  highlights: { label: "Workshop highlights", custom: false },
  video: { label: "Featured videos", custom: false },
  editions: { label: "Previous editions", custom: false },
  testimonials: { label: "Testimonials", custom: false },
  gallery: { label: "Photo gallery", custom: false },
  blog: { label: "Blog & articles", custom: false },
  contact: { label: "Contact", custom: false },
  text: { label: "Custom text block", custom: true },
  cta: { label: "Call-to-action banner", custom: true },
} as const;
export type SectionType = keyof typeof SECTION_TYPES;
export const isSectionType = (t: string): t is SectionType => t in SECTION_TYPES;

export interface SectionContent { eyebrow?: string; title?: string; body?: string; cta_label?: string; cta_href?: string }
export interface SectionRow { id: string; type: string; sort_order: number; status: "draft" | "published"; content: SectionContent }

/** Used only when the table has no published rows (e.g. a brand-new database). */
export const DEFAULT_SECTIONS: SectionRow[] = ([
  ["speaker", "Meet the speaker", "Dr. Rashid Gazzali"], ["about", "About Influencia", "A full-day programme to shape the year ahead."],
  ["prp", "The PRP Framework", "Three pillars. One year designed on purpose."], ["highlights", "Workshop highlights", "What the day covers"],
  ["video", "Featured video", "Watch the promotional film"], ["editions", "Previous editions", "The Influencia journey"],
  ["testimonials", "Testimonials", "In participants’ words"], ["gallery", "Photo gallery", "Moments from Influencia"],
  ["blog", "Blog & articles", "Ideas worth sharing"], ["contact", "Contact", "Questions? Talk to the team."],
] as const).map(([type, eyebrow, title], i) => ({ id: `default-${type}`, type, sort_order: (i + 1) * 10, status: "published" as const, content: { eyebrow, title } }));

/** Only safe link targets for CTA buttons: site-relative paths, https URLs, wa.me/tel/mailto. */
export function safeHref(h: string | undefined): string | null {
  if (!h) return null;
  const v = h.trim();
  if (/^\/(?!\/)[^\s]*$/.test(v)) return v;
  if (/^https:\/\/[^\s]+$/.test(v)) return v;
  if (/^(tel:\+?[0-9]{6,15}|mailto:[^\s@]+@[^\s@]+)$/.test(v)) return v;
  return null;
}
