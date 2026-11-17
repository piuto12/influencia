# DEVELOPMENT_ROADMAP

Each phase ends with: features, files created/modified, DB changes, tests run + results, remaining issues, next phase — and a pause for your review.

| Phase | Scope | Exit criteria |
|---|---|---|
| 0 | Inspection, plan, 5 docs (**this**) | You approve architecture |
| 1 Foundation | Next.js + TS + Tailwind, tokens from poster, fonts, Supabase clients, `env.ts`, migrations 0001–0008 with RLS, seed (dev only), lint/typecheck/test tooling, README | Build green; RLS tests pass |
| 2 Visual site | Layout, nav, hero + motion system, all homepage sections, static public pages, responsive, reduced-motion fallbacks | Lighthouse mobile ≥ 85; visual match to poster |
| 3 Registration | Form, Zod, `register_for_edition`, references, duplicates, capacity, deadline, status page | Concurrency + validation tests pass |
| 4 Payments | Method config, UPI/QR/bank/offline flows, proof upload, verification, optional Razorpay, webhooks | Works with Razorpay unconfigured |
| 5 Admin | Auth, RBAC, participants, payments, reports, audit logs, exports | Role tests pass |
| 6 CMS | Section manager, videos, testimonials, galleries, editions, blog, social | Non-developer can edit homepage |
| 7 Event ops | Notifications, QR check-in, certificates, verification page | End-to-end dry run |
| 8 Testing & security | Full suites, security review, mobile + perf pass | Checklist complete |
| 9 Deployment | Vercel, Supabase prod, temp domain, email, prod verification | **Only after your approval** |

## Timeline risk notes
- Event is 19 Dec 2026; today is 16 Nov 2026 — ~5 weeks. Recommend prioritising phases 1→3→4→5 (registration + payment + admin) ahead of full CMS/animation polish, with a minimal public page live early. Confirm priority at approval.
- Supabase free tier: 1 GB storage, no automatic backups, projects pause after inactivity — plan a manual backup routine and a paid-plan decision before launch.

## Blocking / missing items (see chat summary for commands)
1. **Poster missing**: `public/brand/reference/influencia-edition3-poster.jpeg` does not exist (folder was empty). Colours remain unverified initial values. Also need the official logo and speaker photograph.
2. Supabase account/project (you create; I never handle your password).
3. Optional now, needed by Phase 9: Vercel account, GitHub repo, email provider account.
4. Optional: Docker Desktop + Supabase CLI for local DB.
