# SECURITY_PLAN — status after Phase 8

Legend: ✅ implemented and verified · 🟡 implemented, not fully verified or has a stated limit · ⬜ not done / needs the owner.
Verification evidence is listed in `IMPLEMENTATION_STATUS.md` (Phase 8 report). Production has **not** been deployed; items marked 🟡/⬜ must be closed or accepted before launch.

## Secrets
- ✅ `.env.local` is git-ignored; `.env.example` has placeholders only (tests enforce both).
- ✅ Server-only variables are never `NEXT_PUBLIC_*`; the service-role key is referenced only by `lib/env.ts` and `lib/supabase/admin.ts` (test); client components cannot import server modules (test); admin client uses `server-only`.
- ✅ No hard-coded keys/tokens in source (pattern test + manual scan).
- ⬜ Pre-commit/CI secret scanner (gitleaks) — recommended when the GitHub repo is created.
- ✅ Razorpay: test keys only in development; no real payment credentials used anywhere.
- ⬜ Rotate the Supabase keys if they were ever exposed in screenshots, logs or chat (none known).

## Authentication / authorization
- ✅ Supabase Auth for admins only; public visitors never get accounts. Admin sign-up is not exposed; super admin creates admins.
- ✅ Permission matrix (3 roles) enforced in: proxy (anonymous bounce), every page/layout (`requirePageAccess`), every server action and route handler (`requirePermission`), and database RLS. A test scans every exported server action and fails if one lacks a permission check or an explicit "public + rate-limited" declaration.
- ✅ **TOTP two-step verification** (`ADMIN_MFA=off|optional|required`; default `optional`: enrolled admins must pass it; `required`: super/finance admins must enrol). Decision logic unit-tested; **enrol → sign out → sign in with code verified end-to-end by the owner on 2026-11-16** (dev project). ⬜ Set `ADMIN_MFA=required` in the production environment before launch.
- ⬜ Enable **leaked-password protection** in Supabase Auth settings (dashboard toggle; Supabase advisor flags it). Choose strong admin passwords (≥ 12 chars enforced for admins created in the app).
- ✅ Session cookies via `@supabase/ssr`; admin responses `Cache-Control: no-store`.

## Data protection
- ✅ RLS on all 32 public tables (structural SQL test); anonymous users hold no privileges on sensitive tables; ledgers/audit/history are append-only (trigger + revoked grants); security-definer functions are service-role only (SQL test), RLS helpers live in the unexposed `private` schema.
- ✅ Payment proofs in a private bucket; viewed only through 60-second signed URLs, each view audited. Certificates are generated on demand (no stored PDFs).
- ✅ Status lookup needs reference + matching email/phone, identical "not found" for every failure; the WhatsApp group link is released only to confirmed participants and never appears in public HTML (e2e test).
- ✅ QR tokens carry no personal data and are HMAC-signed; certificate IDs are ~79-bit random; certificate verification reveals only what is printed on the certificate.
- 🟡 Privacy Policy / Terms: editable CMS pages exist but **the legal text has not been written** — must be published before registration opens (DPDP Act 2023 awareness; consent timestamp is recorded).
- ⬜ Data-retention / deletion process for participant data after the event (policy decision for the organizer).

## Input / output
- ✅ Zod validation on every server action; all DB access via the Supabase client or parameterised SQL functions.
- ✅ Markdown never renders raw HTML (XSS tests); no `dangerouslySetInnerHTML` except the audited JSON-LD component (test-enforced); URLs for CTA/nav/social/video are allow-listed.
- ✅ Uploads: payment proofs validated by magic bytes (≤ 5 MB, JPG/PNG/WebP/PDF); media uploads limited by type/size at the bucket (no SVG), server-generated object names, one-time signed upload URLs after a permission check.
- ✅ CSV exports neutralise formula injection.

## Web hardening
- ✅ Headers (verified on a production build): CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP, no `X-Powered-By`.
- 🟡 CSP keeps `script-src 'unsafe-inline'` (Next.js inline bootstrap scripts; a nonce policy would force fully dynamic rendering). Everything else is allow-listed (`object-src 'none'`, `frame-ancestors 'self'`, `base-uri 'self'`). No violations seen on home/register/login; **YouTube/Vimeo/Razorpay embeds were not exercised under the CSP** (no content/keys yet) — test them once real content exists.
- ✅ CSRF: server actions enforce same-origin; SameSite cookies; the webhook is authenticated by HMAC signature, not cookies.
- ✅ Rate limiting is **shared across instances** (Postgres `rate_limit_hit`) on login, MFA, registration, status lookup, payment steps, certificate verification and QR scans; falls back to in-memory if the database is unreachable. Honeypot on registration.
- ⬜ CAPTCHA (e.g. Cloudflare Turnstile) is not added; add if bot registrations appear.

## Payments
- ✅ Client "success" is never trusted; Razorpay signature + raw-body webhook HMAC verified server-side, idempotent; amounts recomputed from stored settings; fee snapshot per payment; ledger immutable; no card data touched.
- 🟡 Razorpay has never been run against the real API (no keys). Test with Razorpay **test** keys before enabling.

## Integrity
- ✅ Capacity enforced by a row-locked transaction plus a trigger (parallel-approval test: 6 concurrent approvals → 1 seat); check-in idempotent; certificate issue idempotent; revoke/undo need reasons and are audited.

## Audit and operations
- ✅ `audit_logs` records logins, MFA events, approvals, verification/rejection/refunds, settings, CMS changes, exports, attendance corrections, certificate issue/revoke/download (viewable at Admin → Audit log).
- ✅ Errors: generic messages to users; no stack traces (e2e 404 test).
- ✅ Dependencies: `npm audit --omit=dev` → 0 vulnerabilities. 7 moderate findings remain in the **dev-only** ESLint toolchain (minimatch DoS in `typescript-eslint`); not shipped to users.
- ✅ Backups: `scripts/backup.sh` (pg_dump + storage export) and `docs/BACKUP_RESTORE.md`. ⬜ **Not yet run against the real database** (needs the DB connection string) and the free Supabase plan has **no automatic backups** — schedule the script or upgrade before launch; do a restore drill.
- 🟡 Uptime: `GET /api/health` (ok/degraded, no details) is ready for a free monitor; error tracking (e.g. Sentry) not added.

## Approval gates (human required)
Production deploy · production DB migration · destructive migrations/deletions · enabling live payment keys · connecting a custom domain · sending real emails to participants · turning on `ADMIN_MFA=required`.
