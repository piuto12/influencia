import { z } from "zod";
import { isValidUpiId } from "@/modules/payments/upi";
import { clean } from "@/modules/registration/schemas";

/** datetime-local values are entered in IST (the event timezone). Empty -> null. */
export function istToIso(v: string | undefined | null): string | null {
  if (!v || !v.trim()) return null;
  const s = v.trim().length === 16 ? `${v.trim()}:00` : v.trim();
  const d = new Date(`${s}+05:30`);
  if (Number.isNaN(d.getTime())) throw new Error("invalid_date");
  return d.toISOString();
}
export function isoToIstInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600_000);
  return d.toISOString().slice(0, 16);
}

const txt = (max: number) => z.string().optional().transform((v) => clean(v ?? "")).pipe(z.string().max(max));
const check = z.preprocess((v) => v === "on" || v === "true", z.boolean());
const longText = (max: number) => z.string().optional().transform((v) => (v ?? "").replace(/\r/g, "").trim()).pipe(z.string().max(max));

export const editionSettingsSchema = z.object({
  title: txt(160).pipe(z.string().min(2)),
  subtitle: txt(200),
  capacity: z.coerce.number().int().min(0).max(100000),
  registration_open: check,
  waitlist_enabled: check,
  registration_deadline: z.string().optional(),
  starts_at: z.string().optional(),
  venue_name: txt(160), venue_city: txt(160), venue_address: longText(400),
  status: z.enum(["draft", "upcoming", "active", "completed", "archived"]),
  whatsapp_group_url: z.string().optional().transform((v) => (v ?? "").trim())
    .refine((v) => v === "" || /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]+/.test(v), "Must be a chat.whatsapp.com invite link"),
});

export const paymentSettingsSchema = z.object({
  enabled: check,
  fee_amount: z.coerce.number().min(0).max(10_000_000),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  deadline: z.string().optional(),
  verification_mode: z.enum(["manual", "automatic"]),
  upi_id: z.string().optional().transform((v) => (v ?? "").trim()).refine((v) => v === "" || isValidUpiId(v), "Invalid UPI ID"),
  payee_name: txt(100), instructions: longText(1500),
  account_name: txt(120), account_number: z.string().optional().transform((v) => (v ?? "").replace(/\s/g, "")).refine((v) => v === "" || /^\d{6,24}$/.test(v), "Invalid account number"),
  ifsc: z.string().optional().transform((v) => (v ?? "").trim().toUpperCase()).refine((v) => v === "" || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v), "Invalid IFSC"),
  bank_name: txt(120), branch: txt(120),
  discount_label: txt(80), discount_type: z.enum(["percent", "fixed"]).optional(), discount_value: z.coerce.number().min(0).max(10_000_000).optional(),
  discount_until: z.string().optional(),
});

export const adminUserSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  display_name: txt(100).pipe(z.string().min(2)),
  role: z.enum(["super_admin", "registration_admin", "finance_admin"]),
  password: z.string().min(12, "Use at least 12 characters").max(128),
});

export const participantEditSchema = z.object({
  full_name: txt(120).pipe(z.string().min(2)), mobile: txt(20), whatsapp: txt(20),
  organization: txt(160), designation: txt(120), department: txt(120), city: txt(80),
});
