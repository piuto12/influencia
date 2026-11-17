import { z } from "zod";
import { clean } from "@/modules/registration/schemas";
import { TEMPLATE_KEYS } from "@/modules/notifications/templates";

const txt = (max: number) => z.string().optional().transform((v) => clean(v ?? "")).pipe(z.string().max(max, "Too long"));
const long = (max: number) => z.string().optional().transform((v) => (v ?? "").replace(/\r/g, "").trim()).pipe(z.string().max(max, "Too long"));

export const certificateTemplateSchema = z.object({
  organizer: txt(120), signatory_name: txt(80), signatory_title: txt(80), heading: txt(60), body_text: txt(80),
  // pdf-lib embeds PNG signatures; the upload folder/name format is enforced by isSafeMediaPath elsewhere.
  signature_path: z.string().optional().transform((v) => (v ?? "").trim()).refine((v) => v === "" || /^misc\/[A-Za-z0-9_-]+\.png$/.test(v), "Signature must be a PNG"),
});

export const notificationTemplateSchema = z.object({
  key: z.enum(TEMPLATE_KEYS), subject: txt(150).pipe(z.string().min(3)), body: long(4000).pipe(z.string().min(10)),
});

export const BULK_KEYS = ["event_reminder", "event_day", "post_event_thanks"] as const;
export const bulkSchema = z.object({ key: z.enum(BULK_KEYS), confirm: z.literal("on") });
