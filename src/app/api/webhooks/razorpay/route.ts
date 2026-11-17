import { NextResponse } from "next/server";
import { razorpayConfigured } from "@/lib/env";
import { supabasePaymentRepository } from "@/modules/payments/repository";
import { handleRazorpayWebhook } from "@/modules/payments/service";

export async function POST(req: Request) {
  if (!razorpayConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 404 });
  const raw = await req.text(); // raw body is required for signature verification
  const e = process.env;
  try {
    const outcome = await handleRazorpayWebhook(
      raw, req.headers.get("x-razorpay-signature") ?? "", req.headers.get("x-razorpay-event-id") ?? "",
      { pay: supabasePaymentRepository, razorpay: { keyId: e.RAZORPAY_KEY_ID!, keySecret: e.RAZORPAY_KEY_SECRET!, webhookSecret: e.RAZORPAY_WEBHOOK_SECRET! } },
    );
    if (outcome === "invalid_signature") return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
    return NextResponse.json({ ok: true, outcome });
  } catch {
    return NextResponse.json({ error: "retry" }, { status: 500 }); // non-2xx makes Razorpay retry
  }
}
