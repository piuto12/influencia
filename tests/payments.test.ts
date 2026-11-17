import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { computeFee } from "@/modules/payments/fees";
import { validateProof, MAX_PROOF_BYTES } from "@/modules/payments/upload";
import { buildUpiUri, isValidUpiId } from "@/modules/payments/upi";
import { createOrder, verifyCheckoutSignature, verifyWebhookSignature } from "@/modules/payments/razorpay";
import {
  adminRecordRefund, adminRejectPayment, adminVerifyPayment, choosePayment, confirmRazorpay, getPaymentView, handleRazorpayWebhook,
  PermissionError, startRazorpay, submitProof, type Deps, type MethodSetting, type PaymentRepository, type PaymentRow,
} from "@/modules/payments/service";
import type { StatusRecord } from "@/modules/registration/service";

const rec: StatusRecord = { registrationId: "r1", editionId: "e1", reference: "INF3-ABC234", status: "payment_pending", fullName: "T P",
  email: "t@example.com", mobile: "+919876543210", whatsapp: null, editionTitle: "E3", whatsappGroupUrl: null, paymentStatus: null };
const creds = { reference: "INF3-ABC234", contact: "t@example.com" };
const upi: MethodSetting = { code: "upi", label: "UPI", provider: "manual", feeAmount: 1000, currency: "INR", discounts: [], deadline: null, version: 1,
  config: { upi_id: "x@upi", instructions: "Pay", secret_internal_note: "DO NOT LEAK" } };
const rzp: MethodSetting = { ...upi, code: "razorpay", label: "Razorpay", provider: "razorpay", config: {} };

function repo(methods: MethodSetting[] = [upi, rzp]) {
  const calls: string[] = [];
  const payments = new Map<string, PaymentRow>();
  const r: PaymentRepository & { calls: string[]; payments: Map<string, PaymentRow>; webhooks: Set<string> } = {
    calls, payments, webhooks: new Set(),
    listMethods: async () => methods,
    getLivePayment: async (rid) => [...payments.values()].find((p) => p.registrationId === rid && p.status !== "failed") ?? null,
    getPayment: async (id) => payments.get(id) ?? null,
    createPayment: async (rid, method, amount) => { const id = `p${payments.size + 1}`;
      payments.set(id, { id, registrationId: rid, status: "pending", amount, currency: "INR", method, gatewayOrderId: null, rejectionReason: null, transactionRef: null }); calls.push(`create:${method}:${amount}`); return id; },
    setGatewayOrder: async (id, o) => { payments.get(id)!.gatewayOrderId = o; },
    submitProof: async (id, ref, f) => { calls.push(`proof:${ref}:${f?.mime ?? "none"}`); payments.get(id)!.status = "proof_submitted"; },
    applyGateway: async (o, gp, a, s) => { calls.push(`gw:${o}:${gp}:${a}:${s}`); },
    recordWebhook: async (_p, id) => { if (r.webhooks.has(id)) return false; r.webhooks.add(id); return true; },
    startReview: async () => {}, verify: async (id) => { calls.push(`verify:${id}`); }, reject: async (id, _a, why) => { calls.push(`reject:${id}:${why}`); },
    refund: async (id, _a, amt) => { calls.push(`refund:${id}:${amt}`); }, audit: async (e) => { calls.push(`audit:${e.action}`); },
  };
  return r;
}
const deps = (pay: PaymentRepository, razorpay: Deps["razorpay"] = null): Deps => ({ reg: { findForStatus: async () => rec }, pay, razorpay });
const RZP = { keyId: "rzp_test_x", keySecret: "sek", webhookSecret: "whsec" };
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0]);

