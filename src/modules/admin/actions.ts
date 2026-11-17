"use server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { rateLimitShared } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { audit, back, run, text } from "./helpers";
import { notify } from "@/modules/notifications/service";
import { registrationIdForPayment } from "@/modules/notifications/lookup";
import { getAdmin, requirePermission } from "@/lib/auth";
import { supabasePaymentRepository as payRepo } from "@/modules/payments/repository";
import { adminRecordRefund, adminRejectPayment, adminStartReview, adminVerifyPayment } from "@/modules/payments/service";
import { normalizePhone } from "@/modules/registration/schemas";
import { adminUserSchema, editionSettingsSchema, istToIso, participantEditSchema, paymentSettingsSchema } from "./schemas";
import { proofSignedUrl } from "./queries";

const db = () => createAdminClient();

// ---------- auth ----------
export async function signIn(fd: FormData) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await rateLimitShared(`login:${ip}`, 8, 10 * 60_000))) back("/admin/login", "err", "Too many attempts. Try again in a few minutes.");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: text(fd, "email").trim(), password: text(fd, "password") });
  if (error) back("/admin/login", "err", "Invalid email or password.");
  const a = await getAdmin();
  if (!a) { await supabase.auth.signOut(); back("/admin/login", "err", "This account has no admin access."); }
  await audit(a!.adminId, "auth.login", "admin_user", a!.adminId);
  redirect("/admin");
}
export async function signOut() { const supabase = await createClient(); await supabase.auth.signOut(); redirect("/admin/login"); }

// ---------- registrations ----------
export async function approveRegistration(fd: FormData) {
  const id = text(fd, "id"); const path = `/admin/participants/${id}`;
  await run(path, "Registration processed.", async () => {
    const a = await requirePermission("registrations.review");
    const { data: pays } = await db().from("payments").select("status").eq("registration_id", id);
    const verified = (pays ?? []).some((p: { status: string }) => p.status === "verified");
    const override = text(fd, "override") === "on" && a.role === "super_admin";
    if (!verified && !override) throw new Error("payment_not_verified");
    const { data, error } = await db().rpc("confirm_registration", { p_registration: id, p_actor: a.adminId });
    if (error) throw new Error(error.message);
    await audit(a.adminId, override && !verified ? "registration.approved_override" : "registration.approved", "registration", id, null, { result: data });
    if (data === "confirmed") await notify("registration_approved", id);
  });
}
export async function changeRegistrationStatus(fd: FormData) {
  const id = text(fd, "id"); const status = text(fd, "status"); const path = `/admin/participants/${id}`;
  await run(path, "Status updated.", async () => {
    const a = await requirePermission("registrations.review");
    if (!["rejected", "cancelled", "waitlisted"].includes(status)) throw new Error("invalid_state");
    const { error } = await db().rpc("set_registration_status", { p_registration: id, p_status: status, p_actor: a.adminId, p_note: text(fd, "note") });
    if (error) throw new Error(error.message);
    await audit(a.adminId, `registration.${status}`, "registration", id, null, { note: text(fd, "note") });
    if (status === "rejected") await notify("registration_rejected", id, { reason: text(fd, "note") });
  });
}
export async function updateParticipant(fd: FormData) {
  const regId = text(fd, "regId"); const pid = text(fd, "participantId"); const path = `/admin/participants/${regId}`;
  await run(path, "Participant updated.", async () => {
    const a = await requirePermission("participants.write");
    const p = participantEditSchema.safeParse(Object.fromEntries(fd));
    const mobile = p.success ? normalizePhone(p.data.mobile) : null;
    const wa = p.success && p.data.whatsapp ? normalizePhone(p.data.whatsapp) : null;
    if (!p.success || !mobile || (p.data.whatsapp && !wa)) throw new Error("invalid_input");
    const { data: before } = await db().from("participants").select("*").eq("id", pid).maybeSingle();
    const patch = { ...p.data, mobile, whatsapp: wa };
    const { error } = await db().from("participants").update(patch).eq("id", pid);
    if (error) throw new Error(error.message);
    await audit(a.adminId, "participant.updated", "participant", pid, before, patch);
  });
}

// ---------- payments ----------
const actor = (a: { adminId: string; role: import("@/lib/rbac").Role }) => ({ id: a.adminId, role: a.role });
export async function reviewPayment(fd: FormData) {
  const path = text(fd, "back"); const id = text(fd, "paymentId");
  await run(path, "Review started.", async () => { const a = await requirePermission("payments.verify"); await adminStartReview(actor(a), id, payRepo); });
}
export async function verifyPayment(fd: FormData) {
  const path = text(fd, "back"); const id = text(fd, "paymentId");
  await run(path, "Payment verified.", async () => { const a = await requirePermission("payments.verify"); await adminVerifyPayment(actor(a), id, payRepo); });
}
export async function rejectPayment(fd: FormData) {
  const path = text(fd, "back"); const id = text(fd, "paymentId");
  await run(path, "Payment rejected.", async () => {
    const a = await requirePermission("payments.verify"); await adminRejectPayment(actor(a), id, text(fd, "reason"), payRepo);
    const regId = await registrationIdForPayment(id); if (regId) await notify("payment_rejected", regId, { reason: text(fd, "reason") });
  });
}
export async function refundPayment(fd: FormData) {
  const path = text(fd, "back"); const id = text(fd, "paymentId");
  await run(path, "Refund recorded.", async () => {
    const a = await requirePermission("payments.refund");
    const amount = Number(text(fd, "amount")); if (!(amount > 0)) throw new Error("invalid_amount");
    await adminRecordRefund(actor(a), id, amount, text(fd, "reason").trim() || "Refund", payRepo);
  });
}
/** Short-lived (60 s) signed link; permission-checked and audited each time. */
export async function openProof(proofId: string): Promise<string | null> {
  const a = await requirePermission("payments.read");
  const url = await proofSignedUrl(proofId);
  if (url) await audit(a.adminId, "payment.proof_viewed", "payment_proof", proofId);
  return url;
}

