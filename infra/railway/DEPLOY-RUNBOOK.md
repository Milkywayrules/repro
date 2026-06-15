# Railway deploy runbook — repro

Operator guide for staging and production.

**Deploy model:**

| Environment | Trigger | Gate |
| ----------- | ------- | ---- |
| **Staging** | Auto on push to `main` (when `watchPatterns` match) | **Wait for CI** — GitHub `ci.yml` must pass |
| **Production** | **Manual Deploy** in Railway UI (same commit as staging after validation) | **Wait for CI** — still required when you click Deploy |

Migrations run **inside Railway** before each api deploy (`./migrate` pre-deploy).

**Related docs:** [README.md](./README.md) (config-as-code reference), [doppler/README.md](../doppler/README.md) (secrets + Sync), [blueprint.md](../blueprint.md) (topology).

---

## Config-as-code vs dashboard

Railway reads **`infra/railway/*.json`** when **Settings → Config file path** points at the file (e.g. `/infra/railway/api.json`). Schema: [railway.schema.json](https://railway.com/railway.schema.json).

### In repo (versioned)

| Area | Keys | Files |
| ---- | ---- | ----- |
| Build | `builder`, `dockerfilePath`, `watchPatterns` | all four JSON configs |
| Deploy | `startCommand`, `preDeployCommand`, `healthcheckPath`, `healthcheckTimeout` | api (+ others as needed) |
| Deploy | `restartPolicyType`, `restartPolicyMaxRetries`, `overlapSeconds`, `drainingSeconds` | all four |
| Deploy | `multiRegionConfig` (region + replicas) | all four |
| Per-environment overrides | `environments.staging`, `environments.production` | optional — merge over base `build` / `deploy` |

Example override (only when staging and production need different deploy settings):

```json
{
  "deploy": { "overlapSeconds": 30 },
  "environments": {
    "production": {
      "deploy": { "overlapSeconds": 60, "healthcheckTimeout": 180 }
    }
  }
}
```

Environment names in JSON **must match** Railway environment names exactly (`staging`, `production`).

Staging vs production **build mode** for console / marketing / docs is **not** in JSON — Dockerfiles read `RAILWAY_ENVIRONMENT_NAME` at build time (name the Railway environment `staging`).

### Dashboard only (not in `railway.json`)

Set once per **service × environment**. Same JSON path for both environments; triggers differ.

| Setting | Staging | Production |
| ------- | ------- | ---------- |
| **Config file path** | `/infra/railway/{service}.json` | same |
| **Root Directory** | **empty** (full repo) | **empty** (full repo) |
| **GitHub repo + branch** | connected, `main` | connected, `main` |
| **Auto deploy** | **On** | **Off** |
| **Wait for CI** | **On** | **On** |
| **Custom domains** | `stg-*` hosts | production hosts |
| **Doppler Sync** | `api/stg` → staging api service | `api/prd` → production api service |
| **Doppler Sync auto-redeploy** | **Off** (env changes do not surprise-deploy) | **Off** |

Normal path: merge → `ci.yml` → Railway (staging auto; production when you Deploy).

**Early setup:** a single Railway service (e.g. named `repro`) can still use `/infra/railway/api.json` until you split api / console / marketing / docs.

---

## Api migrations (chosen architecture)

**Primary:** [Railway pre-deploy](https://docs.railway.com/config-as-code/reference#pre-deploy-command) on the api service — configured in `infra/railway/api.json`:

| Step | Command | When |
| ---- | ------- | ---- |
| Pre-deploy | `./migrate` | After image build, before traffic — uses internal `DATABASE_URL` |
| Start | `./server` | Serves traffic after `/ready` passes |

The api Docker image ships both binaries plus `/app/migrations` because pre-deploy runs **inside the deployment artifact** (not a separate Railway service).

**Local / CI:** `bun run db:migrate` (loads `apps/api/.env` when `DATABASE_URL` is unset).

---

## First deploy order

Do these in sequence — skipping steps causes failed health checks or auth breakage.

1. **Doppler** — fill `api/stg` and `api/prd` (see doppler checklist). Set `DATABASE_URL` to internal host `postgres.railway.internal:5432` when Postgres lives in the same Railway project.
2. **Doppler → Railway Sync** — `stg` → staging api service; `prd` → production api service. **Auto-redeploy: OFF** (you control deploy timing via Git merge).
3. **Railway project** — create four services (api, console, marketing, docs). Complete the [Railway UI checklist](#railway-ui-checklist) below.
4. **GitHub** — connect repo per service. **Staging:** Auto deploy **On**, Wait for CI **On**, branch `main`. **Production:** Auto deploy **Off**, Wait for CI **On**, branch `main`.
5. **Cloudflare** — DNS CNAMEs to Railway; SSL mode **Full (strict)**.
6. **First merge to deploy branch** — Railway builds all touched services. Api pre-deploy runs `./migrate` before the new container goes live.
7. **Smoke** — `GET https://stg-api.<cloud-base>/ready` (staging) then production equivalents after prod deploy.

---

## Railway UI checklist

One Railway project. **Root Directory must be empty** on every service (delete any value). Railway then uses the **full git checkout** as the Docker build context. Do **not** set Root Directory to `apps/<app>` — that setting limits the upload to one app folder and breaks monorepo `COPY` steps.

`dockerfilePath` in each JSON config (e.g. `apps/api/Dockerfile`) is **not** the Root Directory. The Dockerfile path only selects which file to run; the build context is always controlled by Root Directory.

| Service   | Config file path (Settings)   | `dockerfilePath` (in JSON) | Pre-deploy / health / port notes |
| --------- | ----------------------------- | -------------------------- | -------------------------------- |
| **api**   | `/infra/railway/api.json`     | `apps/api/Dockerfile`      | Pre-deploy: `./migrate` (compiled binary, `MIGRATIONS_DIR=/app/migrations`). Health: **`/ready`** (120s) — Postgres readiness, not `/health`. |
| **console** | `/infra/railway/console.json` | `apps/console/Dockerfile`  | Health: `/` (180s). Build uses committed `.env.staging` / `.env.production`. |
| **marketing** | `/infra/railway/marketing.json` | `apps/marketing/Dockerfile` | Health: `/` (60s). nginx listens on Railway's injected `$PORT` — no manual target-port step. |
| **docs**  | `/infra/railway/docs.json`    | `apps/docs/Dockerfile`     | Health: `/` (180s). Staging build: auto-detected from `RAILWAY_ENVIRONMENT_NAME` (`BUILD_MODE` optional override). |

**Per service (all four):**

- [ ] Config file path set to the JSON config above
- [ ] **Root Directory field cleared** (empty — not `apps/api`, not `apps/console`, not `/frontend`-style paths)
- [ ] GitHub repo connected; branch `main`
- [ ] **Staging environment:** Auto deploy **On**, Wait for CI **On**
- [ ] **Production environment:** Auto deploy **Off**, Wait for CI **On** (manual Deploy after staging smoke)
- [ ] Custom domain attached (see [README.md](./README.md#custom-domains))

**Api only:**

- [ ] Config file path = `/infra/railway/api.json` (overrides dashboard — see [config as code](https://docs.railway.com/config-as-code/reference))
- [ ] Pre-deploy = `./migrate`, start = `./server` (from JSON; verify file icon on deployment details)
- [ ] Doppler Sync delivers env vars (no hand-edited secrets in Railway)
- [ ] Health check path = `/ready`

**Marketing only:**

- [ ] No manual target port needed — nginx listens on Railway `$PORT`

---

## Build failures — wrong Root Directory

These Dockerfiles are **shared monorepo** builds: they `COPY` root `bun.lock`, `packages/*`, and `apps/*` paths. Railway must receive the **whole repository** as build context.

If Root Directory is set to an app subdirectory (common after JS monorepo auto-import, or because the Dockerfile lives under `apps/<app>/`), builds fail at the first `COPY` that references a path outside that folder:

| Build log error | Root Directory was probably | Fix |
| ------------- | ------------------------- | --- |
| `"/bun.lock": not found` on `COPY package.json bun.lock turbo.json` | `apps/api` | Clear Root Directory on **api** |
| `"/apps/console/package.json": not found` | `apps/console` | Clear Root Directory on **console** |
| `"/packages/db/package.json": not found` | `apps/console` or other subdir | Clear Root Directory on that service |
| `"/packages/ui/package.json": not found` | `apps/api` or other subdir | Clear Root Directory on that service |

After clearing Root Directory on **each** service (api, console, marketing, docs), redeploy. Local equivalent:

```bash
docker build -f apps/api/Dockerfile -t repro-api .
docker build -f apps/console/Dockerfile -t repro-console .
```

Run from the **repo root** (`.` is the build context). `bun.lock` and all `package.json` paths are committed — the files are not missing from git.

**Console / docs / marketing — staging build:**

- [ ] Staging environment is named `staging` in Railway (Dockerfiles auto-run `build:staging` via `RAILWAY_ENVIRONMENT_NAME`)
- [ ] (Optional) override locally/CI with `--build-arg BUILD_MODE=staging`

**Region and deploy overlap (from JSON config):** all four services pin `asia-southeast1-eqsg3a` (Singapore) with `numReplicas = 1`. Each sets `overlapSeconds` (api 30, console 20, docs 20, marketing 10) so the old deploy serves until the new one is healthy — near-zero-downtime with a single replica. If deploy rejects `multiRegionConfig`, remove it from that service's JSON config (plan may not support region selection). Details: [README.md](./README.md#region-and-replicas).

---

## Internal `DATABASE_URL` in Doppler

Railway provides two Postgres URLs: **internal** (private network) and **public** (internet proxy, e.g. `*.proxy.rlwy.net`).

| Use case | Which URL | Host example |
| -------- | --------- | -------------- |
| Api runtime + Railway pre-deploy migrate | **Internal** — free, no egress, lower latency | `postgres.railway.internal:5432` |
| Local dev | Local Postgres | `localhost:5432` in `apps/api/.env` |

Set Doppler `stg` and `prd` `DATABASE_URL` to the **internal** host (`postgres.railway.internal:5432`). Railway Sync pushes it to the api service only.

Never commit connection strings. Rotate secrets in Doppler; re-sync to Railway when values change.

### Postgres SSL (`packages/db`)

TLS is host-aware: disabled automatically for `*.railway.internal` and `localhost`; enabled for public hosts. No manual SSL env vars needed for internal Doppler URLs.

---

## Expand-contract migration discipline

Ship schema changes safely when api and DB deploy independently:

1. **Expand** — additive migration only (new nullable columns, new tables, new indexes). Deploy app code that tolerates old and new schema.
2. **Deploy** — merge; Railway pre-deploy applies migration; new api code goes live.
3. **Contract** — follow-up migration removes deprecated columns/tables after all running code ignores them.

**Rules:**

- Never drop or rename in the same release that depends on the new shape
- Backfill data in expand phase before adding `NOT NULL` constraints
- Test `db:migrate` locally (`bun run db:migrate`) and in staging before production
- Breaking auth/session schema changes need coordinated console deploy — see Better Auth migration docs

---

## Rollback via Railway UI

Railway does not auto-rollback database migrations. App rollback is per service.

**Rollback application code:**

1. Railway → service → **Deployments**
2. Find last green deployment before the bad release
3. **Redeploy** (or **Rollback** if offered) that deployment
4. Repeat per affected service (api, console, marketing, docs)

**After a bad migration:**

- If migration was **expand-only** and old code still runs: redeploy previous api image; DB may have extra columns (usually safe).
- If migration was **destructive**: restore Postgres from backup or write a forward-fix migration — redeploying old code alone is not enough.

**Secrets rollback:** revert values in Doppler → wait for Sync (or manual redeploy if auto-redeploy is off) → redeploy api if env changed.

**Staging first:** always validate rollback procedure on staging before relying on it in production.

---

## Production readiness checklist

Dashboard actions not captured in repo code. Complete after first deploy; revisit before production cutover.

- [ ] (deferred) Railway managed Postgres backups require a paid plan; on free tier, interim option is a scheduled `pg_dump` (GHA cron → object storage). until then, data loss from a bad migration is unrecoverable.
- [x] **Wait for CI** enabled on staging and production — deploys wait for green `ci.yml` on the commit (required because staging auto-deploys on merge).
- [x] set Doppler `stg`/`prd` `DATABASE_URL` to the internal host `postgres.railway.internal`
- [ ] (later) Set up deploy notifications (email or webhook to Slack/Discord) — surface failed deploys without polling the dashboard
- [ ] (later) Front services with Cloudflare for WAF + DDoS
- [ ] (later) Add a log drain for evlog output to an external sink

Do **not** add a Docker `HEALTHCHECK` instruction — Railway uses `healthcheckPath` from each service JSON config (`infra/railway/*.json`); a container healthcheck is redundant.

---

## Quick reference

| Action | How |
| ------ | --- |
| Staging deploy | Merge to `main` → `ci.yml` green → Railway auto-build (watchPatterns) |
| Production deploy | Staging validated → Railway → service → **Deploy** (same commit) |
| Config-as-code | `infra/railway/*.json` — see [Config-as-code vs dashboard](#config-as-code-vs-dashboard) |
| Normal migrate | Api pre-deploy in `infra/railway/api.json` |
| Local migrate | `bun run db:migrate` |
| Smoke api | `GET /ready` on api host |
| Smoke liveness | `GET /health` (no DB check) |
| Operator checklist | [doppler/README.md](../doppler/README.md#setup-checklist) |
| Production readiness | [Production readiness checklist](#production-readiness-checklist) |
| Staging build | Auto-detected from `RAILWAY_ENVIRONMENT_NAME` when env is named `staging` (`BUILD_MODE` optional override) |
| Internal `DATABASE_URL` | Doppler `stg`/`prd` → `postgres.railway.internal:5432` |
