# Influencia — Event & Training Management Platform

Next.js (App Router) · TypeScript · Tailwind · Supabase · Vercel.
**Deploying? Start with `DEPLOYMENT.md`** (Vercel + Supabase, env vars, go-live checklist). Read `ARCHITECTURE.md`, `DATABASE_DESIGN.md`, `SECURITY_PLAN.md`, `DEVELOPMENT_ROADMAP.md`, `IMPLEMENTATION_STATUS.md`.

## Setup
```bash
npm install
cp .env.example .env.local   # fill in Supabase values; never commit
npm run dev
```

## Scripts
`npm run lint` · `npm run typecheck` · `npm test` · `npm run build`

## Database
SQL migrations live in `supabase/migrations` (apply in order, via Supabase CLI `supabase db push` or the SQL editor on a **non-production** project first).
`supabase/tests/db_smoke.sql` verifies registration, capacity, duplicate prevention and RLS on a scratch database.

## Rules
No secrets in Git. Production deploys and destructive DB changes need explicit human approval.

## Payments
Methods and fees are configured per edition in `payment_settings` (admin UI arrives in Phase 5); until then insert/update rows by SQL.
UPI/bank/venue need no gateway. Razorpay appears only when `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are set (use **test** keys in development).
Razorpay webhook URL: `<NEXT_PUBLIC_SITE_URL>/api/webhooks/razorpay` (events: `payment.captured`, `order.paid`).
`supabase/tests/payments_smoke.sql` exercises the payment state machine on a scratch database.

## Admin dashboard (`/admin`)
Sign-in uses Supabase Auth (email + password). Admin access = an active row in `admin_users`.
**Create the first super admin** (once, on a non-production project first):
1. Supabase dashboard → Authentication → Users → *Add user* (tick *Auto confirm*), copy the user's UUID.
2. In the SQL editor:
```sql
insert into admin_users (auth_user_id, role_code, display_name)
values ('<USER-UUID>', 'super_admin', 'Your Name');
```
Further admins are created from **Administrators** in the dashboard (super admin only). Exports are CSV (UTF-8 with BOM; opens in Excel).

## Email, attendance & certificates (Phase 7)
- **Email** uses the Resend REST API. Set `EMAIL_PROVIDER_API_KEY` and `EMAIL_FROM` (a verified sender) on the server. Without them nothing breaks: each attempt is recorded as failed (`email_not_configured`) in Admin → Notifications, and WhatsApp click-to-chat links on each participant page still work. Templates are editable in the admin; `{{group_link}}` is only filled for confirmed participants.
- **Check-in**: confirmed participants get a personal QR on their Registration Status page (HMAC-signed with `QR_SIGNING_SECRET`; contains no personal data). Admin → Attendance accepts USB scanners, camera scanning (Chrome/Edge `BarcodeDetector`) and manual search. Duplicate scans never create a second check-in; removing one needs a reason and is audit-logged.
- **Certificates**: eligibility = confirmed AND checked in (per-edition rule `attendance_rule.require_check_in`). Template, bulk issue, individual/bulk PDF, revoke, and a public verification page at `/certificates/verify/<ID>`. PDFs use built-in Latin fonts; names in other scripts print as `?` (the admin sees a warning and should enter a Latin spelling).

## Testing & security checks
| Command | What it runs |
|---|---|
| `npm run lint` · `npm run typecheck` | ESLint · `next typegen` + `tsc` |
| `npm test` | Vitest unit/service/guard tests (validation, payments, RBAC, CMS, ops, security guards) |
| `PATH=/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH bash supabase/tests/run.sh` | SQL suites on **fresh throwaway local databases**: registration/capacity, payment state machine, attendance/certificates, structural RLS matrix |
| `npm run build && npm start`, then `E2E_BASE_URL=http://localhost:3000 npm run test:e2e` | HTTP smoke tests against a running production build (pages, headers, admin gates, SEO, webhook, certificate verification) |
| `bash scripts/backup.sh` | Database + storage backup (see `docs/BACKUP_RESTORE.md`) |

Two-step verification for admins: `ADMIN_MFA=off|optional|required` (see `SECURITY_PLAN.md`). Enrol at `/admin/security`.

## Deployment helpers
`npm run check:env` (validate environment before deploy; add `--production` for production rules) · `npm run db:bundle` (all migrations in one SQL file for a new project) · `supabase/production-seed.sql` (real config only, registration closed) · `GET /api/health` (liveness + DB) · `.github/workflows/ci.yml` (lint, typecheck, tests, build, smoke, SQL suites) · `vercel.json` (Mumbai region).
