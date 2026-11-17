import { z } from "zod";

import { CATEGORIES } from "./categories";
export { CATEGORIES };

const categoryValues = CATEGORIES.map((c) => c.value) as [string, ...string[]];

/** Strip control characters and collapse whitespace. */
export function clean(s: string): string {
  return s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

/** Normalise to +<digits>. 10-digit Indian mobiles (6–9…) get +91. Returns null if invalid. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^0[6-9]\d{9}$/.test(digits)) return `+91${digits.slice(1)}`;
  if (/^\+?91[6-9]\d{9}$/.test(digits)) return `+91${digits.replace(/^\+?91/, "")}`;
  if (/^\+[1-9]\d{9,14}$/.test(digits)) return digits;
  return null;
}

const text = (label: string, max: number, min = 1) =>
  z.string().transform(clean).pipe(z.string().min(min, `${label} is required`).max(max, `${label} is too long`));
const optionalText = (max: number) =>
  z.string().optional().transform((v) => clean(v ?? "")).pipe(z.string().max(max, "Too long"));
const phone = (label: string) =>
  z.string().transform((v) => normalizePhone(v)).refine((v): v is string => v !== null, `Enter a valid ${label}`);

export const registrationSchema = z.object({
  full_name: text("Full name", 120, 2),
  mobile: phone("mobile number"),
  whatsapp: z.string().optional().transform((v) => (v && v.trim() ? normalizePhone(v) : "")).refine((v) => v !== null, "Enter a valid WhatsApp number"),
  email: z.string().transform((v) => v.trim().toLowerCase()).pipe(z.email("Enter a valid email address").max(200)),
  organization: text("Organization / institution", 160),
  designation: text("Designation", 120),
  department: text("Department / industry", 120),
  city: text("City", 80),
  category: z.enum(categoryValues, "Select your category"),
  previous_participation: z.preprocess((v) => v === "yes" || v === "true" || v === true, z.boolean()),
  consent: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean().refine((v) => v, "You must accept the privacy policy to register")),
  website: optionalText(0).optional(), // honeypot: must stay empty
});

export type RegistrationInput = z.output<typeof registrationSchema>;

export const statusLookupSchema = z.object({
  reference: z.string().transform((v) => clean(v).toUpperCase()).pipe(z.string().regex(/^[A-Z0-9]{2,8}-[A-Z0-9]{6}$/)),
  contact: z.string().transform(clean).pipe(z.string().min(5).max(200)),
});
