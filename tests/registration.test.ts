import { beforeEach, describe, expect, it } from "vitest";
import { normalizePhone, registrationSchema } from "@/modules/registration/schemas";
import { lookupStatus, registerParticipant, type Availability, type RegistrationRepository, type StatusRecord } from "@/modules/registration/service";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";

const valid = {
  full_name: "  Test  Person ", mobile: "98765 43210", whatsapp: "", email: " Test@Example.COM ",
  organization: "Org", designation: "Mgr", department: "Ops", city: "Calicut",
  category: "manager_leader", previous_participation: "no", consent: "on",
};

function fakeRepo(over: Partial<Availability> = {}, seen: Record<string, unknown>[] = []): RegistrationRepository & { rec?: StatusRecord } {
  const taken = new Set<string>();
  const a: Availability = { registrationOpen: true, confirmed: 0, capacity: 200, waitlistEnabled: false, deadline: null, ...over };
  return {
    getAvailability: async () => a,
    register: async (_c, data) => {
      seen.push(data);
      const e = String(data.email);
      if (taken.has(e)) throw new Error("duplicate_registration");
      taken.add(e);
      return { registrationId: "id", reference: "INF3-ABC234" };
    },
    findForStatus: async function () { return this.rec ?? null; },
  };
}

describe("schemas", () => {
  it("normalises phones", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
    expect(normalizePhone("+91 98765-43210")).toBe("+919876543210");
    expect(normalizePhone("09876543210")).toBe("+919876543210");
    expect(normalizePhone("+14155550123")).toBe("+14155550123");
    expect(normalizePhone("12345")).toBeNull();
  });
  it("cleans and lowercases valid input", () => {
    const r = registrationSchema.parse(valid);
    expect(r.full_name).toBe("Test Person");
    expect(r.email).toBe("test@example.com");
    expect(r.mobile).toBe("+919876543210");
  });
  it("rejects bad category, email, missing consent", () => {
    const r = registrationSchema.safeParse({ ...valid, category: "alien", email: "x", consent: undefined });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(r.error.flatten().fieldErrors)).toEqual(expect.arrayContaining(["category", "email", "consent"]));
  });
  it("accepts all seven categories", () => {
    for (const c of ["entrepreneur","corporate_professional","college_faculty","student","business_owner","manager_leader","general_public"])
      expect(registrationSchema.safeParse({ ...valid, category: c }).success).toBe(true);
  });
});

describe("registerParticipant", () => {
  it("succeeds and sends cleaned data without consent/honeypot", async () => {
    const seen: Record<string, unknown>[] = [];
    const r = await registerParticipant("INF3", valid, fakeRepo({}, seen));
    expect(r).toEqual({ ok: true, reference: "INF3-ABC234" });
    expect(seen[0]).not.toHaveProperty("consent");
    expect(seen[0].whatsapp).toBeNull();
  });
  it("returns field errors on invalid input and never hits the repo", async () => {
    const r = await registerParticipant("INF3", { ...valid, email: "bad" }, fakeRepo());
    expect(r).toMatchObject({ ok: false, code: "validation" });
  });
  it("blocks duplicates", async () => {
    const repo = fakeRepo();
    await registerParticipant("INF3", valid, repo);
    expect(await registerParticipant("INF3", valid, repo)).toMatchObject({ ok: false, code: "duplicate_registration" });
  });
  it("blocks when closed, past deadline, or full without waitlist", async () => {
    expect(await registerParticipant("INF3", valid, fakeRepo({ registrationOpen: false }))).toMatchObject({ code: "registration_closed" });
    expect(await registerParticipant("INF3", valid, fakeRepo({ deadline: "2026-01-01T00:00:00Z" }), new Date("2026-06-01"))).toMatchObject({ code: "deadline_passed" });
    expect(await registerParticipant("INF3", valid, fakeRepo({ confirmed: 200 }))).toMatchObject({ code: "capacity_full" });
  });
  it("allows registration at capacity when waitlist is enabled", async () => {
    expect(await registerParticipant("INF3", valid, fakeRepo({ confirmed: 200, waitlistEnabled: true }))).toMatchObject({ ok: true });
  });
  it("hides unexpected errors behind 'unavailable'", async () => {
    const repo = fakeRepo(); repo.register = async () => { throw new Error("connection string leaked"); };
    expect(await registerParticipant("INF3", valid, repo)).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("lookupStatus", () => {
  const rec: StatusRecord = { registrationId: "r1", editionId: "e1", reference: "INF3-ABC234", status: "confirmed", fullName: "Test Person", email: "test@example.com",
    mobile: "+919876543210", whatsapp: null, editionTitle: "Edition 3", whatsappGroupUrl: "https://chat.example/x", paymentStatus: "verified" };
  it("matches by email or phone, case-insensitively", async () => {
    const repo = fakeRepo(); repo.rec = rec;
    expect(await lookupStatus({ reference: "inf3-abc234", contact: "TEST@example.com" }, repo)).toMatchObject({ found: true, firstName: "Test" });
    expect(await lookupStatus({ reference: "INF3-ABC234", contact: "98765 43210" }, repo)).toMatchObject({ found: true });
  });
  it("same 'not found' for wrong contact, unknown ref and malformed input", async () => {
    const repo = fakeRepo(); repo.rec = rec;
    expect(await lookupStatus({ reference: "INF3-ABC234", contact: "other@x.com" }, repo)).toEqual({ found: false });
    expect(await lookupStatus({ reference: "nonsense", contact: "x" }, repo)).toEqual({ found: false });
    expect(await lookupStatus({ reference: "INF3-ZZZZZZ", contact: "test@example.com" }, fakeRepo())).toEqual({ found: false });
  });
  it("releases WhatsApp group link only when confirmed", async () => {
    const repo = fakeRepo(); repo.rec = { ...rec, status: "payment_pending" };
    expect(await lookupStatus({ reference: "INF3-ABC234", contact: "test@example.com" }, repo)).toMatchObject({ found: true, whatsappGroupUrl: null });
    repo.rec = rec;
    expect(await lookupStatus({ reference: "INF3-ABC234", contact: "test@example.com" }, repo)).toMatchObject({ whatsappGroupUrl: "https://chat.example/x" });
  });
  it("never exposes email or phone", async () => {
    const repo = fakeRepo(); repo.rec = rec;
    const out = JSON.stringify(await lookupStatus({ reference: "INF3-ABC234", contact: "test@example.com" }, repo));
    expect(out).not.toContain("example.com"); expect(out).not.toContain("9876543210");
  });
});

describe("rateLimit", () => {
  beforeEach(resetRateLimits);
  it("allows up to the limit then blocks, then resets", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 1000, 0)).toBe(true);
    expect(rateLimit("k", 3, 1000, 10)).toBe(false);
    expect(rateLimit("k", 3, 1000, 2000)).toBe(true);
  });
});
