import type { Role } from "@/lib/rbac";

export type MfaMode = "off" | "optional" | "required";
export type MfaDecision = "ok" | "challenge" | "enroll";

/** Roles that handle money or admin accounts; MFA enrolment is mandatory for them when ADMIN_MFA=required. */
export const MFA_PRIVILEGED: readonly Role[] = ["super_admin", "finance_admin"];

export function parseMfaMode(v: string | undefined): MfaMode {
  return v === "off" || v === "required" ? v : "optional";
}

/**
 *  off       -> never asked.
 *  optional  -> anyone who has enrolled must pass the challenge; nobody is forced to enrol.
 *  required  -> as optional, and privileged roles without a factor are forced to enrol.
 */
export function mfaDecision(o: { mode: MfaMode; role: Role; hasVerifiedFactor: boolean; currentLevel: string | null | undefined }): MfaDecision {
  if (o.mode === "off") return "ok";
  if (o.hasVerifiedFactor) return o.currentLevel === "aal2" ? "ok" : "challenge";
  if (o.mode === "required" && MFA_PRIVILEGED.includes(o.role)) return "enroll";
  return "ok";
}
