import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve(import.meta.dirname, "../scripts/check-env.mjs");
const GOOD = {
  NEXT_PUBLIC_SITE_URL: "https://influencia.example.test", NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghij.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_xxxxxxxx", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_yyyyyyyy", QR_SIGNING_SECRET: "q".repeat(40), ADMIN_MFA: "required",
};
const run = (env: Record<string, string>, args: string[] = ["--production"]) =>
  spawnSync("node", [script, ...args], { env: { PATH: process.env.PATH ?? "", ...env } as unknown as NodeJS.ProcessEnv, encoding: "utf8" });

describe("scripts/check-env.mjs", () => {
  it("passes a complete production configuration", () => { const r = run(GOOD); expect(r.status).toBe(0); expect(r.stdout).toContain("No blocking problems"); });
  it("fails on missing required variables", () => { const { QR_SIGNING_SECRET: _q, ...rest } = GOOD; void _q; const r = run(rest); expect(r.status).toBe(1); expect(r.stdout).toContain("QR_SIGNING_SECRET is missing"); });
  it("fails if the secret key is the public key, or the site URL is localhost/http in production", () => {
    expect(run({ ...GOOD, SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_zzzz" }).status).toBe(1);
    expect(run({ ...GOOD, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }).status).toBe(1);
    expect(run({ ...GOOD, NEXT_PUBLIC_SITE_URL: "https://x.test/path/" }).status).toBe(1);
  });
  it("flags secrets exposed with a NEXT_PUBLIC_ prefix and half-configured Razorpay / email", () => {
    expect(run({ ...GOOD, NEXT_PUBLIC_SERVICE_KEY: "oops" }).status).toBe(1);
    expect(run({ ...GOOD, RAZORPAY_KEY_ID: "rzp_test_a" }).status).toBe(1);
    expect(run({ ...GOOD, EMAIL_PROVIDER_API_KEY: "k" }).status).toBe(1);
  });
  it("warns (does not fail) about test Razorpay keys and non-required MFA in production", () => {
    const r = run({ ...GOOD, ADMIN_MFA: "optional", RAZORPAY_KEY_ID: "rzp_test_a", RAZORPAY_KEY_SECRET: "s", RAZORPAY_WEBHOOK_SECRET: "w" });
    expect(r.status).toBe(0); expect(r.stdout).toMatch(/TEST key/); expect(r.stdout).toMatch(/ADMIN_MFA=optional/);
  });
  it("never prints secret values", () => { const r = run({ ...GOOD, RAZORPAY_KEY_ID: "rzp_test_SENTINEL", RAZORPAY_KEY_SECRET: "SECRET-SENTINEL", RAZORPAY_WEBHOOK_SECRET: "WH-SENTINEL" }); expect(r.stdout + r.stderr).not.toMatch(/SENTINEL|sb_secret_yyyy|q{10}/); });
  it("accepts localhost in development rules", () => { expect(run({ ...GOOD, NEXT_PUBLIC_SITE_URL: "http://localhost:3000", ADMIN_MFA: "optional" }, []).status).toBe(0); });
});
