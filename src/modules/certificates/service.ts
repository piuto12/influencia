import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mediaUrl } from "@/modules/content/media";
import { canRenderName, generateCertificatesPdf, type CertificateData } from "./pdf";

const db = () => createAdminClient();
export const verifyUrl = (code: string) => `${(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "")}/certificates/verify/${code}`;

export interface TemplateConfig { organizer?: string; signatory_name?: string; signatory_title?: string; signature_path?: string; heading?: string; body_text?: string }

export async function getTemplate(editionId: string) {
  const { data } = await db().from("certificate_templates").select("id,config").eq("edition_id", editionId).eq("active", true).order("id").limit(1).maybeSingle();
  return data as { id: string; config: TemplateConfig } | null;
}

export async function listCertificates(editionId: string) {
  const { data, error } = await db().from("certificates").select("certificate_code,issued_at,revoked_at,revoked_reason,registrations!inner(id,reference,edition_id,participants(full_name))").eq("registrations.edition_id", editionId).order("issued_at", { ascending: false }).limit(2000);
  if (error) throw error;
  return (data ?? []) as unknown as { certificate_code: string; issued_at: string; revoked_at: string | null; revoked_reason: string | null; registrations: { id: string; reference: string; participants: { full_name: string } } }[];
}

/** Confirmed participants who meet the edition's attendance rule and do not yet hold a certificate. */
export async function eligibleWithoutCertificate(editionId: string) {
  const { data: ed } = await db().from("event_editions").select("attendance_rule").eq("id", editionId).single();
  const need = (ed?.attendance_rule as { require_check_in?: boolean } | null)?.require_check_in !== false;
  const { data, error } = await db().from("registrations").select("id,reference,participants(full_name),attendance(id),certificates(id)").eq("edition_id", editionId).eq("status", "confirmed").limit(10000);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { id: string; reference: string; participants: { full_name: string }; attendance: unknown[] | unknown | null; certificates: unknown[] | unknown | null }[];
  const has = (x: unknown) => (Array.isArray(x) ? x.length > 0 : !!x);
  return { need, eligible: rows.filter((r) => !has(r.certificates) && (!need || has(r.attendance))), confirmed: rows.length };
}

export async function issueCertificate(registrationId: string, templateId: string | null, actor: string) {
  const { data, error } = await db().rpc("issue_certificate", { p_registration: registrationId, p_template: templateId, p_actor: actor });
  if (error) throw new Error(error.message); return data as string;
}

async function signatureBytes(path?: string): Promise<Uint8Array | null> {
  const url = mediaUrl(path); if (!url) return null;
  try { const r = await fetch(url); return r.ok ? new Uint8Array(await r.arrayBuffer()) : null; } catch { return null; }
}

/** Builds the PDF for the given certificate codes (revoked certificates are never rendered). */
export async function renderCertificates(codes: string[]): Promise<{ pdf: Uint8Array; skipped: number; lossyNames: string[] } | null> {
  const { data } = await db().from("certificates").select("certificate_code,revoked_at,template_id,registrations!inner(participants(full_name),event_editions(id,title,starts_at,venue_name,venue_city))").in("certificate_code", codes);
  const rows = ((data ?? []) as unknown as { certificate_code: string; revoked_at: string | null; registrations: { participants: { full_name: string }; event_editions: { id: string; title: string; starts_at: string | null; venue_name: string | null; venue_city: string | null } } }[]).filter((r) => !r.revoked_at);
  if (!rows.length) return null;
  const templates = new Map<string, TemplateConfig>(); const sigs = new Map<string, Uint8Array | null>();
  const items: CertificateData[] = []; const lossyNames: string[] = [];
  for (const r of rows) {
    const ed = r.registrations.event_editions;
    if (!templates.has(ed.id)) { const t = await getTemplate(ed.id); templates.set(ed.id, t?.config ?? {}); }
    const cfg = templates.get(ed.id)!;
    const sp = cfg.signature_path ?? ""; if (!sigs.has(sp)) sigs.set(sp, await signatureBytes(sp));
    const name = r.registrations.participants.full_name; if (!canRenderName(name)) lossyNames.push(name);
    items.push({ name, eventTitle: ed.title, eventDate: ed.starts_at ? new Date(ed.starts_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" }) : "", venue: [ed.venue_name, ed.venue_city].filter(Boolean).join(", "),
      organizer: cfg.organizer || "Dr. Rashid Gazzali / Influencia Team", signatoryName: cfg.signatory_name, signatoryTitle: cfg.signatory_title, signaturePng: sigs.get(sp) ?? null,
      code: r.certificate_code, verifyUrl: verifyUrl(r.certificate_code), heading: cfg.heading, bodyText: cfg.body_text });
  }
  return { pdf: await generateCertificatesPdf(items), skipped: codes.length - rows.length, lossyNames };
}

export interface PublicCertificate { valid: boolean; revoked: boolean; name?: string; eventTitle?: string; eventDate?: string; issuedAt?: string }
/** Minimal public view: only the facts printed on the certificate. Unknown codes and malformed input are indistinguishable. */
export async function verifyCertificate(codeRaw: string): Promise<PublicCertificate | null> {
  const code = codeRaw.trim().toUpperCase();
  if (!/^CERT(-[A-Z2-9]{4}){4}$/.test(code)) return null;
  const { data } = await db().from("certificates").select("certificate_code,issued_at,revoked_at,registrations(participants(full_name),event_editions(title,starts_at))").eq("certificate_code", code).maybeSingle();
  if (!data) return null;
  const r = data.registrations as unknown as { participants: { full_name: string }; event_editions: { title: string; starts_at: string | null } };
  const revoked = !!data.revoked_at;
  return { valid: !revoked, revoked, name: r.participants.full_name, eventTitle: r.event_editions.title,
    eventDate: r.event_editions.starts_at ? new Date(r.event_editions.starts_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" }) : undefined, issuedAt: data.issued_at };
}

export async function certificateForRegistration(registrationId: string) {
  const { data } = await db().from("certificates").select("certificate_code,revoked_at").eq("registration_id", registrationId).maybeSingle();
  return data && !data.revoked_at ? (data.certificate_code as string) : null;
}
