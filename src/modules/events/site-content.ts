/**
 * Fallback site content for Phase 2.
 * Everything here is sourced from the organizer's brief or poster. In Phase 3/6 this module is replaced
 * by database reads (event_editions, homepage_sections, site_settings) behind the same shape.
 * Do NOT add invented achievements, testimonials, statistics or past-edition facts here.
 */
export const edition = {
  code: "INF3",
  number: 3,
  title: "Influencia",
  editionLabel: "Edition 3",
  tagline: "Programming 2027: Shaping the Year Ahead…",
  speaker: "Dr. Rashid Gazzali",
  organizer: "Dr. Rashid Gazzali / Influencia Team",
  // Start time is not specified in the brief: countdown targets the start of the day in IST. Configurable later.
  startsAtIso: "2026-12-19T00:00:00+05:30",
  dateLabel: "19 December 2026",
  weekday: "Saturday",
  venue: "Hotel Tiara",
  city: "Calicut, Kerala, India",
  duration: "7 hours",
  capacity: 200,
} as const;

export const audience = [
  "Entrepreneurs", "Corporate professionals", "College faculty", "Students",
  "Business owners", "Managers and leaders", "General public",
] as const;

export const highlights = [
  { title: "Reflect on 2026, design 2027", body: "A structured look back at the year, and a deliberate plan for the year ahead." },
  { title: "Magnetic Influence", body: "Becoming a person others naturally trust and follow." },
  { title: "Collaborative Leadership", body: "Leading with and through people, in business and in life." },
  { title: "The PRP Framework in practice", body: "Hands-on application of the framework across personal, relational and professional life." },
  { title: "Leadership and professional development", body: "Practical growth for working professionals, owners and leaders." },
  { title: "Personal guidance", body: "Direct guidance from Dr. Rashid Gazzali throughout the 7-hour programme." },
] as const;

// Draft descriptors derived from the pillar names; organizer to approve wording.
export const prpPillars = [
  { letter: "P", title: "Program Personal Mastery", body: "Take charge of your own habits, focus and direction." },
  { letter: "R", title: "Strengthen Relationships", body: "Build trust, communication and connection with the people around you." },
  { letter: "P", title: "Elevate Professional Excellence", body: "Raise the standard of your work, leadership and results." },
] as const;

export const contacts = [
  { name: "Office", phone: "+91 8589990060", wa: "918589990060" },
  { name: "Sahla", phone: "+91 9544724262", wa: "919544724262" },
  { name: "Basil Baby", phone: "+91 9207097235", wa: "919207097235" },
] as const;

export const nav = [
  { href: "/about", label: "About" },
  { href: "/prp-framework", label: "PRP Framework" },
  { href: "/programme", label: "Programme" },
  { href: "/videos", label: "Videos" },
  { href: "/gallery", label: "Gallery" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
] as const;

/** Admin-configurable in Phase 6. Empty until the organizer supplies real URLs. */
export const socialLinks: { platform: string; url: string }[] = [];

export function waLink(number: string, text: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
