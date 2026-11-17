"use server";
import { headers } from "next/headers";
import { rateLimitShared } from "@/lib/rate-limit";
import { edition } from "@/modules/events/site-content";
import { supabaseRegistrationRepository as repo } from "./repository";
import { notify } from "@/modules/notifications/service";
import { registrationIdByReference } from "@/modules/notifications/lookup";
import { lookupStatus, registerParticipant, type RegisterResult, type StatusResult } from "./service";

async function clientKey(scope: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}

export type RegisterState = RegisterResult | null;

export async function submitRegistration(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  if (!(await rateLimitShared(await clientKey("register"), 5, 10 * 60_000))) return { ok: false, code: "unavailable" };
  const raw = Object.fromEntries(formData.entries());
  // Honeypot: pretend success so bots learn nothing.
  if (typeof raw.website === "string" && raw.website.length > 0) return { ok: true, reference: "INF3-000000" };
  try {
    const result = await registerParticipant(edition.code, raw, repo);
    if (result.ok) { const id = await registrationIdByReference(result.reference); if (id) await notify("registration_ack", id); }
    return result;
  } catch {
    return { ok: false, code: "unavailable" }; // e.g. Supabase not configured; never leak details
  }
}

export type StatusState = StatusResult | { error: "rate_limited" | "unavailable" } | null;

export async function checkStatus(_prev: StatusState, formData: FormData): Promise<StatusState> {
  if (!(await rateLimitShared(await clientKey("status"), 10, 10 * 60_000))) return { error: "rate_limited" };
  try {
    return await lookupStatus(Object.fromEntries(formData.entries()), repo);
  } catch {
    return { error: "unavailable" };
  }
}
