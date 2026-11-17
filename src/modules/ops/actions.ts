"use server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdmin, requirePermission } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { rateLimitShared } from "@/lib/rate-limit";
import { audit, run, text } from "@/modules/admin/helpers";
import { checkIn, checkInByToken, tokenFor, type CheckInOutcome } from "@/modules/attendance/service";
import { eligibleWithoutCertificate, getTemplate, issueCertificate } from "@/modules/certificates/service";
import { notify } from "@/modules/notifications/service";
import { certificateTemplateSchema, bulkSchema, notificationTemplateSchema } from "./schemas";
import { authenticateRegistrant } from "@/modules/registration/service";
import { supabaseRegistrationRepository } from "@/modules/registration/repository";
import { certificateForRegistration, renderCertificates } from "@/modules/certificates/service";
import QRCode from "qrcode";

const db = () => createAdminClient();
const fail = (m = "invalid_input"): never => { throw new Error(m); };

// ---------- attendance ----------
export async function scanCheckIn(editionCode: string, token: string): Promise<CheckInOutcome> {
  const a = await getAdmin();
  if (!a || !can(a.role, "attendance.manage")) return { ok: false, error: "unavailable" };
  if (!(await rateLimitShared(`scan:${a.adminId}`, 120, 60_000))) return { ok: false, error: "unavailable" };
  const { data: ed } = await db().from("event_editions").select("id").eq("code", editionCode).maybeSingle();
  if (!ed) return { ok: false, error: "not_found" };
  const r = await checkInByToken(token, ed.id, a.adminId);
  if (r.ok && r.result === "checked_in") await audit(a.adminId, "attendance.checked_in", "registration", r.reference, null, { method: "qr" });
  return r;
}

export async function manualCheckIn(fd: FormData) {
  const id = text(fd, "id"); const path = text(fd, "back") || "/admin/attendance";
  await run(path, "Checked in.", async () => {
    const a = await requirePermission("attendance.manage");
    const r = await checkIn(id, "manual", a.adminId);
    if (!r.ok) fail(r.error === "not_confirmed" ? "invalid_state" : "unavailable");
    if (r.ok && r.result === "already_checked_in") fail("already_checked_in");
    await audit(a.adminId, "attendance.checked_in", "registration", id, null, { method: "manual" });
  });
}

export async function undoCheckIn(fd: FormData) {
  const id = text(fd, "id"); const path = text(fd, "back") || "/admin/attendance";
  await run(path, "Check-in removed (logged).", async () => {
    const a = await requirePermission("attendance.manage");
    const { error } = await db().rpc("undo_check_in", { p_registration: id, p_actor: a.adminId, p_note: text(fd, "note") });
    if (error) fail(error.message.includes("reason_required") ? "reason_required" : "invalid_state");
  });
}

// ---------- certificates ----------
export async function saveCertificateTemplate(fd: FormData) {
  const editionId = text(fd, "editionId"); const code = text(fd, "code"); const path = `/admin/certificates?edition=${code}`;
  await run(path, "Certificate template saved.", async () => {
    const a = await requirePermission("certificates.manage");
    const p = certificateTemplateSchema.safeParse(Object.fromEntries(fd)); if (!p.success) fail();
    const config = Object.fromEntries(Object.entries(p.data!).filter(([, v]) => v));
    const cur = await getTemplate(editionId);
    const { error } = cur ? await db().from("certificate_templates").update({ config }).eq("id", cur.id)
      : await db().from("certificate_templates").insert({ edition_id: editionId, name: "Default", config });
    if (error) fail(error.message);
    await audit(a.adminId, "certificate_template.saved", "edition", editionId, cur?.config ?? null, config);
  });
}

export async function issueAllCertificates(fd: FormData) {
  const editionId = text(fd, "editionId"); const code = text(fd, "code"); const path = `/admin/certificates?edition=${code}`;
  await run(path, "Certificates issued.", async () => {
    const a = await requirePermission("certificates.manage");
    const { eligible } = await eligibleWithoutCertificate(editionId);
    const tpl = await getTemplate(editionId); let n = 0;
    for (const r of eligible) { await issueCertificate(r.id, tpl?.id ?? null, a.adminId); n++; }
    await audit(a.adminId, "certificate.bulk_issued", "edition", editionId, null, { count: n });
  });
}

