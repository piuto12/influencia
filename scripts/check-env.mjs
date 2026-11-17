// Validates environment configuration BEFORE deploying. Reads process.env (use: node --env-file=.env.production.local scripts/check-env.mjs, or run in Vercel's build).
// Prints problems; exits 1 on any ERROR. Never prints secret values.
const env = process.env;
const production = (process.argv.includes("--production")) || env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
const errors = [], warnings = [], ok = [];
const must = (name, test, msg) => { const v = env[name]; if (!v) errors.push(`${name} is missing`); else if (test && !test(v)) errors.push(`${name}: ${msg}`); else ok.push(name); };
const should = (name, msg) => { if (!env[name]) warnings.push(`${name} not set — ${msg}`); else ok.push(name); };

must("NEXT_PUBLIC_SITE_URL", (v) => /^https:\/\/[^/\s]+$/.test(v) || (!production && /^http:\/\/localhost(:\d+)?$/.test(v)), production ? "must be the https public URL without a trailing slash or path" : "must be a URL");
if (production && /localhost|127\.0\.0\.1/.test(env.NEXT_PUBLIC_SITE_URL ?? "")) errors.push("NEXT_PUBLIC_SITE_URL points at localhost");
must("NEXT_PUBLIC_SUPABASE_URL", (v) => /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(v), "must look like https://<ref>.supabase.co");
must("NEXT_PUBLIC_SUPABASE_ANON_KEY", (v) => /^(sb_publishable_|eyJ)/.test(v), "must be the PUBLISHABLE/anon key");
must("SUPABASE_SERVICE_ROLE_KEY", (v) => /^(sb_secret_|eyJ)/.test(v) && !v.startsWith("sb_publishable_"), "must be the SECRET/service_role key (not the publishable one)");
if (env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_SERVICE_ROLE_KEY === env.NEXT_PUBLIC_SUPABASE_ANON_KEY) errors.push("SUPABASE_SERVICE_ROLE_KEY equals the public key");
must("QR_SIGNING_SECRET", (v) => v.length >= 32, "must be at least 32 characters (openssl rand -hex 32)");

for (const k of Object.keys(env)) if (/^NEXT_PUBLIC_.*(SECRET|SERVICE|PASSWORD|PRIVATE)/i.test(k)) errors.push(`${k} is exposed to the browser (NEXT_PUBLIC_ prefix on a secret)`);

const rz = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"];
const rzSet = rz.filter((k) => env[k]);
if (rzSet.length && rzSet.length < 3) errors.push(`Razorpay is half-configured (${rzSet.join(", ")} set; need all three or none)`);
if (rzSet.length === 3) {
  if (production && /^rzp_test_/.test(env.RAZORPAY_KEY_ID)) warnings.push("RAZORPAY_KEY_ID is a TEST key on a production deploy (fine for a rehearsal, wrong for real payments)");
  if (!production && /^rzp_live_/.test(env.RAZORPAY_KEY_ID)) errors.push("RAZORPAY_KEY_ID is a LIVE key in a non-production environment");
} else warnings.push("Razorpay not configured — UPI/bank/venue payments still work");

should("EMAIL_PROVIDER_API_KEY", "no emails will be delivered (they are logged as failed)"); should("EMAIL_FROM", "needed with EMAIL_PROVIDER_API_KEY, e.g. Influencia <no-reply@your-domain>");
if (!!env.EMAIL_PROVIDER_API_KEY !== !!env.EMAIL_FROM) errors.push("EMAIL_PROVIDER_API_KEY and EMAIL_FROM must be set together");

const mfa = env.ADMIN_MFA ?? "optional";
if (!["off", "optional", "required"].includes(mfa)) errors.push(`ADMIN_MFA must be off|optional|required (got "${mfa}")`);
else if (production && mfa !== "required") warnings.push(`ADMIN_MFA=${mfa} — set "required" for production so super/finance admins must use two-step verification`);

console.log(`Environment check (${production ? "PRODUCTION" : "development"} rules)`);
if (ok.length) console.log("  ok:       " + ok.join(", "));
for (const w of warnings) console.log("  warning:  " + w);
for (const e of errors) console.log("  ERROR:    " + e);
console.log(errors.length ? `\n${errors.length} error(s) — fix before deploying.` : "\nNo blocking problems.");
process.exit(errors.length ? 1 : 0);
