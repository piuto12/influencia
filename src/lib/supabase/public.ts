import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/** Anonymous, cookie-free client for published public content (RLS decides what is visible). Safe inside "use cache". */
export function createPublicClient() {
  const env = publicEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