export async function revokeCertificateAction(fd: FormData) {
  const path = text(fd, "back");
  await run(path, "Certificate revoked.", async () => {
    const a = await requirePermission("certificates.manage");
    const { error } = await db().rpc("revoke_certificate", { p_code: text(fd, "code"), p_actor: a.adminId, p_reason: text(fd, "reason") });
    if (error) fail(error.message.includes("reason_required") ? "reason_required" : "invalid_state");
  });
}

// ---------- notifications ----------
export async function saveNotificationTemplate(fd: FormData) {
  await run("/admin/notifications", "Template saved.", async () => {
    const a = await requirePermission("settings.manage");
    const p = notificationTemplateSchema.safeParse(Object.fromEntries(fd)); if (!p.success) fail();
    const { error } = await db().from("notification_templates").upsert({ key: p.data!.key, subject: p.data!.subject, body: p.data!.body, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) fail(error.message);
    await audit(a.adminId, "notification_template.saved", "notification_template", p.data!.key);
  });
}
export async function resetNotificationTemplate(fd: FormData) {
  await run("/admin/notifications", "Template reset to default.", async () => {
    const a = await requirePermission("settings.manage");
    await db().from("notification_templates").delete().eq("key", text(fd, "key"));
    await audit(a.adminId, "notification_template.reset", "notification_template", text(fd, "key"));
  });
}

/** Bulk email to every CONFIRMED participant of an edition. Requires an explicit confirmation tick. */
export async function sendBulk(fd: FormData) {
  const code = text(fd, "code"); const path = `/admin/notifications?edition=${code}`;
  await run(path, "Bulk send finished — see the log below.", async () => {
    const a = await requirePermission("participants.write");
    const p = bulkSchema.safeParse(Object.fromEntries(fd)); if (!p.success) fail();
    const { data: ed } = await db().from("event_editions").select("id").eq("code", code).single();
    const { data: regs } = await db().from("registrations").select("id").eq("edition_id", ed!.id).eq("status", "confirmed").limit(1000);
    let sent = 0, failed = 0;
    for (const r of regs ?? []) { const res = await notify(p.data!.key, r.id); if (res.ok) sent++; else failed++; }
    await audit(a.adminId, "notification.bulk_sent", "edition", ed!.id, null, { key: p.data!.key, sent, failed });
  });
}
export async function resendNotification(fd: FormData) {
  const id = text(fd, "id"); const key = text(fd, "key"); const path = `/admin/participants/${id}`;
  await run(path, "Email sent.", async () => {
    const a = await requirePermission("participants.write");
    const parsed = notificationTemplateSchema.shape.key.safeParse(key); if (!parsed.success) fail();
    const r = await notify(parsed.data!, id, { reason: text(fd, "reason") });
    if (!r.ok) fail(r.error === "email_not_configured" ? "email_not_configured" : "unavailable");
    await audit(a.adminId, "notification.sent", "registration", id, null, { key });
  });
}

// ---------- participant-facing (authenticated with reference + contact, like the status page) ----------
async function client(scope: string, limit: number) {
  const h = await headers(); const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return rateLimitShared(`${scope}:${ip}`, limit, 10 * 60_000);
}
export interface Ticket { qr: string | null; certificate: boolean }
export async function getMyTicket(reference: string, contact: string): Promise<Ticket | null> {
  if (!(await client("ticket", 30))) return null;
  try {
    const r = await authenticateRegistrant({ reference, contact }, supabaseRegistrationRepository);
    if (!r || r.status !== "confirmed") return null;
    const qr = await QRCode.toDataURL(tokenFor(r.registrationId, r.editionId), { margin: 1, width: 280, errorCorrectionLevel: "M" });
    return { qr, certificate: !!(await certificateForRegistration(r.registrationId)) };
  } catch { return null; }
}
export async function downloadMyCertificate(reference: string, contact: string): Promise<{ filename: string; base64: string } | null> {
  if (!(await client("cert-dl", 10))) return null;
  try {
    const r = await authenticateRegistrant({ reference, contact }, supabaseRegistrationRepository);
    if (!r) return null;
    const code = await certificateForRegistration(r.registrationId); if (!code) return null;
    const out = await renderCertificates([code]); if (!out) return null;
    return { filename: `certificate-${r.reference}.pdf`, base64: Buffer.from(out.pdf).toString("base64") };
  } catch { return null; }
}
