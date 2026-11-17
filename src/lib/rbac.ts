export const ROLES = ["super_admin", "registration_admin", "finance_admin"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "participants.read", "participants.write", "registrations.review",
  "attendance.manage", "payments.read", "payments.verify", "payments.refund",
  "payments.configure", "reports.registration", "reports.finance",
  "content.manage", "media.manage", "events.manage", "settings.manage",
  "admins.manage", "certificates.manage", "audit.read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Mirrors the role_permissions seed in supabase/migrations. Keep in sync (a test checks coverage). */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  registration_admin: [
    "participants.read", "participants.write", "registrations.review",
    "attendance.manage", "certificates.manage", "reports.registration",
  ],
  finance_admin: ["payments.read", "payments.verify", "payments.refund", "reports.finance"],
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return role ? ROLE_PERMISSIONS[role].includes(permission) : false;
}
