# Railway deploy — repro

Railway service definitions as config-as-code. Application code is platform-agnostic — swap via env only.

## Model

- **Long-running Bun/Node services** (not serverless/edge).
- One Railway project, one service per app: `api`, `console`, `marketing`, `docs`.
- Postgres: Railway plugin **or** external `DATABASE_URL` (Neon, Supabase, etc.).
- **Staging** auto-deploys on merge to `main` (filtered by `watchPatterns`); **production** deploys manually after staging validation. Both use **Wait for CI** (`ci.yml` must pass).

## Config as code

Each service uses a dedicated JSON file (absolute path from repo root). Set **Settings → Config file path** in the Railway UI:

| Service   | Config file path              |
| --------- | ----------------------------- |
| api       | `/infra/railway/api.json`     |
| console   | `/infra/railway/console.json` |
| marketing | `/infra/railway/marketing.json` |
| docs      | `/infra/railway/docs.json`    |

**Root Directory:** leave **empty** on every service (full repo as Docker build context). Do **not** set it to `apps/<app>` because the Dockerfile lives there — `dockerfilePath` in JSON already points at `apps/<app>/Dockerfile`. Subdirectory root dirs break `COPY bun.lock`, `COPY packages/...`, and `COPY apps/...` (see [runbook troubleshooting](./DEPLOY-RUNBOOK.md#build-failures--wrong-root-directory)).
)).
).

Watch paths are explicit per service in each JSON config (no `/packages/**` glob). Changes under `packages/env/**` intentionally redeploy all four services.

### What lives in JSON vs dashboard

