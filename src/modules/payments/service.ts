import { can, type Permission, type Role } from "@/lib/rbac";
import { authenticateRegistrant, type RegistrationRepository, type StatusRecord } from "@/modules/registration/service";
import { computeFee, type Discount } from "./fees";
import { createOrder, verifyCheckoutSignature, verifyWebhookSignature } from "./razorpay";
import { validateProof } from "./upload";

export interface MethodSetting {
  code: string; label: string; provider: string; config: Record<string, unknown>;
  feeAmount: number; currency: string; discounts: Discount[]; deadline: string | null; version: number;
}
export interface PaymentRow {
  id: string; registrationId: string; status: string; amount: number; currency: string; method: string;
  gatewayOrderId: string | null; rejectionReason: string | null; transactionRef: string | null;
}
export interface AuditEntry { actor: string; action: string; entityType: string; entityId: string; after?: unknown }

export interface PaymentRepository {
  listMethods(editionId: string): Promise<MethodSetting[]>;
  getLivePayment(registrationId: string): Promise<PaymentRow | null>;
  getPayment(id: string): Promise<PaymentRow | null>;
  createPayment(registrationId: string, method: string, amount: number, discounts: unknown): Promise<string>;
  setGatewayOrder(paymentId: string, orderId: string): Promise<void>;
  submitProof(paymentId: string, txnRef: string | null, file: { bytes: Uint8Array; mime: string; ext: string } | null): Promise<void>;
  applyGateway(orderId: string, gatewayPaymentId: string, amount: number | null, source: string): Promise<void>;
  recordWebhook(provider: string, eventId: string, payload: unknown, signatureValid: boolean): Promise<boolean>;
  startReview(paymentId: string, actor: string): Promise<void>;
  verify(paymentId: string, actor: string): Promise<void>;
  reject(paymentId: string, actor: string, reason: string): Promise<void>;
  refund(paymentId: string, actor: string, amount: number, reason: string): Promise<void>;
  audit(entry: AuditEntry): Promise<void>;
}

export interface RazorpayConfig { keyId: string; keySecret: string; webhookSecret: string }
export interface Deps { reg: Pick<RegistrationRepository, "findForStatus">; pay: PaymentRepository; razorpay: RazorpayConfig | null; fetchImpl?: typeof fetch; now?: Date }

/** Only these keys of a method's config are ever sent to the browser. */
const PUBLIC_KEYS: Record<string, string[]> = {
  upi: ["upi_id", "payee_name", "instructions"], upi_qr: ["upi_id", "payee_name", "instructions"],
  bank_transfer: ["account_name", "account_number", "ifsc", "bank_name", "branch", "instructions"],
  venue: ["instructions"], razorpay: ["instructions"],
};
export function publicConfig(code: string, config: Record<string, unknown>) {
  const out: Record<string, string> = {};
  for (const k of PUBLIC_KEYS[code] ?? ["instructions"]) if (typeof config[k] === "string") out[k] = config[k] as string;
  return out;
}

export interface PublicMethod { code: string; label: string; amount: number; baseFee: number; discountLabel: string | null; currency: string; config: Record<string, string> }
export interface PaymentView { payment: Pick<PaymentRow, "id" | "status" | "amount" | "currency" | "method" | "rejectionReason"> | null; methods: PublicMethod[]; registrationStatus: string }
export type PayError = "unauthorized" | "no_methods" | "method_unavailable" | "invalid_payment" | "invalid_input" | "payment_in_progress" | "unavailable";
export type PayResult<T> = ({ ok: true } & T) | { ok: false; error: PayError; detail?: string };

async function auth(creds: Record<string, unknown>, d: Deps): Promise<StatusRecord | null> {
  return authenticateRegistrant(creds, d.reg);
}

