import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULTS, renderTemplate, textToHtml, type TemplateKey, type Vars } from "./templates";
import { sendEmail } from "./email";
import { waLink } from "@/modules/events/site-content";

const db = () => createAdminClient();
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

interface Ctx { registrationId: string; email: string; mobile: string; whatsapp: string | null; status: string; vars: Vars }

async function context(registrationId: string, extra: Vars): Promise<Ctx | null> {
  const { data } = await db().from("registrations").select("id,reference,status,participants(full_name,email,mobile,whatsapp),event_editions(title,starts_at,venue_name,venue_city,whatsapp_group_url)").eq("id", registrationId).maybeSingle();
  if (!data) return null;
  const p = data.participants as unknown as { full_name: string; email: string; mobile: string; whatsapp: string | null };
  const e = data.event_editions as unknown as { title: string; starts_at: string | null; venue_name: string | null; venue_city: string | null; whatsapp_group_url: string | null };
  return {
    registrationId, email: p.email, mobile: p.mobile, whatsapp: p.whatsapp, status: data.status,
    vars: {
      name: p.full_name, reference: data.reference, event_title: e.title,
      event_date: e.starts_at ? new Date(e.starts_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" }) : "the announced date",
      venue: [e.venue_name, e.venue_city].filter(Boolean).join(", ") || "the announced venue",
      status_url: `${siteUrl()}/registration-status`,
      // The WhatsApp group link is only ever released for confirmed registrations.
      group_link: data.status === "confirmed" && e.whatsapp_group_url ? e.whatsapp_group_url : "(shared with confirmed participants)",
      ...extra,
    },
  };
}

async function template(key: TemplateKey) {
  const { data } = await db().from("notification_templates").select("subject,body").eq("key", key).maybeSingle();
  return data ? { subject: data.subject ?? DEFAULTS[key].subject, body: data.body } : DEFAULTS[key];
}

export interface NotifyResult { ok: boolean; error?: string }

/** Sends one email and records it. Never throws: a failed notification must not break registration, payment or approval. */
export async function notify(key: TemplateKey, registrationId: string, extra: Vars = {}): Promise<NotifyResult> {
  try {
    const ctx = await context(registrationId, extra); if (!ctx) return { ok: false, error: "not_found" };
    const r = renderTemplate(await template(key), ctx.vars);
    const res = await sendEmail({ to: ctx.email, subject: r.subject, text: r.text, html: textToHtml(r.text) });
    await db().from("notifications").insert({ registration_id: registrationId, channel: "email", template_key: key, status: res.ok ? "sent" : "failed", error: res.ok ? null : res.error, sent_at: res.ok ? new Date().toISOString() : null });
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  } catch { return { ok: false, error: "unexpected" }; }
}

/** wa.me click-to-chat link carrying the rendered message (no WhatsApp API involved). */
export async function whatsappLink(key: TemplateKey, registrationId: string, extra: Vars = {}): Promise<string | null> {
  const ctx = await context(registrationId, extra); if (!ctx) return null;
  const number = (ctx.whatsapp || ctx.mobile).replace(/\D/g, ""); if (number.length < 10) return null;
  const r = renderTemplate(await template(key), ctx.vars);
  return waLink(number, r.text);
}

export async function logWhatsAppOpened(registrationId: string, key: TemplateKey) {
  await db().from("notifications").insert({ registration_id: registrationId, channel: "whatsapp_link", template_key: key, status: "sent", sent_at: new Date().toISOString() });
}
