export const TEMPLATE_KEYS = [
  "registration_ack", "payment_ack", "payment_rejected", "registration_approved", "registration_rejected",
  "event_reminder", "event_day", "post_event_thanks",
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  registration_ack: "Registration acknowledgement", payment_ack: "Payment details received", payment_rejected: "Payment could not be verified",
  registration_approved: "Registration approved", registration_rejected: "Registration not approved",
  event_reminder: "Event reminder", event_day: "Event-day instructions", post_event_thanks: "Post-event thank-you",
};

export const VARIABLES = ["name", "reference", "event_title", "event_date", "venue", "status_url", "group_link", "reason"] as const;
export type Vars = Partial<Record<(typeof VARIABLES)[number], string>>;

/** Defaults are deliberately plain and make no promises beyond what the organizers have stated. Editable in the admin. */
export const DEFAULTS: Record<TemplateKey, { subject: string; body: string }> = {
  registration_ack: { subject: "We received your registration — {{event_title}}", body: "Dear {{name}},\n\nThank you for registering for {{event_title}} on {{event_date}} at {{venue}}.\n\nYour registration reference is {{reference}}. Please keep it safe.\n\nYour seat is confirmed only after your payment is verified and the organizers approve your registration. You can complete payment and check your status here:\n{{status_url}}\n\nRegards,\nTeam Influencia" },
  payment_ack: { subject: "Payment details received — {{reference}}", body: "Dear {{name}},\n\nWe have received your payment details for {{event_title}} (reference {{reference}}). Our team will verify them and update your status.\n\nCheck progress any time:\n{{status_url}}\n\nRegards,\nTeam Influencia" },
  payment_rejected: { subject: "We couldn't verify your payment — {{reference}}", body: "Dear {{name}},\n\nWe could not verify the payment details you submitted for {{event_title}} (reference {{reference}}).\n\nReason: {{reason}}\n\nPlease resubmit or choose another payment method here:\n{{status_url}}\n\nRegards,\nTeam Influencia" },
  registration_approved: { subject: "Your seat is confirmed — {{event_title}}", body: "Dear {{name}},\n\nYour registration ({{reference}}) for {{event_title}} is confirmed.\n\nDate: {{event_date}}\nVenue: {{venue}}\n\nYour personal check-in QR code is available on your status page:\n{{status_url}}\n\nOfficial WhatsApp group:\n{{group_link}}\n\nWe look forward to seeing you.\n\nRegards,\nTeam Influencia" },
  registration_rejected: { subject: "Update on your registration — {{reference}}", body: "Dear {{name}},\n\nWe are sorry to let you know that your registration ({{reference}}) for {{event_title}} could not be approved.\n\nReason: {{reason}}\n\nIf you have questions, please contact the Influencia team.\n\nRegards,\nTeam Influencia" },
  event_reminder: { subject: "Reminder: {{event_title}} is coming up", body: "Dear {{name}},\n\nA reminder that {{event_title}} takes place on {{event_date}} at {{venue}}.\n\nYour check-in QR code: {{status_url}}\n\nRegards,\nTeam Influencia" },
  event_day: { subject: "Today: {{event_title}} — details for the day", body: "Dear {{name}},\n\nWelcome to {{event_title}} today at {{venue}}.\n\nPlease keep your check-in QR code ready (open it from {{status_url}}) and carry your reference {{reference}}.\n\nRegards,\nTeam Influencia" },
  post_event_thanks: { subject: "Thank you for joining {{event_title}}", body: "Dear {{name}},\n\nThank you for being part of {{event_title}}. We hope the day was valuable.\n\nIf you are eligible, your certificate can be downloaded from your status page:\n{{status_url}}\n\nRegards,\nTeam Influencia" },
};

const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");

const ALLOWED = new Set<string>(VARIABLES);

/** {{var}} substitution only. Only the documented variables are replaced; anything else renders empty. Nothing is evaluated. */
export function renderTemplate(tpl: { subject: string; body: string }, vars: Vars) {
  const fill = (s: string) => s.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k: string) => (ALLOWED.has(k) && Object.hasOwn(vars, k) ? (vars as Record<string, string | undefined>)[k] ?? "" : ""));
  const subject = clean(fill(tpl.subject)).replace(/\s+/g, " ").trim(); // one line: values can never inject extra headers
  const text = clean(fill(tpl.body)).replace(/\n{3,}/g, "\n\n").trim();
  return { subject, text };
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Minimal, safe HTML version of a plain-text body (escaped; bare https links become anchors). */
export function textToHtml(text: string) {
  const esc = escapeHtml(text).replace(/(https:\/\/[^\s<]+)/g, (u) => `<a href="${u}">${u}</a>`);
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#1c1717">${esc.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("")}</div>`;
}
