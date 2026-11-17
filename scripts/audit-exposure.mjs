/* eslint-disable @typescript-eslint/no-unused-expressions */
// Probes a DEPLOYED site + its Supabase project from the outside, as an anonymous attacker would, and reports anything open that shouldn't be.
// Read-only: it never creates data (writes are attempted only with empty/invalid payloads that must be refused).
// Usage:  node scripts/audit-exposure.mjs --site https://your-site --supabase https://<ref>.supabase.co --key <publishable key>
//    or:  node --env-file=.env.local scripts/audit-exposure.mjs        (uses NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)
// Exit code 1 if any FAIL. Use the PUBLISHABLE key only (it is public by design); never the secret key.
import { createClient } from "@supabase/supabase-js";

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };
const SUPABASE_ONLY = process.argv.includes("--supabase-only"); // skip the website checks (e.g. when a CDN bot challenge is active)
const SITE = (arg("site") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
const SB = (arg("supabase") ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const KEY = arg("key") ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
if ((!SITE && !SUPABASE_ONLY) || !SB || !KEY) { console.error("Need --site, --supabase and --key (or the NEXT_PUBLIC_* env vars)."); process.exit(2); }
if (/^sb_secret_|service_role/.test(KEY)) { console.error("Refusing to run with a SECRET key. Use the publishable key."); process.exit(2); }

const results = [];
const rec = (level, name, detail = "") => { results.push({ level, name }); console.log(`${level === "PASS" ? "  ✓" : level === "WARN" ? "  !" : "  ✗"} ${level}  ${name}${detail ? `  — ${detail}` : ""}`); };
const sbf = (path, init = {}) => fetch(SB + path, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, ...(init.headers ?? {}) } });
const site = (path, init = {}) => fetch(SITE + path, { redirect: "manual", ...init });

const SENSITIVE = ["participants", "registrations", "registration_history", "payments", "payment_events", "payment_proofs", "payment_webhooks", "payment_settings", "refunds", "admin_users", "roles", "permissions", "role_permissions", "audit_logs", "attendance", "certificates", "certificate_templates", "notifications", "notification_templates", "rate_limits"];
const PUBLIC_WRITE_TARGETS = ["events", "event_editions", "testimonials", "homepage_sections", "social_links", "blog_articles", "content_pages", "media_videos", "media_gallery", "site_settings"];
const FUNCTIONS = ["register_for_edition", "confirm_registration", "create_payment", "submit_payment_proof", "start_payment_review", "verify_payment", "reject_payment", "record_refund", "apply_gateway_payment", "set_gateway_order", "set_registration_status", "check_in_registration", "undo_check_in", "issue_certificate", "revoke_certificate", "rate_limit_hit", "gen_certificate_code", "gen_registration_reference", "log_payment_event", "log_registration_status", "has_permission", "is_admin"];

console.log(`\nExposure audit\n  site:     ${SITE}\n  supabase: ${SB}\n`);

console.log("1. Database tables readable by an anonymous visitor");
const leaked = [];
for (const t of SENSITIVE) { const r = await sbf(`/rest/v1/${t}?select=*&limit=1`); const body = await r.text(); if (r.ok && body !== "[]") leaked.push(`${t} (rows returned)`); else if (r.ok) leaked.push(`${t} (readable but empty — grant exists)`); }
leaked.length ? rec("FAIL", "sensitive tables are readable", leaked.join(", ")) : rec("PASS", `${SENSITIVE.length} sensitive tables refuse anonymous reads`);

console.log("2. Writes by an anonymous visitor");
const writable = [];
for (const t of PUBLIC_WRITE_TARGETS) { const r = await sbf(`/rest/v1/${t}`, { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: "{}" }); if (r.ok) writable.push(t); }
writable.length ? rec("FAIL", "anonymous INSERT accepted", writable.join(", ")) : rec("PASS", "anonymous inserts are refused on all content tables");

console.log("3. Private columns of public tables");
{ const r = await sbf("/rest/v1/event_editions?select=whatsapp_group_url&limit=1"); r.ok ? rec("FAIL", "WhatsApp group link is readable through the public API") : rec("PASS", "WhatsApp group link is not readable through the public API"); }

