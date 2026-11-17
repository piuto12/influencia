import { describe, expect, it } from "vitest";
import { can, PERMISSIONS } from "@/lib/rbac";

describe("rbac", () => {
  it("super admin has every permission", () => {
    PERMISSIONS.forEach((p) => expect(can("super_admin", p)).toBe(true));
  });
  it("registration admin cannot verify payments or configure them", () => {
    expect(can("registration_admin", "payments.verify")).toBe(false);
    expect(can("registration_admin", "payments.configure")).toBe(false);
    expect(can("registration_admin", "registrations.review")).toBe(true);
  });
  it("finance admin cannot approve registrations", () => {
    expect(can("finance_admin", "registrations.review")).toBe(false);
    expect(can("finance_admin", "payments.verify")).toBe(true);
  });
  it("anonymous has nothing", () => {
    expect(can(null, "participants.read")).toBe(false);
  });
});
