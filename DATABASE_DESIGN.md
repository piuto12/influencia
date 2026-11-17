# DATABASE_DESIGN — PostgreSQL (Supabase)

Status: PROPOSAL. All tables get `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at` (trigger) unless noted. RLS enabled on **every** table; default deny.

## Core / events
- **events** — series: `slug`, `name`.
- **event_editions** — `event_id fk`, `edition_number`, `code` (e.g. `INF3`, unique), `title`, `subtitle`, `starts_at timestamptz`, `ends_at`, `timezone` (default `Asia/Kolkata`), `venue_name`, `venue_city`, `venue_address`, `status` (draft/upcoming/active/completed/archived), `is_featured`, `capacity int`, `waitlist_enabled`, `registration_open`, `registration_deadline`, `attendance_min_percent`/rule json, `cta_config jsonb`, `seo jsonb`. Unique `(event_id, edition_number)`.

## People & registration
- **participants** — `full_name`, `email_normalized` (unique), `mobile`, `whatsapp`, `organization`, `designation`, `department`, `city`. Edition-independent.
- **registrations** — `edition_id fk`, `participant_id fk`, `reference` (unique), `category` (enum of 7), `previous_participation bool`, `consent_at`, `status` (submitted, payment_pending, proof_submitted, under_verification, confirmed, rejected, cancelled, waitlisted), `confirmed_at`, `waitlist_position`, snapshot of submitted details (`details_snapshot jsonb`). **Unique `(edition_id, participant_id)`**; partial index on `(edition_id) where status='confirmed'`.
- **registration_history** — append-only: `registration_id`, `from_status`, `to_status`, `actor_id`, `note`.

## Payments
- **payment_methods** — catalogue: `code` (upi, upi_qr, bank_transfer, razorpay, venue, …), `provider`.
- **payment_settings** — per edition+method: `enabled`, `config jsonb` (UPI ID, bank details, instructions; secrets never here), `qr_asset_path`, `deadline`, `verification_mode` (manual/auto), `fee_amount`, `currency`, `discounts jsonb`. Versioned (`version int`).
- **payments** — `registration_id`, `method_code`, `status` (pending, proof_submitted, under_verification, verified, failed, rejected, refunded, partially_refunded), `amount`, `currency`, `fee_snapshot jsonb` (historical fee/discount), `settings_version`, `transaction_ref`, `gateway_order_id`, `gateway_payment_id`, `verified_by`, `verified_at`, `rejection_reason`. Unique on `(method, gateway_payment_id)` where not null.
- **payment_events** — append-only immutable ledger (no UPDATE/DELETE privileges).
- **payment_proofs** — `payment_id`, `storage_path` (private bucket), `mime`, `size`, `uploaded_at`.
- **payment_webhooks** — `provider`, `event_id`, `payload jsonb`, `signature_valid`, `processed_at`. **Unique `(provider, event_id)`** for idempotency.
- **refunds** — `payment_id`, `amount`, `reason`, `status`, `gateway_refund_id`, `recorded_by`.

## Admin & access
- **roles** (super_admin, registration_admin, finance_admin), **permissions** (`code`), **role_permissions** (m:n).
- **admin_users** — `auth_user_id` (unique, → auth.users), `role_id`, `display_name`, `active`.
- **audit_logs** — append-only: `actor_id`, `action`, `entity_type`, `entity_id`, `before jsonb`, `after jsonb`, `ip`, `user_agent`.

## Operations
- **attendance** — `registration_id` (unique per edition), `checked_in_at`, `method` (qr/manual), `checked_in_by`, `corrected_by`, `correction_note`.
- **certificates** — `registration_id`, `certificate_code` (unique, non-guessable), `template_id`, `issued_at`, `pdf_path`, `revoked_at`.
- **notifications** — `registration_id`, `channel` (email/whatsapp_link), `template`, `status`, `error`, `sent_at`. Plus `notification_templates` (editable).

## Content & media
- **media_categories**, **media_gallery** (`edition_id`, `category_id`, `storage_path`, `caption`, `sort_order`, `featured`, `published`), **media_videos** (`edition_id`, `source` youtube/vimeo/upload, `url`/`storage_path`, `thumbnail`, `category_id`, `featured`, `sort_order`, `status`), **testimonials** (`edition_id`, name, designation, organization, photo, feedback, video_url, rating, `featured`, `status` approved/draft — public reads only `approved`).
- **homepage_sections** (`edition_id` nullable, `type`, `sort_order`, `published`, `content jsonb`), **content_pages** (`slug` unique, `body`, `seo`, `published`), **blog_articles** (`slug` unique, `author`, `category`, `featured_image`, `body`, `seo`, `status`, `published_at`), **social_links**, **site_settings** (key/value jsonb: contact, branding, nav).

## Functions (SECURITY DEFINER, `search_path` pinned)
- `register_for_edition(...)` — validates open/deadline, upserts participant, creates registration + pending payment with fee snapshot.
- `confirm_registration(reg_id)` — locks edition row, enforces capacity, falls to waitlist.
- `check_in(token)` — idempotent.
- `has_permission(code)`, `is_admin()` — RLS helpers.

## RLS summary
- Anonymous: read published content/media/testimonials(approved)/active editions; **no direct table writes** — registration and status lookup go through server actions using narrow DB functions.
- Authenticated admin: per-permission policies (`registrations.*`, `payments.*`, `content.*`, `settings.*`, …).
- Append-only tables: INSERT only; UPDATE/DELETE revoked.
- Storage: `private-payment-proofs` and `certificates` admin-read only; `public-media` public read, admin write.

## Migrations
Ordered SQL files in `supabase/migrations/` (`0001_core`, `0002_registration`, `0003_payments`, `0004_admin_rbac`, `0005_content_media`, `0006_ops`, `0007_rls`, `0008_functions`), each reviewed before applying. Destructive migrations need explicit approval. Seed data (`seed.sql`) is development-only, clearly fictional, and never run in production.