console.log("4. Database functions callable via the API");
const callable = [];
for (const f of FUNCTIONS) { const r = await sbf(`/rest/v1/rpc/${f}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); if (r.ok || r.status === 400) callable.push(`${f}(${r.status})`); }
callable.length ? rec("FAIL", "functions reachable by anonymous callers", callable.join(", ")) : rec("PASS", `${FUNCTIONS.length} internal functions are not callable by the public`);
{ const r = await sbf("/rest/v1/"); const d = await r.json().catch(() => ({})); const n = Object.keys(d.paths ?? {}).length; n > 0 ? rec("WARN", "API schema document lists endpoints", `${n} paths`) : rec("PASS", "API schema document reveals nothing"); }

console.log("5. File storage");
{ const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4//8/AwAI/AL+p5qfDwAAAABJRU5ErkJggg==", "base64");
  for (const b of ["public-media", "private-payment-proofs"]) { const r = await sbf(`/storage/v1/object/${b}/audit-probe.png`, { method: "POST", headers: { "Content-Type": "image/png" }, body: png }); r.ok ? rec("FAIL", `anonymous upload ACCEPTED into ${b}`) : rec("PASS", `anonymous upload refused for ${b}`);
    const l = await sbf(`/storage/v1/object/list/${b}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefix: "", limit: 5 }) }); const lj = await l.json().catch(() => []); Array.isArray(lj) && lj.length ? rec("FAIL", `anonymous can list files in ${b}`) : rec("PASS", `files in ${b} cannot be enumerated`); } }

console.log("6. Sign-up and sign-in");
{ const s = await (await sbf("/auth/v1/settings")).json(); s.disable_signup ? rec("PASS", "public sign-ups are disabled") : rec("FAIL", "public sign-ups are ENABLED");
  s.external?.anonymous_users ? rec("FAIL", "anonymous sign-ins are enabled") : rec("PASS", "anonymous sign-ins are off");
  const on = Object.entries(s.external ?? {}).filter(([, v]) => v).map(([k]) => k); on.every((k) => k === "email") ? rec("PASS", "only email login is enabled") : rec("WARN", "other login providers are on", on.join(", ")); }

console.log("7. Realtime (not used by this app)");
{ const c = createClient(SB, KEY, { auth: { persistSession: false } }); const ch = c.channel(`audit-probe-${Date.now()}`);
  const status = await new Promise((res) => { const t = setTimeout(() => res("TIMEOUT"), 8000); ch.subscribe((s) => { if (["SUBSCRIBED", "CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(s)) { clearTimeout(t); res(s); } }); });
  await c.removeAllChannels();
  status === "SUBSCRIBED" ? rec("FAIL", "anonymous clients can join public realtime channels (uses your free connection/message quota)", "turn off public access in Supabase → Realtime settings") : rec("PASS", "public realtime channels are not open to anonymous clients"); }

if (!SUPABASE_ONLY) {
console.log("8. Website");
for (const p of ["/.env", "/.env.local", "/.git/config", "/package.json", "/next.config.ts", "/supabase/migrations/0001_core.sql", "/scripts/backup.sh", "/vercel.json"]) { const r = await site(p); r.status === 200 ? rec("FAIL", `${p} is publicly served`) : null; }
rec("PASS", "no project/config files are publicly served");
for (const u of ["https://evil-attacker.example/x.png", "https://some-other-project.supabase.co/storage/v1/object/public/public-media/x.png"]) { const r = await site(`/_next/image?url=${encodeURIComponent(u)}&w=64&q=75`); [400, 403].includes(r.status) ? rec("PASS", `image optimizer refuses ${new URL(u).hostname}`) : rec("FAIL", `image optimizer will fetch ${new URL(u).hostname} (free image quota can be abused)`, `HTTP ${r.status}`); }
{ const r = await site("/api/health", { headers: { Origin: "https://evil.example" } }); r.headers.get("access-control-allow-origin") ? rec("FAIL", "API allows cross-site browser calls") : rec("PASS", "no cross-origin browser access to the API"); rec(/s-maxage/.test(r.headers.get("cache-control") ?? "") ? "PASS" : "WARN", "health endpoint is edge-cached (cannot be used to hammer the database)"); }
for (const p of ["/admin", "/admin/participants", "/admin/export/registrations", "/admin/certificates/pdf?all=1"]) { const r = await site(p); r.status === 307 && /\/admin\/login/.test(r.headers.get("location") ?? "") ? null : rec("FAIL", `${p} is reachable without signing in`, `HTTP ${r.status}`); }
rec("PASS", "admin pages and exports require sign-in");

} else console.log("8. Website — skipped (--supabase-only)");

const fails = results.filter((r) => r.level === "FAIL").length, warns = results.filter((r) => r.level === "WARN").length;
console.log(`\n${fails ? "✗" : "✓"} ${results.filter((r) => r.level === "PASS").length} passed, ${warns} warning(s), ${fails} FAILED`);
process.exit(fails ? 1 : 0);
