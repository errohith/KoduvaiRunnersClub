# Deployment

## Configuration contract

All environment-specific settings live in **one root `.env`** (documented in `.env.example`). Staging and production use the same variable names, supplied through the host's secret manager or an `.env` file on the server. **Every value is read at process start**, so after changing `.env` you must restart **both** the web process and the worker. No `NEXT_PUBLIC_*` variables are used, so no rebuild is needed for config changes. Day-to-day content (fees, events, copy, templates, branding) lives in the database and changes instantly.

Production rules enforced at startup: `APP_URL` must be https, `CRON_SECRET` must be at least 24 characters, and the `log`/`mock` providers are refused for enabled channels.

## Option A: Docker Compose (single server)

> These Docker files were written but not run in this environment (Docker wasn't available). Test them on your server.

```bash
cp .env.example .env            # fill it in; DATABASE_URL host must be "db":
# DATABASE_URL=postgresql://koduvai:<POSTGRES_PASSWORD>@db:5432/koduvai?schema=koduvai
docker compose build
docker compose up -d db
docker compose run --rm migrate # prisma migrate deploy + seed (creates bootstrap admin)
docker compose up -d web worker
```
Put a TLS reverse proxy (Caddy, nginx or Traefik) in front of port 3000, then set `ADMIN_BOOTSTRAP_ENABLED=false` and restart.

## Option B: Node on a VM

```bash
npm ci
npm run env:check
npx prisma migrate deploy
npm run db:seed                 # idempotent; never overwrites admin-edited content
npm run build
npm start                       # web (port $PORT)
npm run worker                  # background worker, run under systemd/pm2
```

## Option C: Serverless (Vercel or similar)

- Use a managed Postgres. Set `DATABASE_URL` to the pooled URL and `DIRECT_DATABASE_URL` to the direct URL (used for migrations).
- Use `STORAGE_PROVIDER=s3`, because serverless file systems are ephemeral.
- There is no long-running worker. Call `POST /api/v1/internal/cron` every minute with `Authorization: Bearer $CRON_SECRET`.

## Release checklist

- [ ] `npm test` and `npm run test:e2e` pass against staging
- [ ] `npx prisma migrate deploy` runs before the new web version starts
- [ ] `npm run audit:deps` reviewed
- [ ] Backups verified (see BACKUP_RESTORE.md)
- [ ] Sample events and news (`--sample` seed) removed; real photos, committee and policies published
- [ ] Policy pages reviewed by the committee and a legal adviser
