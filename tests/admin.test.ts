import { describe, expect, it } from "vitest";
import { summarizePayments, summarizeRegistrations } from "@/modules/admin/stats";
import { csvCell, toCsv } from "@/modules/admin/csv";
import { adminUserSchema, editionSettingsSchema, isoToIstInput, istToIso, paymentSettingsSchema } from "@/modules/admin/schemas";
import { can, PERMISSIONS, ROLE_PERMISSIONS } from "@/lib/rbac";

describe("dashboard stats", () => {
  const rows = [
    { status: "confirmed", category: "student" }, { status: "confirmed", category: "entrepreneur" },
    { status: "payment_pending", category: "student" }, { status: "under_verification", category: "student" },
    { status: "rejected", category: "student" }, { status: "waitlisted", category: "general_public" },
  ];
  it("pending excludes confirmed/rejected/waitlisted; seats use confirmed only", () => {
    const s = summarizeRegistrations(rows, 200, 1);
    expect(s).toMatchObject({ total: 6, confirmed: 2, pending: 2, availableSeats: 198, checkedIn: 1, attendanceRate: 50 });
    expect(s.byCategory.student).toBe(4);
  });
  it("available seats never negative; no division by zero", () => {
    expect(summarizeRegistrations(rows, 1).availableSeats).toBe(0);
    expect(summarizeRegistrations([], 200).attendanceRate).toBe(0);
  });
  it("collection = verified less refunds, per currency; counts awaiting verification", () => {
    const p = summarizePayments([
      { status: "verified", amount: 1000, refunded: 0, currency: "INR" },
      { status: "partially_refunded", amount: 1000, refunded: 400, currency: "INR" },
      { status: "refunded", amount: 1000, refunded: 1000, currency: "INR" },
      { status: "proof_submitted", amount: 1000, refunded: 0, currency: "INR" },
      { status: "rejected", amount: 1000, refunded: 0, currency: "INR" },
    ]);
    expect(p.net.INR).toBe(1600); expect(p.awaitingVerification).toBe(1);
  });
});

describe("csv export", () => {
  it("neutralises formula injection but keeps phone numbers", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("@cmd")).toBe("'@cmd"); expect(csvCell("-1+1")).toBe("'-1+1");
    expect(csvCell("+919876543210")).toBe("+919876543210");
    expect(csvCell("+cmd|x")).toBe("'+cmd|x");
  });
  it("quotes commas/newlines and adds a BOM", () => {
    expect(csvCell("a,b")).toBe('"a,b"'); expect(csvCell("l1\nl2")).toBe('"l1\nl2"'); expect(csvCell(null)).toBe("");
    expect(toCsv(["A"], [["x"]]).startsWith("﻿")).toBe(true);
  });
});

describe("settings validation", () => {
  it("converts IST datetime-local to UTC and back", () => {
    expect(istToIso("2026-12-19T09:00")).toBe("2026-12-19T03:30:00.000Z");
    expect(isoToIstInput("2026-12-19T03:30:00.000Z")).toBe("2026-12-19T09:00");
    expect(istToIso("")).toBeNull(); expect(() => istToIso("nope")).toThrow();
  });
  it("edition: rejects negative capacity and non-WhatsApp group links", () => {
    const base = { title: "Edition 3", capacity: "200", status: "active" };
    expect(editionSettingsSchema.safeParse(base).success).toBe(true);
    expect(editionSettingsSchema.safeParse({ ...base, capacity: "-1" }).success).toBe(false);
    expect(editionSettingsSchema.safeParse({ ...base, whatsapp_group_url: "https://evil.example/x" }).success).toBe(false);
    expect(editionSettingsSchema.safeParse({ ...base, whatsapp_group_url: "https://chat.whatsapp.com/AbC123" }).success).toBe(true);
  });
  it("payment settings: validates UPI id, IFSC, fee, currency", () => {
    const base = { fee_amount: "1000", currency: "inr", verification_mode: "manual" };
    expect(paymentSettingsSchema.parse(base).currency).toBe("INR");
    expect(paymentSettingsSchema.safeParse({ ...base, upi_id: "bad" }).success).toBe(false);
    expect(paymentSettingsSchema.safeParse({ ...base, upi_id: "a.b@okbank" }).success).toBe(true);
    expect(paymentSettingsSchema.safeParse({ ...base, ifsc: "XYZ" }).success).toBe(false);
    expect(paymentSettingsSchema.safeParse({ ...base, fee_amount: "-5" }).success).toBe(false);
  });
  it("admin user: requires a strong-enough password and valid role", () => {
    const base = { email: "A@x.com", display_name: "Ann", role: "finance_admin", password: "correct-horse-battery" };
    expect(adminUserSchema.parse(base).email).toBe("a@x.com");
    expect(adminUserSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
    expect(adminUserSchema.safeParse({ ...base, role: "root" }).success).toBe(false);
  });
});

describe("role matrix (spec)", () => {
  it("registration admin: participants/approvals/attendance only, no money or admin management", () => {
    for (const p of ["participants.read", "participants.write", "registrations.review", "attendance.manage"] as const) expect(can("registration_admin", p)).toBe(true);
    for (const p of ["payments.verify", "payments.refund", "payments.configure", "reports.finance", "admins.manage", "settings.manage", "events.manage"] as const) expect(can("registration_admin", p)).toBe(false);
  });
  it("finance admin: payments/refunds/finance reports only", () => {
    for (const p of ["payments.read", "payments.verify", "payments.refund", "reports.finance"] as const) expect(can("finance_admin", p)).toBe(true);
    for (const p of ["registrations.review", "participants.write", "payments.configure", "admins.manage", "content.manage", "events.manage"] as const) expect(can("finance_admin", p)).toBe(false);
  });
  it("super admin has everything; every permission is granted to at least one role", () => {
    for (const p of PERMISSIONS) { expect(can("super_admin", p)).toBe(true); expect(Object.values(ROLE_PERMISSIONS).some((l) => l.includes(p))).toBe(true); }
  });
});
