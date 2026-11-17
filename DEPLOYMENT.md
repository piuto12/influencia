# DEPLOYMENT GUIDE — Vercel + Supabase

Status: **prepared, NOT deployed.** Nothing in this guide has been run against production. Every step marked 🔒 needs the owner's explicit approval (it creates accounts/resources, spends money, publishes the site, or changes production data).

## 0. Before you start — decisions for the owner
| Decision | Notes |
|---|---|
| **Vercel plan** | Vercel's free *Hobby* plan is for **non-commercial personal** use. A paid event-registration site is likely commercial → check Vercel's current terms; plan on *Pro*. Hobby also has short function limits. |
| **Supabase plan** | Free plan: **no automatic backups**, project **pauses after ~1 week of inactivity**, 500 MB database / 1 GB storage. For a paid event, a Pro project (daily backups, no pausing) is strongly recommended, at least from registration opening until after the event. |
| **Dev vs production project** | The existing project `influencia-dev` holds **fake test data** (a test registration, a test certificate). **Do not promote it.** Create a separate, empty production project. |
| **Domain** | Start on the free `*.vercel.app` URL; connect your own domain later (§9). No hostname is hard-coded anywhere (a test enforces it). |
| **Email** | Resend (free tier is fine for ≤ 200 participants) with a verified sender domain. |
| **Region** | `vercel.json` pins functions to Mumbai (`bom1`); create the Supabase project in `ap-south-1` (Mumbai) to match. |

## 1. Accounts (owner, one-time)
1. GitHub — create a **private** repository (e.g. `influencia`).
2. Vercel — sign in with GitHub.
3. Supabase — you already have an organization; a new project costs $0 on the free plan, or the Pro price if upgraded.
4. Resend — create an account (later: verify the sending domain, §7).

## 2. Put the code on GitHub 🔒
The folder is a git repository with **no commits yet**. `.env.local`, `.env*`, `/backups`, `/supabase/.bundle` are git-ignored; verify before the first push:
```bash
git add -A && git status --short          # eyeball the list: no .env.local, no backups, no keys
git ls-files | grep -iE "\.env|secret|backup|\.dump" || echo "clean"
git commit -m "Initial commit: Influencia platform"
git branch -M main
git remote add origin git@github.com:<you>/influencia.git
git push -u origin main
```
GitHub Actions (`.github/workflows/ci.yml`) then runs lint, typecheck, unit tests, build, HTTP smoke tests and the SQL suites on every push. CI uses placeholder values only — it never needs your real keys. *(The workflow has run once on GitHub and passed: app job and database job.)*

## 3. Create the production Supabase project 🔒
1. New project → region **ap-south-1**, strong database password (save it in a password manager).
2. **Schema:** SQL editor → paste the output of `npm run db:bundle` (file `supabase/.bundle/production-setup.sql`, runs all 16 migrations in one transaction) → Run.
   *Alternative:* `supabase link --project-ref <ref>` then `supabase db push`.
3. **Production seed:** run `supabase/production-seed.sql` (creates the Influencia event + Edition 3 as *upcoming*, registration **closed**, all payment methods **disabled**, no fake data).
4. **Authentication → Providers:** keep Email enabled; **disable "Allow new users to sign up"** (admins are created from the dashboard only).
5. **Authentication → Sign In / Providers → Password:** enable **leaked-password protection** (this setting may require the Pro plan); require a strong minimum length.
6. **Authentication → URL configuration:** *Site URL* = your production URL (e.g. `https://<project>.vercel.app`), add the same under *Redirect URLs*. Update when the custom domain is connected.
7. **Authentication → Multi-factor:** TOTP enabled (default).
8. **Storage:** confirm buckets `private-payment-proofs` (private) and `public-media` (public) exist (created by migrations).
9. **Create the first super admin:** Authentication → Users → *Add user* (Auto-confirm) → copy the UUID → SQL editor:
   ```sql
   insert into admin_users (auth_user_id, role_code, display_name) values ('<USER-UUID>', 'super_admin', 'Your Name');
   ```
10. Copy the keys: Project Settings → API → **Project URL**, **publishable** key, **secret** key (never paste secrets into chat or Git).

