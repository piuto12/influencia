import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Liveness + database reachability for post-deploy checks and uptime monitors. Reveals nothing but ok/degraded. */
export async function GET() {
  let db = false;
  try { const { error } = await createAdminClient().from("events").select("id", { head: true, count: "exact" }).limit(1); db = !error; } catch { db = false; }
  return NextResponse.json({ status: db ? "ok" : "degraded", db: db ? "ok" : "unreachable" }, { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
