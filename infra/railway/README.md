# Railway deploy — repro

Railway service definitions as config-as-code. Application code is platform-agnostic — swap via env only.

## Model

- **Long-running Bun/Node services** (not serverless/edge).
- One Railway project, one service per app: `api`, `console`, `marketing`, `docs`.
- Postgres: Railway plugin **or** external `DATABASE_URL` (Neon, Supabase, etc.).

## Config as code

Each service uses a dedicated TOML file (absolute path from repo root). Set **Settings → Config file path** in the Railway UI:

| Service   | Config file path              |
| --------- | ----------------------------- |
| api       | `/infra/railway/api.toml`     |
| console   | `/infra/railway/console.toml` |
| marketing | `/infra/railway/marketing.toml` |
| docs      | `/infra/railway/docs.toml`    |

**Root Directory:** `/` (repo root) for all four services. Dockerfiles run `COPY . .` and `bun install --frozen-lockfile` at monorepo root — do not set Root Directory to `apps/<app>`.

Watch paths are explicit per service in each TOML (no `/packages/**` glob). Changes under `packages/env/**` intentionally redeploy all four services.

### Region and replicas

All four services pin Singapore (`asia-southeast1-eqsg3a`) with `numReplicas = 1` via `multiRegionConfig` in each TOML `[deploy]` block.

**Caveat:** region and replica selection may require a Railway plan that supports region selection. If deploy rejects `multiRegionConfig`, remove that key from the affected service TOML.

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

**Primary path:** Railway **pre-deploy command** on the api service (defined in `infra/railway/api.toml` as array form `["cd /app && bun run packages/db/src/migrate.ts"]`):

```bash
cd /app && bun run packages/db/src/migrate.ts
```

Railway runs pre-deploy from the container working directory, not the monorepo root — the command must `cd /app` first (matches Docker `WORKDIR /app`). It uses drizzle-orm's bundled `migrate()` migrator so the production API image no longer ships `turbo` or `drizzle-kit` (those remain dev-only for `db:generate` / `db:push` / `db:studio`).

Runs inside Railway's network before the new api container starts, so the internal `DATABASE_URL` from Doppler Sync works without exposing it to GitHub.

**Postgres SSL:** `packages/db` disables TLS for `*.railway.internal` and `localhost`; public hosts use TLS. If the GHA escape hatch fails TLS verification against the public proxy host, append `?sslmode=no-verify` to the GitHub Environment `DATABASE_URL` secret.

**Escape hatch:** [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) — manual `workflow_dispatch` migrate using GitHub Environment `DATABASE_URL` (public proxy URL — GitHub runners cannot reach `*.railway.internal`). Use only when Railway pre-deploy is unavailable. Not the primary migrate path.

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

Configured in each service TOML (`healthcheckPath`, `healthcheckTimeout`):

| Service   | Path     | Timeout | Notes |
| --------- | -------- | ------- | ----- |
| api       | `/ready` | 120s    | Readiness — Postgres `SELECT 1`; use `/ready` in Railway UI |
| console   | `/`      | 180s    | Root route |
| marketing | `/`      | 60s     | nginx static |
| docs      | `/`      | 180s    | Next.js root |

Liveness for manual smoke: `GET /health` on api (always `{ status: 'ok' }` without DB).

Do **not** add a Docker `HEALTHCHECK` instruction — Railway uses `healthcheckPath` from each service TOML; a container healthcheck is redundant.

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

Each app has a Dockerfile at `apps/<app>/Dockerfile`. Build context must be the **repo root** (`docker build -f apps/<app>/Dockerfile .`). On Railway, set Root Directory to repo root and point each service at its TOML + `dockerfilePath`. Api secrets arrive via Doppler Sync.

Multi-stage layout — **build** compiles; **runner** is what ships:

| Stage | Role |
| ----- | ---- |
| `build` | Cache-friendly `package.json` copy → `bun install --frozen-lockfile` → **`COPY . .`** (full monorepo) → app build via turbo filter |
| `*-runtime-deps` | api / console only — resolve production npm deps for bare-import runtime bundles |
| `runner` | Slim runtime image — compiled artifacts (+ minimal extras where noted), no source tree |

Console, marketing, and docs accept `BUILD_MODE=staging` (default `production`) to pick staging vs production env files at build time.

| App | Build stage | Runner stage |
| --- | ----------- | ------------ |
| **api** | `oven/bun:1.3.14` — `bun run --filter api build` | `oven/bun:1.3.14-slim` — `dist/` + `api-runtime-deps` `node_modules`; keeps `packages/db`, `packages/env/src`, and standalone `packages/db/src/migrate.ts` for pre-deploy migrations. Runner installs only `--production --filter @repro/db` (no turbo/drizzle-kit). CMD: `bun run dist/index.mjs` |
| **console** | `oven/bun:1.3.14` — `build` or `build:staging` | `oven/bun:1.3.14-slim` — `dist/` + `console-runtime-deps` `node_modules` only. CMD: `bun run dist/server/server.js` |
| **marketing** | `oven/bun:1.3.14` — Astro `build` / `build:staging` | `nginxinc/nginx-unprivileged:1.27-alpine` — static `dist/` + nginx template; runs non-root on port 8080 by default (Railway injects `$PORT`). No Node/Bun at runtime |
| **docs** | `node:22-slim` + copied `bun` binary — `postinstall`, then Next `build` / `build:staging` | `node:22-slim` — Next.js **standalone** output (`.next/standalone` + static). CMD: `node apps/docs/server.js` |

## Before first deploy

See **[DEPLOY-RUNBOOK.md](./DEPLOY-RUNBOOK.md)** for operator order, UI checklist, migration discipline, rollback, and [production readiness checklist](./DEPLOY-RUNBOOK.md#production-readiness-checklist).

Quick path: Doppler `stg`/`prd` filled → Railway Sync (auto-redeploy OFF) → four services with config paths above → GitHub auto-deploy → smoke `GET /ready` on api.

Checklists: [doppler/README.md](../doppler/README.md), [DEPLOY-RUNBOOK.md](./DEPLOY-RUNBOOK.md).

## Production readiness checklist

Dashboard actions not captured in repo code. Complete after first deploy; revisit before production cutover. Full operator context: [DEPLOY-RUNBOOK.md](./DEPLOY-RUNBOOK.md#production-readiness-checklist).

- [ ] (deferred) Railway managed Postgres backups require a paid plan; on free tier, interim option is a scheduled `pg_dump` (GHA cron → object storage). until then, data loss from a bad migration is unrecoverable.
- [ ] (declined, by choice) Check Suites not enabled — Railway auto-deploys on merge independently of `ci.yml`; a red build can ship. accepted trade-off.
- [x] set Doppler `stg`/`prd` `DATABASE_URL` to the internal host `postgres.railway.internal` — done; GitHub Environment secret stays on the public proxy for the escape hatch
- [ ] (later) Set up deploy notifications (email or webhook to Slack/Discord) — surface failed deploys without polling the dashboard
- [ ] (later) Front services with Cloudflare for WAF + DDoS
- [ ] (later) Add a log drain for evlog output to an external sink

## TODO (supervisor)

- [x] Config-as-code: `infra/railway/{api,console,marketing,docs}.toml`
- [x] Migrate escape hatch: GHA workflow with GitHub Environment `DATABASE_URL`
- [x] Operator runbook: [DEPLOY-RUNBOOK.md](./DEPLOY-RUNBOOK.md)
- [ ] Doppler → Railway Sync for api `stg` and `prd`
- [ ] Staging project/service naming
