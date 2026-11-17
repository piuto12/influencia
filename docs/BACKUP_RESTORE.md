# Backup & restore

The database holds personal data and payment references, so backups are sensitive: encrypt them, store them off this machine, never commit them (`/backups` is git-ignored).

## What to back up
| Asset | How |
|---|---|
| PostgreSQL (all tables, auth users) | `scripts/backup.sh` → `backups/influencia-db-<UTC>.dump` (pg_dump custom format, `public` + `auth` schemas) |
| Storage (`public-media`, `private-payment-proofs`) | same script calls `scripts/export-storage.mjs` → `backups/storage-<UTC>/` |
| Configuration | `.env.local` values live in Vercel/Supabase dashboards; keep an encrypted copy of the secret *names and owners*, not the values in Git |

## Take a backup
```bash
DATABASE_URL='postgresql://postgres.<ref>:<password>@<pooler-host>:5432/postgres' bash scripts/backup.sh
```
`DATABASE_URL` is the *Session pooler* string from Supabase → Connect. It contains the DB password: pass it on the command line or via your shell/secret manager, never in a file in this repo. Requires `pg_dump` 15+ (`brew install libpq` on macOS).

## Schedule
- Supabase **free** plan: no automatic backups and projects pause after inactivity → run the script **daily during registration** and **immediately before event day and before any migration**. A paid plan adds daily backups / point-in-time recovery.
- Keep: daily for 14 days, then weekly for 8 weeks.

## Restore drill (do this once before launch, on a scratch project)
1. Create an empty scratch Supabase project (never restore over production without approval).
2. Apply `supabase/migrations/*.sql` in order **or** restore the dump into the empty database:
   ```bash
   pg_restore --no-owner --no-privileges --clean --if-exists --dbname "$SCRATCH_DATABASE_URL" backups/influencia-db-<stamp>.dump
   ```
3. Re-upload storage objects from `backups/storage-<stamp>/` (bucket name = first folder).
4. Check: row counts match, an admin can sign in, a registration reference resolves, a payment proof opens through a signed URL, a certificate verifies.
5. Delete the scratch project and the restored data.

## Disaster notes
- The immutable ledgers (`payment_events`, `audit_logs`, `registration_history`) are the source of truth for money and decisions — restore them first if rebuilding selectively.
- If keys leak: rotate the Supabase service-role/publishable keys and the Razorpay secrets, redeploy, then review `audit_logs`.
