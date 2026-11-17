"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdmin } from "@/lib/auth";
import { rateLimitShared } from "@/lib/rate-limit";
import { audit } from "./helpers";

const CODE = /^\d{6}$/;
export type EnrollResult = { ok: true; factorId: string; qr: string; secret: string } | { ok: false };
export type MfaResult = { ok: boolean; error?: "invalid_code" | "rate_limited" | "unavailable" };

/** Anything an MFA step needs: a signed-in active admin (a pending second factor is fine here, that is what we are resolving). */
async function me() { const a = await getAdmin(); if (!a) redirect("/admin/login"); return a; }

export async function startEnrollment(): Promise<EnrollResult> {
  await me();
  const supabase = await createClient();
  // Remove abandoned, never-verified factors first, otherwise Supabase refuses a second enrolment.
  const { data: list } = await supabase.auth.mfa.listFactors();
  for (const f of list?.all ?? []) if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Influencia admin ${new Date().toISOString().slice(0, 10)}` });
  if (error || !data) return { ok: false };
  return { ok: true, factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmEnrollment(factorId: string, code: string): Promise<MfaResult> {
  const a = await me();
  if (!CODE.test(code)) return { ok: false, error: "invalid_code" };
  if (!(await rateLimitShared(`mfa:${a.authUserId}`, 8, 10 * 60_000))) return { ok: false, error: "rate_limited" };
  const supabase = await createClient();
  const { data: ch, error: e1 } = await supabase.auth.mfa.challenge({ factorId });
  if (e1 || !ch) return { ok: false, error: "unavailable" };
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code });
  if (error) return { ok: false, error: "invalid_code" };
  await audit(a.adminId, "mfa.enrolled", "admin_user", a.adminId);
  return { ok: true };
}

/** Second step of sign-in for an admin who already enrolled. */
export async function verifyLoginCode(code: string): Promise<MfaResult> {
  const a = await me();
  if (!CODE.test(code)) return { ok: false, error: "invalid_code" };
  if (!(await rateLimitShared(`mfa:${a.authUserId}`, 8, 10 * 60_000))) return { ok: false, error: "rate_limited" };
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.[0]; if (!factor) return { ok: false, error: "unavailable" };
  const { data: ch, error: e1 } = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (e1 || !ch) return { ok: false, error: "unavailable" };
  const { error } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: ch.id, code });
  if (error) return { ok: false, error: "invalid_code" };
  await audit(a.adminId, "mfa.login_verified", "admin_user", a.adminId);
  return { ok: true };
}

/** Removing a factor needs a fully verified (aal2) session and is refused where MFA is mandatory for the role. */
export async function disableMfa(): Promise<MfaResult> {
  const a = await me();
  if (a.mfa !== "ok") return { ok: false, error: "unavailable" };
  const { MFA_PRIVILEGED, parseMfaMode } = await import("@/lib/mfa");
  if (parseMfaMode(process.env.ADMIN_MFA) === "required" && MFA_PRIVILEGED.includes(a.role)) return { ok: false, error: "unavailable" };
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.totp ?? []) { const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id }); if (error) return { ok: false, error: "unavailable" }; }
  await audit(a.adminId, "mfa.disabled", "admin_user", a.adminId);
  return { ok: true };
}