export async function getPaymentView(creds: Record<string, unknown>, d: Deps): Promise<PayResult<{ view: PaymentView }>> {
  const r = await auth(creds, d); if (!r) return { ok: false, error: "unauthorized" };
  const [settings, payment] = await Promise.all([d.pay.listMethods(r.editionId), d.pay.getLivePayment(r.registrationId)]);
  const now = d.now ?? new Date();
  const methods: PublicMethod[] = settings
    .filter((m) => (m.provider === "razorpay" ? d.razorpay !== null : true))
    .filter((m) => !m.deadline || now <= new Date(m.deadline))
    .map((m) => { const f = computeFee(m.feeAmount, m.discounts, m.currency, now);
      return { code: m.code, label: m.label, amount: f.final, baseFee: f.baseFee, discountLabel: f.discountApplied?.label ?? null, currency: m.currency, config: publicConfig(m.code, m.config) }; });
  return { ok: true, view: { registrationStatus: r.status, methods,
    payment: payment ? { id: payment.id, status: payment.status, amount: payment.amount, currency: payment.currency, method: payment.method, rejectionReason: payment.rejectionReason } : null } };
}

export async function choosePayment(creds: Record<string, unknown>, method: string, d: Deps): Promise<PayResult<{ paymentId: string }>> {
  const r = await auth(creds, d); if (!r) return { ok: false, error: "unauthorized" };
  if (["confirmed", "rejected", "cancelled"].includes(r.status)) return { ok: false, error: "invalid_payment" };
  const settings = (await d.pay.listMethods(r.editionId)).find((m) => m.code === method);
  if (!settings || (settings.provider === "razorpay" && !d.razorpay)) return { ok: false, error: "method_unavailable" };
  const now = d.now ?? new Date();
  if (settings.deadline && now > new Date(settings.deadline)) return { ok: false, error: "method_unavailable" };
  const fee = computeFee(settings.feeAmount, settings.discounts, settings.currency, now); // amount always from stored settings
  try {
    const id = await d.pay.createPayment(r.registrationId, method, fee.final, fee.discountApplied ? [fee.discountApplied] : []);
    return { ok: true, paymentId: id };
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (m.includes("payment_in_progress")) return { ok: false, error: "payment_in_progress" };
    if (m.includes("method_unavailable") || m.includes("payment_deadline_passed")) return { ok: false, error: "method_unavailable" };
    return { ok: false, error: "unavailable" };
  }
}

const TXN = /^[A-Za-z0-9\-_/]{6,40}$/;

export async function submitProof(creds: Record<string, unknown>, paymentId: string, txnRef: string, file: Uint8Array | null, d: Deps): Promise<PayResult<{ hasProof: boolean }>> {
  const r = await auth(creds, d); if (!r) return { ok: false, error: "unauthorized" };
  const p = await d.pay.getPayment(paymentId);
  if (!p || p.registrationId !== r.registrationId) return { ok: false, error: "invalid_payment" };
  const ref = txnRef.trim();
  if (ref && !TXN.test(ref)) return { ok: false, error: "invalid_input", detail: "transaction_ref" };
  let proof: { bytes: Uint8Array; mime: string; ext: string } | null = null;
  if (file && file.length > 0) {
    const v = validateProof(file);
    if (!v.ok) return { ok: false, error: "invalid_input", detail: v.reason };
    proof = { bytes: file, mime: v.mime, ext: v.ext };
  }
  if (!ref && !proof) return { ok: false, error: "invalid_input", detail: "reference_or_proof" };
  try { await d.pay.submitProof(paymentId, ref || null, proof); return { ok: true, hasProof: !!proof }; }
  catch (e) { return { ok: false, error: (e instanceof Error && e.message.includes("invalid_state")) ? "invalid_payment" : "unavailable" }; }
}

export async function startRazorpay(creds: Record<string, unknown>, paymentId: string, d: Deps): Promise<PayResult<{ orderId: string; keyId: string; amount: number; currency: string }>> {
  if (!d.razorpay) return { ok: false, error: "method_unavailable" };
  const r = await auth(creds, d); if (!r) return { ok: false, error: "unauthorized" };
  const p = await d.pay.getPayment(paymentId);
  if (!p || p.registrationId !== r.registrationId || p.method !== "razorpay" || p.status !== "pending") return { ok: false, error: "invalid_payment" };
  try {
    const order = await createOrder({ amount: p.amount, currency: p.currency, receipt: r.reference, keyId: d.razorpay.keyId, keySecret: d.razorpay.keySecret }, d.fetchImpl);
    await d.pay.setGatewayOrder(p.id, order.id);
    return { ok: true, orderId: order.id, keyId: d.razorpay.keyId, amount: p.amount, currency: p.currency };
  } catch { return { ok: false, error: "unavailable" }; }
}

