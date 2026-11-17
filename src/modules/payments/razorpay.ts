import crypto from "node:crypto";

function safeEqualHex(a: string, b: string) {
  const x = Buffer.from(a, "utf8"); const y = Buffer.from(b, "utf8");
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
const hmac = (secret: string, data: string | Buffer) => crypto.createHmac("sha256", secret).update(data).digest("hex");

/** Checkout callback signature: HMAC_SHA256(order_id|payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, keySecret: string) {
  return safeEqualHex(hmac(keySecret, `${orderId}|${paymentId}`), signature);
}

/** Webhook signature over the RAW request body with the webhook secret. */
export function verifyWebhookSignature(rawBody: string | Buffer, signature: string, webhookSecret: string) {
  return safeEqualHex(hmac(webhookSecret, rawBody), signature);
}

export interface RazorpayOrder { id: string; amount: number; currency: string }

/** Server-side order creation (amount in the smallest currency unit). No SDK needed. */
export async function createOrder(o: { amount: number; currency: string; receipt: string; keyId: string; keySecret: string }, fetchImpl: typeof fetch = fetch): Promise<RazorpayOrder> {
  const res = await fetchImpl("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${o.keyId}:${o.keySecret}`).toString("base64")}` },
    body: JSON.stringify({ amount: Math.round(o.amount * 100), currency: o.currency, receipt: o.receipt.slice(0, 40) }),
  });
  if (!res.ok) throw new Error(`razorpay_order_failed_${res.status}`);
  return (await res.json()) as RazorpayOrder;
}
