# ARCHITECTURE — Influencia Event & Training Management Platform

Status: **PROPOSAL — awaiting approval.** No application code exists yet.

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router), TypeScript strict | Server Components by default; Client Components only for interactivity |
| Styling | Tailwind CSS + CSS design tokens (`src/styles/tokens.css`) | Tokens are the single source of brand colours/fonts |
| Animation | Motion for React (primary), GSAP + ScrollTrigger (selective, lazy-loaded), SVG, CSS | Three.js and Lottie only if a specific element justifies the weight; both dynamically imported |
| Data/Auth/Storage | Supabase (PostgreSQL, Auth, Storage) | RLS on every table; service-role key server-only |
| Validation | Zod schemas shared by forms and server actions | |
| Email | Resend or SMTP via Nodemailer (provider behind an interface) | Free tier first; chosen at deployment |
| PDF | `pdf-lib` or `@react-pdf/renderer` (server) | Certificates; QR via `qrcode` |
| Payments | Provider interface; adapters: manual-UPI, bank, offline, Razorpay | Razorpay optional |
| Tests | Vitest (unit/service), Playwright (e2e), pgTAP or SQL tests for RLS/capacity | |
| Hosting | Vercel (free subdomain first) | Custom domain later via env only |

Package name must be lowercase (`influencia`); the folder name `INFLUENCIA` is fine.

## 2. Layering (business logic never lives in components)

```
src/
  app/                     routes only: (public), (admin)/admin, api/
  components/
    ui/                    primitives (Button, Input, Dialog…)
    motion/                reusable motion system (Reveal, TextReveal, CircleField, Countdown…)
    public/  admin/        feature components
  modules/                 one folder per domain; each has:
    registration/ payments/ events/ content/ media/ attendance/
    certificates/ notifications/ reports/ auth/ audit/
      schemas.ts           Zod
      service.ts           business logic (pure, DB via repository)
      repository.ts        Supabase queries
      actions.ts           server actions (thin: authz → validate → service)
  lib/
    supabase/ (browser, server, admin clients)   env.ts   rbac.ts   rate-limit.ts   sanitize.ts
  styles/tokens.css
supabase/migrations/       SQL migrations (source of truth for schema + RLS)
supabase/seed.sql          dev-only fictional data
tests/
```

Rules: components call actions/services, never raw SQL; services never import React; all env access goes through `lib/env.ts` (validated, typed); no hostnames hardcoded — `NEXT_PUBLIC_SITE_URL` drives every absolute URL.

## 3. Multi-edition model

`events` (the Influencia series) → `event_editions` (Edition 1…n). Every edition-scoped table carries `edition_id`: registrations, payment settings, fees, capacity, galleries, videos, testimonials, attendance, certificates, homepage sections. Participants are edition-independent (`participants` ↔ `registrations` per edition). The public site resolves the "active" edition from DB (`status`, `is_featured`), never from code. Edition lifecycle: `draft → upcoming → active → completed → archived`.

## 4. Registration & seat allocation

- Public form → server action → Zod validation → rate limit → `register_for_edition()` Postgres function (single transaction).
- Reference format `INF3-XXXXXX` (edition code + non-sequential base32 random, collision-checked with a unique constraint).
- Duplicate prevention: unique `(edition_id, participant_id)`; participant identity matched on normalised email + mobile.
- **Capacity**: only `confirmed` counts. Confirmation happens in `confirm_registration()` which locks the edition row (`SELECT … FOR UPDATE`), counts confirmed, and either confirms or (if waitlist enabled) waitlists. A DB constraint trigger is a second line of defence.
- Registration status and payment status are separate columns/tables; status changes append to `registration_history`.
- Status lookup: reference + email/mobile, rate-limited, returns minimal fields. The WhatsApp group link is shown only when status = `confirmed`.

## 5. Payment engine

```
PaymentProvider { id; createIntent(); verify(); handleWebhook(); }
```
Methods are rows in `payment_methods` with per-edition config in `payment_settings` (enabled, UPI ID, QR asset, bank details, instructions, deadline, verification mode). Fees are **snapshotted** onto each payment at creation (amount, currency, discount, fee version). Transactions are append-only (`payment_events`, enforced by RLS + no UPDATE/DELETE grants). Razorpay: server-created orders, HMAC signature verification on callback and webhook, webhook idempotency via unique `(provider, event_id)`. Client "success" is never trusted. No card data touches our servers. App works with zero Razorpay config.

## 6. Auth & RBAC

Supabase Auth (email+password, optional TOTP for admins). `admin_users` links `auth.users` to a role: `super_admin`, `registration_admin`, `finance_admin`. A `permissions` matrix (role → permission strings) is the single source for both the server guard (`requirePermission()`) and RLS helper `has_permission(text)`. Every admin mutation: authz check → action → `audit_logs` row (actor, action, entity, before/after, IP).

## 7. CMS

`homepage_sections` (type, edition_id, order, published, JSON content validated per section-type Zod schema), `content_pages`, `blog_articles`, `social_links`, nav stored in settings. Reusable section-type registry maps type → renderer + editor form. Rich text stored as sanitized Markdown/HTML (allow-list sanitizer on write and render).

## 8. Media

Supabase Storage buckets: `public-media` (gallery, thumbnails, testimonial photos, QR), `private-payment-proofs` (private, signed URLs ≤ 60 s, admin-only), `certificates` (private). Upload validation: MIME sniffing, size caps, extension allow-list, randomised object names. Videos: YouTube/Vimeo embeds via privacy-enhanced, lazy click-to-load facade; uploaded video lives in object storage only. Free-tier storage limits are a known constraint (see roadmap risks).

## 9. Attendance & certificates

Per-registration signed QR token (HMAC of registration id + edition id, no PII). Check-in is an idempotent DB function with a unique `(registration_id)` per session. Corrections are audit-logged. Certificates issued only to registrations meeting the edition's attendance rule; unique certificate ID; public `/certificates/verify/[id]` returns name, event, date, validity only.

## 10. Frontend design & performance

Brand tokens centralised; fonts via `next/font` (OFL-licensed: a condensed display such as Bebas Neue/Anton, an editorial serif such as Playfair Display/Cormorant, and Inter/DM Sans). `prefers-reduced-motion` honoured by every motion primitive (static fallback). Registration/payment pages carry no blocking animation. Images through `next/image`. Public pages ISR/cached with tag revalidation when admin publishes content.

## 11. Deployment

Vercel + Supabase hosted project. Env-driven URLs (site, auth redirect, email links, certificate links, webhook URL). Nothing deploys to production without explicit human approval.

## 12. Open decisions (defaults proposed; all remain configurable)

1. Email provider (default: Resend free tier, abstracted).
2. PDF library (default: `pdf-lib`).
3. Local DB: Supabase CLI + Docker (recommended) vs. hosted dev project only.
4. Rich-text editor for blog (default: TipTap, lazy-loaded in admin only).