/** Browser-reported success is only a hint; the HMAC signature (server-side) is what counts. */
export async function confirmRazorpay(creds: Record<string, unknown>, o: { orderId: string; paymentId: string; signature: string }, d: Deps): Promise<PayResult<object>> {
  if (!d.razorpay) return { ok: false, error: "method_unavailable" };
  const r = await auth(creds, d); if (!r) return { ok: false, error: "unauthorized" };
  const live = await d.pay.getLivePayment(r.registrationId);
  if (!live || live.gatewayOrderId !== o.orderId) return { ok: false, error: "invalid_payment" };
  if (!verifyCheckoutSignature(o.orderId, o.paymentId, o.signature, d.razorpay.keySecret)) return { ok: false, error: "invalid_payment" };
  try { await d.pay.applyGateway(o.orderId, o.paymentId, null, "checkout"); return { ok: true }; }
  catch { return { ok: false, error: "unavailable" }; }
}

export type WebhookOutcome = "invalid_signature" | "duplicate" | "processed" | "ignored";

export async function handleRazorpayWebhook(rawBody: string, signature: string, eventId: string, d: Pick<Deps, "pay" | "razorpay">): Promise<WebhookOutcome> {
  if (!d.razorpay || !signature) return "invalid_signature";
  const valid = verifyWebhookSignature(rawBody, signature, d.razorpay.webhookSecret);
  let payload: { event?: string; payload?: { payment?: { entity?: { id: string; order_id: string; amount: number } } } } = {};
  try { payload = JSON.parse(rawBody); } catch { return "invalid_signature"; }
  const fresh = await d.pay.recordWebhook("razorpay", eventId || `nosig-${signature.slice(0, 16)}`, payload, valid);
  if (!valid) return "invalid_signature";
  // Always (re)apply: applyGateway is idempotent, so a retry after a half-failed first delivery still completes.
  const e = payload.payload?.payment?.entity;
  if ((payload.event === "payment.captured" || payload.event === "order.paid") && e?.order_id) {
    await d.pay.applyGateway(e.order_id, e.id, e.amount / 100, "webhook");
    return fresh ? "processed" : "duplicate";
  }
  return fresh ? "ignored" : "duplicate";
}

// ---- Admin (role-checked here; the admin UI in Phase 5 calls these) ----
export class PermissionError extends Error { constructor(p: Permission) { super(`forbidden:${p}`); } }
export interface Actor { id: string; role: Role }
function need(a: Actor, p: Permission) { if (!can(a.role, p)) throw new PermissionError(p); }

export async function adminStartReview(a: Actor, id: string, pay: PaymentRepository) {
  need(a, "payments.verify"); await pay.startReview(id, a.id); await pay.audit({ actor: a.id, action: "payment.review_started", entityType: "payment", entityId: id });
}
export async function adminVerifyPayment(a: Actor, id: string, pay: PaymentRepository) {
  need(a, "payments.verify"); await pay.verify(id, a.id); await pay.audit({ actor: a.id, action: "payment.verified", entityType: "payment", entityId: id });
}
export async function adminRejectPayment(a: Actor, id: string, reason: string, pay: PaymentRepository) {
  need(a, "payments.verify");
  if (reason.trim().length < 3) throw new Error("reason_required");
  await pay.reject(id, a.id, reason.trim()); await pay.audit({ actor: a.id, action: "payment.rejected", entityType: "payment", entityId: id, after: { reason } });
}
export async function adminRecordRefund(a: Actor, id: string, amount: number, reason: string, pay: PaymentRepository) {
  need(a, "payments.refund");
  await pay.refund(id, a.id, amount, reason); await pay.audit({ actor: a.id, action: "payment.refund_recorded", entityType: "payment", entityId: id, after: { amount, reason } });
}