describe("fees", () => {
  it("applies the best valid discount and ignores expired/future ones", () => {
    const now = new Date("2026-11-20");
    const f = computeFee(1000, [
      { label: "Early", type: "percent", value: 20, valid_until: "2026-12-01" },
      { label: "Flat", type: "fixed", value: 100 },
      { label: "Expired", type: "percent", value: 90, valid_until: "2026-11-01" },
      { label: "Future", type: "percent", value: 90, valid_from: "2027-01-01" },
    ], "INR", now);
    expect(f.final).toBe(800); expect(f.discountApplied?.label).toBe("Early");
  });
  it("never goes below zero", () => expect(computeFee(100, [{ label: "x", type: "fixed", value: 500 }], "INR").final).toBe(0));
});

describe("proof upload validation", () => {
  it("accepts jpg/png/webp/pdf by magic bytes", () => {
    expect(validateProof(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toMatchObject({ ok: true, mime: "image/jpeg" });
    expect(validateProof(png)).toMatchObject({ ok: true, mime: "image/png" });
    expect(validateProof(new Uint8Array([0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50]))).toMatchObject({ ok: true, mime: "image/webp" });
    expect(validateProof(new TextEncoder().encode("%PDF-1.7"))).toMatchObject({ ok: true, mime: "application/pdf" });
  });
  it("rejects scripts, html/svg, empty and oversize", () => {
    expect(validateProof(new TextEncoder().encode("<script>alert(1)</script>"))).toMatchObject({ ok: false, reason: "unsupported_type" });
    expect(validateProof(new TextEncoder().encode("<svg onload=x>"))).toMatchObject({ ok: false });
    expect(validateProof(new Uint8Array())).toMatchObject({ ok: false, reason: "empty" });
    const big = new Uint8Array(MAX_PROOF_BYTES + 1); big.set([0xff, 0xd8, 0xff]);
    expect(validateProof(big)).toMatchObject({ ok: false, reason: "too_large" });
  });
});

describe("upi", () => {
  it("builds a UPI URI and validates ids", () => {
    const u = buildUpiUri({ upiId: "a@b", payeeName: "Influencia", amount: 1000, note: "INF3-ABC234" });
    expect(u).toContain("pa=a%40b"); expect(u).toContain("am=1000.00"); expect(u.startsWith("upi://pay?")).toBe(true);
    expect(isValidUpiId("name.x@okbank")).toBe(true); expect(isValidUpiId("nope")).toBe(false);
  });
});

describe("razorpay crypto", () => {
  const hm = (k: string, d: string) => crypto.createHmac("sha256", k).update(d).digest("hex");
  it("verifies checkout signature", () => {
    expect(verifyCheckoutSignature("o1", "p1", hm("sek", "o1|p1"), "sek")).toBe(true);
    expect(verifyCheckoutSignature("o1", "p1", hm("sek", "o1|p2"), "sek")).toBe(false);
    expect(verifyCheckoutSignature("o1", "p1", "short", "sek")).toBe(false);
  });
  it("verifies webhook signature over the raw body", () => {
    expect(verifyWebhookSignature('{"a":1}', hm("whsec", '{"a":1}'), "whsec")).toBe(true);
    expect(verifyWebhookSignature('{"a": 1}', hm("whsec", '{"a":1}'), "whsec")).toBe(false);
  });
  it("creates orders in paise via the REST API", async () => {
    let body: { amount: number } | undefined; let auth = "";
    const f = (async (_u: string, init: RequestInit) => { body = JSON.parse(init.body as string); auth = (init.headers as Record<string, string>).Authorization; return new Response(JSON.stringify({ id: "order_1", amount: 100000, currency: "INR" })); }) as unknown as typeof fetch;
    const o = await createOrder({ amount: 1000, currency: "INR", receipt: "R", keyId: "k", keySecret: "s" }, f);
    expect(o.id).toBe("order_1"); expect(body!.amount).toBe(100000); expect(auth.startsWith("Basic ")).toBe(true);
  });
});

describe("public payment flow", () => {
  it("hides razorpay when unconfigured and never exposes non-whitelisted config", async () => {
    const r = await getPaymentView(creds, deps(repo()));
    if (!r.ok) throw new Error("x");
    expect(r.view.methods.map((m) => m.code)).toEqual(["upi"]);
    expect(JSON.stringify(r.view)).not.toContain("DO NOT LEAK");
    const withR = await getPaymentView(creds, deps(repo(), RZP));
    if (withR.ok) expect(withR.view.methods.map((m) => m.code)).toEqual(["upi", "razorpay"]);
  });
  it("works with no payment methods enabled", async () => {
    const r = await getPaymentView(creds, deps(repo([])));
    expect(r).toMatchObject({ ok: true, view: { methods: [] } });
  });
  it("rejects wrong credentials without touching payments", async () => {
    const p = repo(); const d: Deps = { ...deps(p), reg: { findForStatus: async () => rec } };
    expect(await choosePayment({ reference: "INF3-ABC234", contact: "other@x.com" }, "upi", d)).toEqual({ ok: false, error: "unauthorized" });
    expect(p.calls).toEqual([]);
  });
  it("creates the payment with the amount from stored settings, not the client", async () => {
    const p = repo(); const r = await choosePayment(creds, "upi", deps(p));
    expect(r.ok).toBe(true); expect(p.calls).toEqual(["create:upi:1000"]);
  });
  it("applies a configured discount server-side", async () => {
    const p = repo([{ ...upi, discounts: [{ label: "Early", type: "percent", value: 10 }] }]); await choosePayment(creds, "upi", deps(p));
    expect(p.calls).toEqual(["create:upi:900"]);
  });
  it("refuses disabled/unknown methods and razorpay when not configured", async () => {
    expect(await choosePayment(creds, "bank_transfer", deps(repo()))).toMatchObject({ error: "method_unavailable" });
    expect(await choosePayment(creds, "razorpay", deps(repo()))).toMatchObject({ error: "method_unavailable" });
  });
  it("refuses after the method deadline", async () => {
    const p = repo([{ ...upi, deadline: "2026-01-01T00:00:00Z" }]);
    expect(await choosePayment(creds, "upi", { ...deps(p), now: new Date("2026-06-01") })).toMatchObject({ error: "method_unavailable" });
  });
  it("UPI proof submission: reference only, screenshot only, both", async () => {
    const p = repo(); await choosePayment(creds, "upi", deps(p));
    expect(await submitProof(creds, "p1", "UTR123456", null, deps(p))).toMatchObject({ ok: true, hasProof: false });
    expect(await submitProof(creds, "p1", "", png, deps(p))).toMatchObject({ ok: true, hasProof: true });
    expect(p.calls).toContain("proof:UTR123456:none"); expect(p.calls).toContain("proof:null:image/png");
  });
  it("rejects empty submission, bad reference, bad file", async () => {
    const p = repo(); await choosePayment(creds, "upi", deps(p));
    expect(await submitProof(creds, "p1", "", null, deps(p))).toMatchObject({ detail: "reference_or_proof" });
    expect(await submitProof(creds, "p1", "<x>", null, deps(p))).toMatchObject({ detail: "transaction_ref" });
    expect(await submitProof(creds, "p1", "", new TextEncoder().encode("<html>"), deps(p))).toMatchObject({ detail: "unsupported_type" });
  });
  it("cannot attach proof to someone else's payment", async () => {
    const p = repo(); p.payments.set("pX", { id: "pX", registrationId: "other", status: "pending", amount: 1, currency: "INR", method: "upi", gatewayOrderId: null, rejectionReason: null, transactionRef: null });
    expect(await submitProof(creds, "pX", "UTR123456", null, deps(p))).toMatchObject({ error: "invalid_payment" });
  });
});

describe("razorpay flow", () => {
  const hm = (k: string, d: string) => crypto.createHmac("sha256", k).update(d).digest("hex");
  it("creates an order server-side and stores the order id", async () => {
    const p = repo(); await choosePayment(creds, "razorpay", deps(p, RZP));
    const f = (async () => new Response(JSON.stringify({ id: "order_9", amount: 100000, currency: "INR" }))) as unknown as typeof fetch;
    const r = await startRazorpay(creds, "p1", { ...deps(p, RZP), fetchImpl: f });
    expect(r).toMatchObject({ ok: true, orderId: "order_9", keyId: "rzp_test_x" });
    expect(p.payments.get("p1")!.gatewayOrderId).toBe("order_9");
  });
  it("only a valid signature marks the payment paid", async () => {
    const p = repo(); await choosePayment(creds, "razorpay", deps(p, RZP)); p.payments.get("p1")!.gatewayOrderId = "order_9";
    expect(await confirmRazorpay(creds, { orderId: "order_9", paymentId: "pay_1", signature: "forged" }, deps(p, RZP))).toMatchObject({ ok: false });
    expect(p.calls.some((c) => c.startsWith("gw:"))).toBe(false);
    expect(await confirmRazorpay(creds, { orderId: "order_9", paymentId: "pay_1", signature: hm("sek", "order_9|pay_1") }, deps(p, RZP))).toMatchObject({ ok: true });
    expect(p.calls.some((c) => c.startsWith("gw:order_9:pay_1"))).toBe(true);
  });
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_9", amount: 100000 } } } });
  it("webhook: invalid signature is rejected and applies nothing", async () => {
    const p = repo();
    expect(await handleRazorpayWebhook(body, "bad", "evt1", { pay: p, razorpay: RZP })).toBe("invalid_signature");
    expect(p.calls.some((c) => c.startsWith("gw:"))).toBe(false);
  });
  it("webhook: valid signature applies the payment in rupees; duplicate event is safe", async () => {
    const p = repo(); const sig = hm("whsec", body);
    expect(await handleRazorpayWebhook(body, sig, "evt1", { pay: p, razorpay: RZP })).toBe("processed");
    expect(await handleRazorpayWebhook(body, sig, "evt1", { pay: p, razorpay: RZP })).toBe("duplicate");
    expect(p.calls.filter((c) => c.startsWith("gw:"))).toEqual(["gw:order_9:pay_1:1000:webhook", "gw:order_9:pay_1:1000:webhook"]); // idempotent in the DB
  });
  it("webhook: no config means no processing", async () => {
    expect(await handleRazorpayWebhook(body, hm("whsec", body), "e", { pay: repo(), razorpay: null })).toBe("invalid_signature");
  });
});

describe("admin permissions", () => {
  const reg = { id: "a1", role: "registration_admin" as const }, fin = { id: "f1", role: "finance_admin" as const }, sup = { id: "s1", role: "super_admin" as const };
  it("registration admin cannot verify, reject or refund", async () => {
    const p = repo();
    await expect(adminVerifyPayment(reg, "p1", p)).rejects.toBeInstanceOf(PermissionError);
    await expect(adminRejectPayment(reg, "p1", "reason here", p)).rejects.toBeInstanceOf(PermissionError);
    await expect(adminRecordRefund(reg, "p1", 10, "x", p)).rejects.toBeInstanceOf(PermissionError);
    expect(p.calls).toEqual([]);
  });
  it("finance admin can verify, reject (with reason) and refund, each audited", async () => {
    const p = repo();
    await adminVerifyPayment(fin, "p1", p); await adminRejectPayment(fin, "p2", "UTR not found", p); await adminRecordRefund(fin, "p1", 100, "dup", p);
    expect(p.calls).toEqual(["verify:p1", "audit:payment.verified", "reject:p2:UTR not found", "audit:payment.rejected", "refund:p1:100", "audit:payment.refund_recorded"]);
    await expect(adminRejectPayment(fin, "p2", " ", p)).rejects.toThrow("reason_required");
  });
  it("super admin can verify", async () => { const p = repo(); await adminVerifyPayment(sup, "p1", p); expect(p.calls[0]).toBe("verify:p1"); });
});
