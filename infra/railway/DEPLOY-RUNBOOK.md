# Railway deploy runbook — repro

Operator guide for staging and production. Application deploys are **Railway auto-deploy on merge** (GitHub integration). Migrations run **inside Railway** before each api deploy unless you use the GHA escape hatch.

**Related docs:** [README.md](./README.md) (config-as-code reference), [doppler/README.md](../doppler/README.md) (secrets + Sync), [blueprint.md](../blueprint.md) (topology).

---

## First deploy order

Do these in sequence — skipping steps causes failed health checks or auth breakage.

1. **Doppler** — fill `api/stg` and `api/prd` (see doppler checklist). Set `DATABASE_URL` to internal host `postgres.railway.internal:5432` when Postgres lives in the same Railway project.
2. **Doppler → Railway Sync** — `stg` → staging api service; `prd` → production api service. **Auto-redeploy: OFF** (you control deploy timing via Git merge).
3. **Railway project** — create four services (api, console, marketing, docs). Complete the [Railway UI checklist](#railway-ui-checklist) below.
4. **GitHub** — connect repo; enable auto-deploy per service/environment. Set GitHub Environment `DATABASE_URL` to the **public proxy** URL for optional GHA migrate (see [Internal `DATABASE_URL`](#internal-database_url-in-doppler)).
5. **Cloudflare** — DNS CNAMEs to Railway; SSL mode **Full (strict)**.
6. **First merge to deploy branch** — Railway builds all touched services. Api pre-deploy runs `packages/db/src/migrate.ts` before the new container goes live.
7. **Smoke** — `GET https://stg-api.<cloud-base>/ready` (staging) then production equivalents after prod deploy.

---

## Railway UI checklist

One Railway project; **Root Directory = `/`** (repo root) for every service. Do not set Root Directory to `apps/<app>` — Dockerfiles copy the monorepo at root.

| Service   | Config file path (Settings)   | Pre-deploy / health / port notes |
| --------- | ----------------------------- | -------------------------------- |
| **api**   | `/infra/railway/api.toml`     | Pre-deploy: `cd /app && bun run packages/db/src/migrate.ts` (from TOML). Health: **`/ready`** (120s) — Postgres readiness, not `/health`. |
| **console** | `/infra/railway/console.toml` | Health: `/` (180s). Build uses committed `.env.staging` / `.env.production`. |
| **marketing** | `/infra/railway/marketing.toml` | Health: `/` (60s). nginx listens on Railway's injected `$PORT` — no manual target-port step. |
| **docs**  | `/infra/railway/docs.toml`    | Health: `/` (180s). Staging build: auto-detected from `RAILWAY_ENVIRONMENT_NAME` (`BUILD_MODE` optional override). |

**Per service (all four):**

- [ ] Config file path set to the TOML above
- [ ] Root Directory = `/`
- [ ] GitHub repo connected; deploy branch matches your flow (`main` / `staging`)
- [ ] Custom domain attached (see [README.md](./README.md#custom-domains))

**Api only:**

- [ ] Pre-deploy command present (via `api.toml` — verify in UI after linking config file)
- [ ] Doppler Sync delivers env vars (no hand-edited secrets in Railway)
- [ ] Health check path = `/ready`

**Marketing only:**

- [ ] No manual target port needed — nginx listens on Railway `$PORT`

**Console / docs / marketing — staging build:**

- [ ] Staging environment is named `staging` in Railway (Dockerfiles auto-run `build:staging` via `RAILWAY_ENVIRONMENT_NAME`)
- [ ] (Optional) override locally/CI with `--build-arg BUILD_MODE=staging`

**Region and deploy overlap (from TOML):** all four services pin `asia-southeast1-eqsg3a` (Singapore) with `numReplicas = 1`. Each sets `overlapSeconds` (api 30, console 20, docs 20, marketing 10) so the old deploy serves until the new one is healthy — near-zero-downtime with a single replica. If deploy rejects `multiRegionConfig`, remove it from that service's TOML (plan may not support region selection). Details: [README.md](./README.md#region-and-replicas).

---

## Internal `DATABASE_URL` in Doppler

Railway provides two Postgres URLs: **internal** (private network) and **public** (internet proxy, e.g. `*.proxy.rlwy.net`).

| Use case | Which URL | Host example |
| -------- | --------- | -------------- |
| Api runtime + Railway pre-deploy migrate | **Internal** — free, no egress, lower latency | `postgres.railway.internal:5432` |
| GHA escape-hatch migrate | **Public proxy** — GitHub runners cannot reach `*.railway.internal` | `*.proxy.rlwy.net` (bills egress) |
| Local dev | Local Postgres | `localhost:5432` in `apps/api/.env` |

Set Doppler `stg` and `prd` `DATABASE_URL` to the **internal** host (`postgres.railway.internal:5432`). Railway Sync pushes it to the api service only.

Keep GitHub Environment `DATABASE_URL` (`staging` / `production`) on the **public proxy URL** — the escape-hatch workflow runs outside Railway and must use a host reachable from GitHub Actions.

Never commit connection strings. Rotate secrets in Doppler; re-sync to Railway and update GitHub Environment secrets when the public URL changes.

### Postgres SSL (`packages/db`)

TLS is host-aware: disabled automatically for `*.railway.internal` and `localhost`; enabled for public hosts. No manual SSL env vars needed for internal Doppler URLs.

If the GHA escape-hatch migrate fails TLS verification against the public proxy host, append `?sslmode=no-verify` to the GitHub Environment `DATABASE_URL` secret.

---

## When to use the GHA escape hatch

**Default:** do nothing — merge code; Railway api pre-deploy runs `bun run packages/db/src/migrate.ts` automatically.

**Use** [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) (manual **Deploy** workflow, pick `staging` or `production`) when:

- Debugging a migration failure outside a full deploy
- Emergency schema fix before a Railway build is ready
- Pre-deploy is disabled or broken temporarily
- You need to apply migrations without triggering a new api image

The workflow runs `check-types` then `db:migrate` using the GitHub Environment `DATABASE_URL`. It does **not** redeploy Railway services.

**Do not** run escape hatch and rely on pre-deploy for the same migration in quick succession — pick one path per change set.

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

- [ ] Enable Railway Postgres backups — data-loss protection
- [ ] Enable Check Suites so Railway waits for `ci.yml` to pass before deploying — prevents shipping a red build
- [ ] Set Doppler `stg`/`prd` `DATABASE_URL` to internal host `postgres.railway.internal:5432` — free in-network access for runtime and pre-deploy migrate
- [ ] Set up deploy notifications (email or webhook to Slack/Discord) — surface failed deploys without polling the dashboard
- [ ] (later) Front services with Cloudflare for WAF + DDoS
- [ ] (later) Add a log drain for evlog output to an external sink

Do **not** add a Docker `HEALTHCHECK` instruction — Railway uses `healthcheckPath` from each service TOML (`infra/railway/*.toml`); a container healthcheck is redundant.

---

## Quick reference

| Action | How |
| ------ | --- |
| Normal deploy | Merge to deploy branch → Railway auto-build |
| Normal migrate | Api pre-deploy in `infra/railway/api.toml` |
| Escape migrate | GitHub Actions → Deploy workflow → choose environment |
| Smoke api | `GET /ready` on api host |
| Smoke liveness | `GET /health` (no DB check) |
| Operator checklist | [doppler/README.md](../doppler/README.md#setup-checklist) |
| Production readiness | [Production readiness checklist](#production-readiness-checklist) |
| Staging build | Auto-detected from `RAILWAY_ENVIRONMENT_NAME` when env is named `staging` (`BUILD_MODE` optional override) |
| Internal `DATABASE_URL` | Doppler `stg`/`prd` → `postgres.railway.internal:5432` |
| Escape-hatch `DATABASE_URL` | GitHub Environment → public `*.proxy.rlwy.net` URL |
