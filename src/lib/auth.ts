import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, ROLES, type Permission, type Role } from "@/lib/rbac";
import { mfaDecision, parseMfaMode, type MfaDecision } from "@/lib/mfa";

export interface AdminSession { adminId: string; authUserId: string; role: Role; name: string; email: string; mfa: MfaDecision }

/** Resolves the signed-in Supabase user to an ACTIVE admin_users row, or null. */
export async function getAdmin(): Promise<AdminSession | null> {
  // Opt into per-request rendering BEFORE the try/catch below: a catch-all must never swallow Next's
  // prerender "postpone" signal (it made Supabase's Date.now() run during prerender).
  await connection();
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    const { data: row } = await createAdminClient().from("admin_users")
      .select("id,role_code,display_name,active").eq("auth_user_id", data.user.id).maybeSingle();
    if (!row || !row.active || !(ROLES as readonly string[]).includes(row.role_code)) return null;
    const role = row.role_code as Role;
    const mode = parseMfaMode(process.env.ADMIN_MFA);
    let mfa: MfaDecision = "ok";
    if (mode !== "off") {
      const [{ data: factors }, { data: aal }] = await Promise.all([supabase.auth.mfa.listFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
      mfa = mfaDecision({ mode, role, hasVerifiedFactor: (factors?.totp?.length ?? 0) > 0, currentLevel: aal?.currentLevel });
    }
    return { adminId: row.id, authUserId: data.user.id, role, name: row.display_name, email: data.user.email ?? "", mfa };
  } catch { return null; }
}

export class ForbiddenError extends Error { constructor(p: Permission) { super(`forbidden:${p}`); } }

/** For server actions and route handlers: throws instead of redirecting on missing permission. */
export async function requirePermission(p: Permission): Promise<AdminSession> {
  const a = await getAdmin();
  if (!a) redirect("/admin/login");
  if (a.mfa !== "ok") throw new ForbiddenError(p); // second factor still pending: no privileged action may run
  if (!can(a.role, p)) throw new ForbiddenError(p);
  return a;
}

/** For pages: redirects to the dashboard with a notice when the role lacks the permission. */
export async function requirePageAccess(p: Permission | Permission[]): Promise<AdminSession> {
  const a = await getAdmin();
  if (!a) redirect("/admin/login");
  enforceMfa(a);
  const list = Array.isArray(p) ? p : [p];
  if (!list.some((x) => can(a.role, x))) redirect("/admin?denied=1");
  return a;
}

/** Sends a session that still owes a second factor to the right screen. Call right after getAdmin() in any page or layout. */
export function enforceMfa(a: AdminSession): void {
  if (a.mfa === "challenge") redirect("/admin/login/mfa");
  if (a.mfa === "enroll") redirect("/admin/security?required=1");
}
