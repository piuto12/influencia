export interface EmailMessage { to: string; subject: string; text: string; html: string }
export type EmailResult = { ok: true } | { ok: false; error: string };

export function emailConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.EMAIL_PROVIDER_API_KEY && env.EMAIL_FROM);
}

/** Resend REST API (https://resend.com). Provider-specific code lives only here; swap this file to change provider. */
export async function sendEmail(m: EmailMessage, env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): Promise<EmailResult> {
  if (!emailConfigured(env)) return { ok: false, error: "email_not_configured" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.to)) return { ok: false, error: "invalid_recipient" };
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.EMAIL_PROVIDER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
    });
    return res.ok ? { ok: true } : { ok: false, error: `provider_${res.status}` };
  } catch { return { ok: false, error: "network" }; }
}