// ---------- settings ----------
export async function saveEditionSettings(fd: FormData) {
  const id = text(fd, "editionId"); const path = `/admin/settings/event?edition=${text(fd, "code")}`;
  await run(path, "Event settings saved.", async () => {
    const a = await requirePermission("events.manage");
    const p = editionSettingsSchema.safeParse(Object.fromEntries(fd));
    if (!p.success) throw new Error("invalid_input");
    const { data: before } = await db().from("event_editions").select("*").eq("id", id).maybeSingle();
    const patch = { ...p.data, whatsapp_group_url: p.data.whatsapp_group_url || null, registration_deadline: istToIso(p.data.registration_deadline), starts_at: istToIso(p.data.starts_at) };
    const { error } = await db().from("event_editions").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    await audit(a.adminId, "edition.updated", "edition", id, before, patch);
  });
}
export async function savePaymentSettings(fd: FormData) {
  const editionId = text(fd, "editionId"); const method = text(fd, "method"); const path = `/admin/settings/payments?edition=${text(fd, "code")}`;
  await run(path, `${method} settings saved.`, async () => {
    const a = await requirePermission("payments.configure");
    const p = paymentSettingsSchema.safeParse(Object.fromEntries(fd));
    if (!p.success) throw new Error("invalid_input");
    const d = p.data;
    const { data: cur } = await db().from("payment_settings").select("*").eq("edition_id", editionId).eq("method_code", method).maybeSingle();
    const config = Object.fromEntries(Object.entries({ upi_id: d.upi_id, payee_name: d.payee_name, instructions: d.instructions, account_name: d.account_name, account_number: d.account_number, ifsc: d.ifsc, bank_name: d.bank_name, branch: d.branch }).filter(([, v]) => v));
    const discounts = d.discount_label && d.discount_type && d.discount_value ? [{ label: d.discount_label, type: d.discount_type, value: d.discount_value, ...(d.discount_until ? { valid_until: istToIso(d.discount_until) } : {}) }] : [];
    if (d.enabled && method.startsWith("upi") && !config.upi_id) throw new Error("invalid_input");
    const row = { edition_id: editionId, method_code: method, enabled: d.enabled, fee_amount: d.fee_amount, currency: d.currency, deadline: istToIso(d.deadline), verification_mode: d.verification_mode, config, discounts, version: (cur?.version ?? 0) + 1, updated_at: new Date().toISOString() };
    const { error } = await db().from("payment_settings").upsert(row, { onConflict: "edition_id,method_code" });
    if (error) throw new Error(error.message);
    await audit(a.adminId, "payment_settings.updated", "payment_settings", `${editionId}:${method}`, cur, row);
  });
}

// ---------- admin users (super admin only) ----------
export async function createAdminUser(fd: FormData) {
  await run("/admin/admins", "Administrator created. Share the temporary password securely.", async () => {
    const a = await requirePermission("admins.manage");
    const p = adminUserSchema.safeParse(Object.fromEntries(fd));
    if (!p.success) throw new Error("invalid_input");
    const { data, error } = await db().auth.admin.createUser({ email: p.data.email, password: p.data.password, email_confirm: true });
    if (error || !data.user) throw new Error(error?.message ?? "create_failed");
    const { error: e2 } = await db().from("admin_users").insert({ auth_user_id: data.user.id, role_code: p.data.role, display_name: p.data.display_name });
    if (e2) { await db().auth.admin.deleteUser(data.user.id); throw new Error(e2.message); }
    await audit(a.adminId, "admin.created", "admin_user", data.user.id, null, { email: p.data.email, role: p.data.role });
  });
}
export async function updateAdminUser(fd: FormData) {
  await run("/admin/admins", "Administrator updated.", async () => {
    const a = await requirePermission("admins.manage");
    const id = text(fd, "id"); const role = text(fd, "role"); const active = text(fd, "active") === "on";
    if (!["super_admin", "registration_admin", "finance_admin"].includes(role)) throw new Error("invalid_input");
    const { data: all } = await db().from("admin_users").select("id,role_code,active");
    const others = (all ?? []).filter((u: { id: string; role_code: string; active: boolean }) => u.id !== id && u.role_code === "super_admin" && u.active);
    if (others.length === 0 && (role !== "super_admin" || !active)) throw new Error("invalid_state"); // never lock everyone out
    const { data: before } = await db().from("admin_users").select("role_code,active").eq("id", id).maybeSingle();
    const { error } = await db().from("admin_users").update({ role_code: role, active }).eq("id", id);
    if (error) throw new Error(error.message);
    await audit(a.adminId, "admin.updated", "admin_user", id, before, { role, active });
  });
}
