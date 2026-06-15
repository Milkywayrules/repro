# Coolify deploy — repro (Contabo VPS)

Placeholder for Coolify / Docker deploy on Contabo. Application code is platform-agnostic — swap via env only.

## Model

- **Long-running Docker containers** behind Coolify Traefik (not edge/serverless).
- One Coolify instance on VPS; one resource per app: `api`, `console`, `marketing`, `docs`.
- Postgres: Coolify Postgres container **or** external `DATABASE_URL`.

## Per-service env (example — production)

API container — same keys as Doppler `stg` / `prd` ([doppler/README.md](../doppler/README.md)). Coolify has no native Doppler Sync; set manually on the api container:

```bash
APP_ENV=prod
DEPLOY_PLATFORM=contabo
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=...
NODE_ENV=production
PORT=5000
```

`AUTH_COOKIE_DOMAIN` derives from `DEPLOY_PLATFORM` (`.{cloud-base}` on cloud — see `product.ts`). Override only if needed.

Console build uses `.env.production` / `.env.staging` mode files (same as Railway).

## Health checks

Traefik / Coolify health URL for api:

- `GET /health` — liveness
- `GET /ready` — readiness (Postgres)

## Custom domains

Coolify Traefik routes match Railway subdomain layout:

| Container | Host                |
| --------- | ------------------- |
| api       | `api.<cloud-base>`  |
| console   | `console.<cloud-base>`  |
| marketing | `<cloud-base>` (apex)      |
| docs      | `docs.<cloud-base>` |

Cloudflare proxied → VPS (Full strict). No repo nginx on VPS — Traefik handles TLS/routing.

## Swap to Railway

Change `DEPLOY_PLATFORM=railway` in Doppler, update `DATABASE_URL`, redeploy — no app code changes.

## Dockerfile

Each app has a Dockerfile at `apps/<app>/Dockerfile`. Use the Dockerfile build pack with build context = **repo root** (`docker build -f apps/<app>/Dockerfile .`). Coolify injects `PORT` (api/console/docs honor it; marketing nginx listens on 80 — set the target port to 80). Api secrets: mirror Doppler keys manually until a sync path exists.

## TODO (supervisor)

- [ ] Coolify compose / resource templates
- [ ] Pre-deploy migration job for api (Deploy workflow + Doppler, or Coolify hook)
- [ ] CPU/RAM limits per service on shared VPS
