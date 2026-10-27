# Backup and restore

All application data lives in PostgreSQL, in the schema named in `DATABASE_URL` (`?schema=koduvai`). Uploaded images live in `STORAGE_LOCAL_DIR` (or your S3 bucket).

## Backup (daily, keep 30 days)

```bash
# Database: custom format, compressed, this schema only
pg_dump "postgresql://USER:PASS@HOST:5432/DB" --schema=koduvai -Fc -f backups/koduvai-$(date +%F).dump
# Uploads (local storage)
tar czf backups/uploads-$(date +%F).tgz uploads/
```
- Store backups **off the server** (a different provider or region) and encrypt them (e.g. `age` or `gpg`). They contain personal data.
- Managed Postgres: also enable the provider's point-in-time recovery.
- Restrict backup access to the Super Admin(s), and delete expired backups on schedule.

## Restore

```bash
# 1. Stop the web app and worker.
# 2. Restore into an EMPTY database/schema (verify the target first — this replaces data):
pg_restore --dbname="postgresql://USER:PASS@HOST:5432/DB" --clean --if-exists --no-owner backups/koduvai-YYYY-MM-DD.dump
tar xzf backups/uploads-YYYY-MM-DD.tgz
# 3. Apply any newer migrations, then start the app:
npx prisma migrate deploy
```

## Test restores quarterly

Restore the latest backup into a scratch database, set `DATABASE_URL` to it, run `npm run env:check` and start the app. Then log in and spot-check members, events and payments. Record the date in the committee minutes.
