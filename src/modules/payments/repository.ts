import "server-only";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MethodSetting, PaymentRepository, PaymentRow } from "./service";

const BUCKET = "private-payment-proofs";
const rpc = async (fn: string, args: Record<string, unknown>) => {
  const { data, error } = await createAdminClient().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
};
type Row = { id: string; registration_id: string; status: string; amount: string | number; currency: string; method_code: string; gateway_order_id: string | null; rejection_reason: string | null; transaction_ref: string | null };
const toRow = (r: Row): PaymentRow => ({ id: r.id, registrationId: r.registration_id, status: r.status, amount: Number(r.amount), currency: r.currency, method: r.method_code, gatewayOrderId: r.gateway_order_id, rejectionReason: r.rejection_reason, transactionRef: r.transaction_ref });
const COLS = "id,registration_id,status,amount,currency,method_code,gateway_order_id,rejection_reason,transaction_ref";

export const supabasePaymentRepository: PaymentRepository = {
  async listMethods(editionId): Promise<MethodSetting[]> {
    const { data, error } = await createAdminClient().from("payment_settings")
      .select("method_code,config,fee_amount,currency,discounts,deadline,version,payment_methods(label,provider,sort_order)")
      .eq("edition_id", editionId).eq("enabled", true);
    if (error) throw error;
    return (data ?? []).map((s) => { const m = s.payment_methods as unknown as { label: string; provider: string; sort_order: number };
      return { code: s.method_code, label: m.label, provider: m.provider, config: s.config as Record<string, unknown>, feeAmount: Number(s.fee_amount), currency: s.currency.trim(), discounts: s.discounts as never, deadline: s.deadline, version: s.version, _o: m.sort_order }; })
      .sort((a, b) => a._o - b._o).map(({ _o, ...rest }) => (void _o, rest));
  },
  async getLivePayment(registrationId) {
    const { data, error } = await createAdminClient().from("payments").select(COLS).eq("registration_id", registrationId)
      .neq("status", "failed").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error; return data ? toRow(data as Row) : null;
  },
  async getPayment(id) {
    const { data, error } = await createAdminClient().from("payments").select(COLS).eq("id", id).maybeSingle();
    if (error) throw error; return data ? toRow(data as Row) : null;
  },
  async createPayment(regId, method, amount, discounts) {
    return (await rpc("create_payment", { p_registration: regId, p_method: method, p_fee: amount, p_discount: discounts })) as string;
  },
  async setGatewayOrder(paymentId, orderId) { await rpc("set_gateway_order", { p_payment: paymentId, p_order: orderId }); },
  async submitProof(paymentId, txnRef, file) {
    let path: string | null = null;
    if (file) {
      const p = await this.getPayment(paymentId);
      path = `${p!.registrationId}/${crypto.randomUUID()}.${file.ext}`;
      const { error } = await createAdminClient().storage.from(BUCKET).upload(path, file.bytes, { contentType: file.mime, upsert: false });
      if (error) throw new Error(error.message);
    }
    await rpc("submit_payment_proof", { p_payment: paymentId, p_txn_ref: txnRef, p_path: path, p_mime: file?.mime ?? null, p_size: file?.bytes.length ?? null });
  },
  async applyGateway(orderId, gatewayPaymentId, amount, source) {
    await rpc("apply_gateway_payment", { p_order: orderId, p_gateway_payment: gatewayPaymentId, p_amount: amount, p_source: source });
  },
  async recordWebhook(provider, eventId, payload, valid) {
    const { error } = await createAdminClient().from("payment_webhooks").insert({ provider, event_id: eventId, payload, signature_valid: valid });
    if (!error) return true;
    if (error.code === "23505") return false; // duplicate event id
    throw new Error(error.message);
  },
  async startReview(id, actor) { await rpc("start_payment_review", { p_payment: id, p_actor: actor }); },
  async verify(id, actor) { await rpc("verify_payment", { p_payment: id, p_actor: actor, p_txn_ref: null }); },
  async reject(id, actor, reason) { await rpc("reject_payment", { p_payment: id, p_actor: actor, p_reason: reason }); },
  async refund(id, actor, amount, reason) { await rpc("record_refund", { p_payment: id, p_amount: amount, p_reason: reason, p_actor: actor }); },
  async audit(e) {
    const { error } = await createAdminClient().from("audit_logs").insert({ actor_id: e.actor, action: e.action, entity_type: e.entityType, entity_id: e.entityId, after: e.after ?? null });
    if (error) throw new Error(error.message);
  },
};