## 4. Environment variables (Vercel → Project → Settings → Environment Variables → *Production*)
| Variable | Value | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<your-host>` (no trailing slash/path) | no |
| `NEXT_PUBLIC_SUPABASE_URL` | production project URL | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key | no (public by design) |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** key | **yes** |
| `QR_SIGNING_SECRET` | `openssl rand -hex 32` (new value, not the dev one) | **yes** |
| `ADMIN_MFA` | `required` | no |
| `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM` | Resend key; `Influencia <no-reply@your-domain>` | key: **yes** |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | **optional**; test keys first | secrets: **yes** |

Validate before every deploy (prints problems, never values):
```bash
vercel env pull .env.production.local --environment=production   # or export the vars in your shell
node --env-file=.env.production.local scripts/check-env.mjs --production
rm .env.production.local
```
It fails on: missing/placeholder keys, publishable key used as the secret, `localhost`/`http` site URL, secrets with a `NEXT_PUBLIC_` prefix, half-configured Razorpay/email; and warns when `ADMIN_MFA` is not `required`.

## 5. Deploy to a temporary Vercel URL 🔒
```bash
npm i -g vercel
vercel login
vercel link            # create/link the project (framework: Next.js; Node 24.x from package.json)
vercel                 # preview deployment first; check it
vercel --prod          # production deployment (only after owner approval)
```
or import the GitHub repo in the Vercel dashboard (recommended: every push to `main` deploys, every PR gets a preview). Keep **Preview** deployments pointing at the *dev* Supabase project — never give previews production keys.

## 6. Post-deploy verification (run against the live URL)
```bash
curl -s https://<host>/api/health                       # {"status":"ok","db":"ok"}
E2E_BASE_URL=https://<host> npm run test:e2e            # 45 checks: pages, headers, admin gates, SEO, webhook, verification
```
Then by hand (checklist):
- [ ] Home page, `/register`, `/registration-status`, `/certificates/verify` load; no CSP errors in the browser console.
- [ ] `/admin` redirects to login; sign in as super admin; **enrol MFA** (`/admin/security`), sign out/in with the code.
- [ ] Admin → Event settings: set the **WhatsApp group link**, check dates/venue/capacity; Admin → Payment settings: enter the real **fee, UPI ID, bank details**, enable methods.
- [ ] Admin → Pages: publish **Privacy Policy** and **Terms** (required before registration opens).
- [ ] Admin → Event settings: switch **Registration open** only when everything above is done.
- [ ] Rehearsal registration with a test email → payment proof → verify → approve → status page shows QR → check-in. *(This leaves one test record; cancel it. Do the rehearsal before opening to the public and note the reference.)*
- [ ] Security headers: https://securityheaders.com on the URL; SSL labs is automatic on Vercel.
- [ ] Supabase Advisors (dashboard → Advisors) show no new critical items.

## 7. Email (Resend)
1. Resend → Domains → add your domain; add the DNS records (SPF, DKIM, optionally DMARC) at your DNS host; wait for "Verified".
2. Create an API key (sending access) → `EMAIL_PROVIDER_API_KEY`; `EMAIL_FROM` must use the verified domain.
3. Redeploy, then Admin → Participants → a test participant → **Send email**; check delivery, spam placement and Admin → Notifications log.
Until configured, emails are recorded as failed and WhatsApp click-to-chat links still work.

## 8. Razorpay (optional)
1. Razorpay dashboard → **Test mode** → create API keys; set the three env vars (test values), redeploy.
2. Webhooks → add `https://<host>/api/webhooks/razorpay`, active events `payment.captured` and `order.paid`, set a secret → `RAZORPAY_WEBHOOK_SECRET`.
3. Enable the Razorpay method in Admin → Payment settings; pay with Razorpay's **test** cards/UPI; confirm the registration moves to *under verification* and a repeated webhook delivery does nothing.
4. Only then, with the owner's written approval, swap to **live** keys (the check script warns about test keys in production and errors on live keys outside production).

## 9. Connect your own domain later 🔒
1. Vercel → Project → Domains → add the domain; create the DNS records Vercel shows.
2. Update `NEXT_PUBLIC_SITE_URL` (Production) → redeploy.
3. Supabase → Authentication → URL configuration: new Site URL and Redirect URL.
4. Resend: use a sender on the same domain; Razorpay: update the webhook URL.
5. Old certificates/QR codes keep working: certificate QR codes embed the URL printed at issue time — keep the old `*.vercel.app` URL alive (or add a redirect) for already-issued certificates.

## 10. Backups & monitoring
- Follow `docs/BACKUP_RESTORE.md`: first backup right after go-live; daily during registration; before event day; before every migration. Do one restore drill on a scratch project.
- Uptime: point a free monitor (UptimeRobot/Better Stack) at `/api/health` (503 = database unreachable).
- Errors: Vercel → Logs; optionally add Sentry later.

## 11. Rollback
- **Code:** Vercel → Deployments → previous deployment → *Promote to Production* (instant).
- **Database:** migrations are forward-only and non-destructive so far. Before any future migration take a backup, apply it on a scratch copy first, and keep a matching down-script in the pull request.
- **Leaked key:** rotate in Supabase/Razorpay/Resend, update Vercel env vars, redeploy, review `Admin → Audit log`.

## 12. Launch checklist (all must be ticked)
- [ ] Production project created; migrations + production seed applied; first super admin created; MFA enrolled; `ADMIN_MFA=required`.
- [ ] `check-env --production` passes; Preview environments use the dev project only.
- [ ] Privacy Policy + Terms published; real fee/UPI/bank details entered; WhatsApp group link set; capacity and dates confirmed with the organizer.
- [ ] Official logo and speaker photo added (`public/brand/speaker/rashid-gazzali.{webp,png}`); sponsor marks (Kaisan Associates, Tiara) approved or omitted.
- [ ] Email domain verified and a real test email received; Razorpay tested in test mode (or intentionally left off).
- [ ] Backup taken and restore drill done; plan chosen (Pro recommended) so the database does not pause.
- [ ] Rehearsal registration completed end-to-end and cleaned up.
- [ ] Owner gives explicit approval → **only then** open registration and publicise the URL.
