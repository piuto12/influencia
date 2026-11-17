"use server";
import { headers } from "next/headers";
import { rateLimitShared } from "@/lib/rate-limit";
import { razorpayConfigured } from "@/lib/env";
import { supabaseRegistrationRepository } from "@/modules/registration/repository";
import { supabasePaymentRepository } from "./repository";
import { upiQrDataUrl, buildUpiUri } from "./upi";
import { notify } from "@/modules/notifications/service";
import { registrationIdByReference } from "@/modules/notifications/lookup";
import { choosePayment, confirmRazorpay, getPaymentView, startRazorpay, submitProof, type Deps, type PayResult, type PaymentView } from "./service";

function deps(): Deps {
  const e = process.env;
  return {
    reg: supabaseRegistrationRepository, pay: supabasePaymentRepository,
    razorpay: razorpayConfigured() ? { keyId: e.RAZORPAY_KEY_ID!, keySecret: e.RAZORPAY_KEY_SECRET!, webhookSecret: e.RAZORPAY_WEBHOOK_SECRET! } : null,
  };
}
async function limited(scope: string, limit: number) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return !(await rateLimitShared(`${scope}:${ip}`, limit, 10 * 60_000));
}
const creds = (reference: string, contact: string) => ({ reference, contact });
const fail = <T,>(error: "unavailable" | "unauthorized"): PayResult<T> => ({ ok: false, error });

export type PaymentViewWithQr = PaymentView & { qr: Record<string, string> };

export async function loadPaymentView(reference: string, contact: string): Promise<PayResult<{ view: PaymentViewWithQr }>> {
  if (await limited("payview", 30)) return fail("unauthorized");
  try {
    const r = await getPaymentView(creds(reference, contact), deps());
    if (!r.ok) return r;
    // QR codes generated from the configured UPI ID + exact amount (admin-uploaded QR images arrive with the dashboard).
    const qr: Record<string, string> = {};
    for (const m of r.view.methods) {
      if ((m.code === "upi" || m.code === "upi_qr") && m.config.upi_id)
        qr[m.code] = await upiQrDataUrl(buildUpiUri({ upiId: m.config.upi_id, payeeName: m.config.payee_name, amount: m.amount, currency: m.currency, note: reference }));
    }
    return { ok: true, view: { ...r.view, qr } };
  } catch { return fail("unavailable"); }
}

export async function selectPaymentMethod(reference: string, contact: string, method: string) {
  if (await limited("paysel", 20)) return fail<{ paymentId: string }>("unavailable");
  try { return await choosePayment(creds(reference, contact), method, deps()); } catch { return fail<{ paymentId: string }>("unavailable"); }
}

export async function submitPaymentProof(formData: FormData): Promise<PayResult<{ hasProof: boolean }>> {
  if (await limited("proof", 10)) return fail("unavailable");
  try {
    const file = formData.get("proof");
    const bytes = file instanceof File && file.size > 0 ? new Uint8Array(await file.arrayBuffer()) : null;
    const reference = String(formData.get("reference") ?? "");
    const result = await submitProof(creds(reference, String(formData.get("contact") ?? "")),
      String(formData.get("paymentId") ?? ""), String(formData.get("txnRef") ?? ""), bytes, deps());
    if (result.ok) { const id = await registrationIdByReference(reference.trim().toUpperCase()); if (id) await notify("payment_ack", id); }
    return result;
  } catch { return fail("unavailable"); }
}

export async function beginRazorpay(reference: string, contact: string, paymentId: string) {
  if (await limited("rzp", 10)) return fail<{ orderId: string; keyId: string; amount: number; currency: string }>("unavailable");
  try { return await startRazorpay(creds(reference, contact), paymentId, deps()); } catch { return fail<{ orderId: string; keyId: string; amount: number; currency: string }>("unavailable"); }
}

export async function finishRazorpay(reference: string, contact: string, orderId: string, paymentId: string, signature: string) {
  if (await limited("rzpv", 20)) return fail<object>("unavailable");
  try { return await confirmRazorpay(creds(reference, contact), { orderId, paymentId, signature }, deps()); } catch { return fail<object>("unavailable"); }
}