**In repo** ([railway.schema.json](https://railway.com/railway.schema.json)): `build.*`, `deploy.*`, optional `environments.{staging,production}` overrides.

**Dashboard only** (per service × environment): Auto deploy (staging **On**, production **Off**), Wait for CI (**On**), GitHub repo link, Root Directory, config file path, custom domains, Doppler Sync targets.

Full operator table: [DEPLOY-RUNBOOK.md](./DEPLOY-RUNBOOK.md#config-as-code-vs-dashboard).

### Region and replicas

All four services pin Singapore (`asia-southeast1-eqsg3a`) with `numReplicas = 1` via `multiRegionConfig` in each JSON `deploy` block.

**Caveat:** region and replica selection may require a Railway plan that supports region selection. If deploy rejects `multiRegionConfig`, remove that key from the affected service JSON config.

### Deploy overlap

Each service sets `overlapSeconds` alongside `drainingSeconds` so the previous deployment keeps serving until the new one passes its health check:

| Service   | `overlapSeconds` | `drainingSeconds` |
| --------- | ---------------- | ------------------- |
| api       | 30               | 20                  |
| console   | 20               | 15                  |
| docs      | 20               | 15                  |
| marketing | 10               | 5                   |

With a single replica, overlap gives near-zero-downtime deploys — traffic shifts only after the new container is healthy.

## Per-service env

### API — Doppler Sync

Do not hand-edit api secrets in Railway. Source of truth: Doppler project **api**, configs **stg** / **prd** → Sync to the api Railway service.

See [doppler/README.md](../doppler/README.md) for keys and Sync setup.

| Variable             | Source                                      |
| -------------------- | ------------------------------------------- |
| `DATABASE_URL`       | Doppler — internal host `postgres.railway.internal:5432` (free, no egress); see [runbook](./DEPLOY-RUNBOOK.md#internal-database_url-in-doppler) |
| `BETTER_AUTH_SECRET` | Doppler                                     |
| `APP_ENV`            | Doppler (`stg` or `prod`)                   |
| `DEPLOY_PLATFORM`    | Doppler (`railway`)                         |
| `NODE_ENV`           | Doppler (`production`)                      |
| `PORT`               | **Railway injects `$PORT`** — do not set in Doppler `stg`/`prd` |

`AUTH_COOKIE_DOMAIN` derives from `DEPLOY_PLATFORM` unless overridden. Public URLs derive from `APP_ENV` + `DEPLOY_PLATFORM` — no `BETTER_AUTH_URL` in env.

### Console / marketing / docs

Build-time switches only — committed `.env.staging` / `.env.production` in each app. No Doppler project.

| App       | Production build              | Staging build                          |
| --------- | ----------------------------- | -------------------------------------- |
| console   | `bun run build`               | `bun run build:staging`                |
| marketing | `bun run build`               | `bun run build:staging`                |
| docs      | `bun run build`               | `bun run build:staging`                |

On Railway, Dockerfiles auto-detect the staging build via the built-in `RAILWAY_ENVIRONMENT_NAME` build variable — when the environment is named `staging`, `build:staging` runs automatically (no manual service variable required). `BUILD_MODE` remains an optional override for local/CI Docker builds via `--build-arg`.

Docker builds accept `BUILD_MODE=staging` (default `production`):

```bash
docker build -f apps/console/Dockerfile --build-arg BUILD_MODE=staging -t repro-console:stg .
```

## Migrations (api only)

**Cloud:** Railway **pre-deploy** (`infra/railway/api.json` → `["./migrate"]`). Compiled binary + SQL in the api image; internal `DATABASE_URL` from Doppler Sync.

**Local:** `bun run db:migrate` — same `packages/db/src/migrate.ts`; needs Bun and deps from repo root (`bun install`).

Runtime image is distroless (no Bun) — see [Elysia production deploy](https://elysiajs.com/patterns/deploy).

**Postgres SSL:** `packages/db` disables TLS for `*.railway.internal` and `localhost`; public hosts use TLS.

## Console build

Build step uses committed `.env.production` or `.env.staging`. Railway build command:

```bash
bun install && bun run build
# or: bun run build:staging
```

## Marketing build

Astro loads mode env files via `astro.config.ts` (`loadEnv(mode, …)`). Staging:

```bash
bun install && bun run build:staging
```

**Port:** nginx listens on Railway's injected `$PORT` — the Dockerfile copies the config as an nginx template and sets `NGINX_ENVSUBST_FILTER=PORT`. No manual target-port step in the Railway UI.

## Docs build

Next.js staging build injects `.env.staging` via Bun:

```bash
bun install && bun run build:staging
```

Production `bun run build` relies on Next.js loading `.env.production` when `NODE_ENV=production`.

## Health checks

Configured in each service JSON config (`healthcheckPath`, `healthcheckTimeout`):

| Service   | Path     | Timeout | Notes |
| --------- | -------- | ------- | ----- |
| api       | `/ready` | 120s    | Readiness — Postgres `SELECT 1`; use `/ready` in Railway UI |
| console   | `/`      | 180s    | Root route |
| marketing | `/`      | 60s     | nginx static |
| docs      | `/`      | 180s    | Next.js root |

Liveness for manual smoke: `GET /health` on api (always `{ status: 'ok' }` without DB).

Do **not** add a Docker `HEALTHCHECK` instruction — Railway uses `healthcheckPath` from each service JSON config; a container healthcheck is redundant.

## Custom domains

Map Railway services to Cloudflare DNS (proxied, Full strict):

| Service   | Host                   |
| --------- | ---------------------- |
| api       | `api.<cloud-base>`     |
| console   | `console.<cloud-base>` |
| marketing | `<cloud-base>` (apex)  |
| docs      | `docs.<cloud-base>`    |

Staging uses `stg-*` prefix hosts — see [blueprint.md](../blueprint.md).

## Swap to Coolify

Change `DEPLOY_PLATFORM=contabo` in Doppler, point `DATABASE_URL` at Coolify Postgres, redeploy containers — no app code changes.

## Dockerfile

Each app has a Dockerfile at `apps/<app>/Dockerfile`. Build context must be the **repo root** (`docker build -f apps/<app>/Dockerfile .`). On Railway, set Root Directory to repo root and point each service at its JSON config + `dockerfilePath`. Api secrets arrive via Doppler Sync.

Multi-stage layout — **build** compiles; **runner** is what ships:

| Stage | Role |
| ----- | ---- |
| `build` | Cache-friendly `package.json` copy → `bun install --frozen-lockfile` → **`COPY . .`** (full monorepo) → app build via turbo filter |
| `*-runtime-deps` | console only — resolve production npm deps for bare-import runtime bundles |
| `runner` | Slim runtime image — compiled artifacts (+ minimal extras where noted), no source tree |

Console, marketing, and docs accept `BUILD_MODE=staging` (default `production`) to pick staging vs production env files at build time.

| App | Build stage | Runner stage |
| --- | ----------- | ------------ |
| **api** | `oven/bun:1.3.14` — `bun build --compile` for `server` + `migrate` | `gcr.io/distroless/base-debian12:nonroot` — compiled `./server` + `./migrate` + `/app/migrations`. CMD: `./server`. No Bun or `node_modules` at runtime. |
| **console** | `oven/bun:1.3.14` — `build` or `build:staging` | `oven/bun:1.3.14-slim` — `dist/` + `console-runtime-deps` `node_modules` only. CMD: `bun run dist/server/server.js` |
| **marketing** | `oven/bun:1.3.14` — Astro `build` / `build:staging` | `nginxinc/nginx-unprivileged:1.27-alpine` — static `dist/` + nginx template; runs non-root on port 8080 by default (Railway injects `$PORT`). No Node/Bun at runtime |
| **docs** | `node:22-slim` + copied `bun` binary — `postinstall`, then Next `build` / `build:staging` | `node:22-slim` — Next.js **standalone** output (`.next/standalone` + static). CMD: `node apps/docs/server.js` |

## Before first deploy

See **[DEPLOY-RUNBOOK.md](./DEPLOY-RUNBOOK.md)** for operator order, UI checklist, migration discipline, rollback, and [production readiness checklist](./DEPLOY-RUNBOOK.md#production-readiness-checklist).

Quick path: Doppler `stg`/`prd` filled → Railway Sync (auto-redeploy OFF) → four services with config paths above → staging auto-deploy on `main` → smoke staging → manual production Deploy → smoke `GET /ready` on api.

Checklists: [doppler/README.md](../doppler/README.md), [DEPLOY-RUNBOOK.md](./DEPLOY-RUNBOOK.md).

## Production readiness checklist

Dashboard actions not captured in repo code. Complete after first deploy; revisit before production cutover. Full operator context: [DEPLOY-RUNBOOK.md](./DEPLOY-RUNBOOK.md#production-readiness-checklist).

- [ ] (deferred) Railway managed Postgres backups require a paid plan; on free tier, interim option is a scheduled `pg_dump` (GHA cron → object storage). until then, data loss from a bad migration is unrecoverable.
- [x] **Wait for CI** on staging and production — required gate before Railway builds (pairs with staging auto-deploy).
- [x] set Doppler `stg`/`prd` `DATABASE_URL` to the internal host `postgres.railway.internal`
- [ ] (later) Set up deploy notifications (email or webhook to Slack/Discord) — surface failed deploys without polling the dashboard
- [ ] (later) Front services with Cloudflare for WAF + DDoS
- [ ] (later) Add a log drain for evlog output to an external sink

## TODO (supervisor)

- [x] Config-as-code: `infra/railway/{api,console,marketing,docs}.json`
- [x] Operator runbook: [DEPLOY-RUNBOOK.md](./DEPLOY-RUNBOOK.md)
- [ ] Doppler → Railway Sync for api `stg` and `prd`
- [ ] Staging project/service naming
