# Doppler — repro

Secrets and cloud runtime config for the **api** service. Topology (URLs, CORS, cookie domain) stays in [`packages/env/src/lib/domains.ts`](../../packages/env/src/lib/domains.ts) — do not duplicate in Doppler.

**Workplace:** `userepro.dev` · **Project:** `api` · **Configs:** `dev`, `dev_personal`, `stg`, `prd`

**Scope:** Doppler is **api cloud only**. Console, marketing, and docs have no secrets and no Doppler project — they use committed mode files. Local api dev uses `apps/api/.env` daily; Doppler `dev` is an optional mirror.

---

## Where each layer lives

| Layer | Local dev | Cloud (stg / prd) |
| ----- | --------- | ----------------- |
| Topology (`product.ts`, `domains.ts`) | git | git |
| API secrets | `apps/api/.env` | Doppler → Railway Sync |
| API runtime switches (`APP_ENV`, `DEPLOY_PLATFORM`, `NODE_ENV`) | `apps/api/.env` | Doppler → Sync (process env at runtime) |
| `PORT` | `apps/api/.env` (`5000`) | **Railway injects `$PORT`** — omit from Doppler `stg`/`prd` |
| Console / marketing / docs switches | committed `.env.development` / `.env.staging` / `.env.production` | same — baked at build, no Doppler project |

Putting **non-secrets in Doppler `stg` / `prd`** is intentional: the API container needs `APP_ENV` and `DEPLOY_PLATFORM` as environment variables when it starts. That does not contradict “committed env files for non-secrets” — that rule applies to **frontend apps** and **local** API dev. Cloud API switches ride along via Sync so Railway never hand-edits a dozen vars.

Local daily dev: **`apps/api/.env` only** — no `doppler run` required. Doppler `dev` is a mirror/reference for the team and optional `doppler run`.

---

## Config contents

Do **not** add derived URLs (`API_URL`, `CORS_ORIGINS`, `BETTER_AUTH_URL`) — `@repro/env/api` derives them from `APP_ENV` + `DEPLOY_PLATFORM`.

Do **not** add `PORT` to `stg` / `prd` — Railway sets `$PORT` at runtime.

### `dev` (mirror — optional for `doppler run`)

| Key | Example |
| --- | ------- |
| `DATABASE_URL` | `postgresql://postgres:password@localhost:5432/postgres` |
| `BETTER_AUTH_SECRET` | min 32 chars (match local `.env`) |
| `PORT` | `5000` |
| `APP_ENV` | `dev` |
| `DEPLOY_PLATFORM` | `local` |
| `NODE_ENV` | `development` |

### `stg`

| Key | Value |
| --- | ----- |
| `DATABASE_URL` | staging Postgres — use Railway **internal** URL when api and DB are in the same Railway project (reachable from pre-deploy migrate + runtime) |
| `BETTER_AUTH_SECRET` | unique to stg |
| `APP_ENV` | `stg` |
| `DEPLOY_PLATFORM` | `railway` or `contabo` |
| `NODE_ENV` | `production` |
| `RESEND_API_KEY` | optional |

### `prd`

Same as `stg`, but `APP_ENV=prod`, prod `DATABASE_URL`, and a **different** `BETTER_AUTH_SECRET`.

### `dev_personal`

Branch config off `dev` for individual overrides (alternate DB, etc.) without changing shared `dev`.

---

## Syncs (Doppler → Railway)

**Syncs** push secrets from a Doppler config into another platform **continuously**. Change a value in Doppler → it appears on Railway (optionally triggers redeploy).

```
Doppler api/stg  ──Sync──►  Railway project (staging) → api service env
Doppler api/prd  ──Sync──►  Railway project (production) → api service env
```

### Setup (Railway)

1. Railway → Account Settings → **Tokens** → create API token (not project token).
2. Doppler → project **api** → **Syncs** → **Railway**.
3. Paste Railway API token → connect.
4. Create sync **stg**:
   - Doppler config: `stg`
   - Railway project + environment: staging
   - Target: **api service only** (not shared vars unless you wire sharing in Railway)
   - Import behavior: prefer Doppler on conflict for first sync
   - Auto-redeploy: **OFF** (deploy timing via Git merge; redeploy api manually if env changed — see [railway/DEPLOY-RUNBOOK.md](../railway/DEPLOY-RUNBOOK.md))
5. Repeat for **prd** → production api service (auto-redeploy **OFF**).

Docs: [Doppler Railway integration](https://docs.doppler.com/docs/railway)

**Coolify:** no native Doppler Sync — set the same keys as Doppler `stg` / `prd` manually on the api container, or use CLI in a deploy hook. Revisit when Coolify path is active.

---

## Migrations

**Cloud:** Railway api **pre-deploy** (`./migrate` in `infra/railway/api.json`) — compiled binary in the api image; internal `DATABASE_URL` from Doppler Sync.

**Local:** `bun run db:migrate` from repo root (or `bun run db:migrate` in `packages/db`).

---

## GitHub Actions / CI secrets

Railway runtime uses **Doppler → Railway Sync only**. No Doppler → GitHub sync required for migrations.

### Repo secrets (workflow plumbing)

Keep CI-only tokens as **repo** secrets (not in Doppler):

- `COOLIFY_WEBHOOK` — Coolify path
- `TURBO_TOKEN` — remote cache (optional)

App redeploy is **Railway GitHub integration** (staging auto on `main`; production manual). Build/deploy settings: `infra/railway/*.json`.

---

## GitHub Secrets vs Doppler (this repo)

| Store | Holds |
| ----- | ----- |
| **Doppler `api`** | All api runtime vars for stg/prd (+ dev mirror); no `PORT` in stg/prd |
| **GitHub repo secrets** | `COOLIFY_WEBHOOK`, `TURBO_TOKEN` — workflow plumbing, not app runtime |
| **`apps/api/.env`** | Local secrets + switches (gitignored) |
| **Console `.env.production`** | Build-time switches (committed, no secrets) |

---

## Setup checklist

**Doppler**

- [x] Project `api` with `dev`, `stg`, `prd`
- [x] Unique `BETTER_AUTH_SECRET` per config
- [x] Runtime switches in `stg` / `prd` (no `PORT`)
- [ ] Railway Sync: `stg` → staging api service
- [ ] Railway Sync: `prd` → production api service

**GitHub**

- [ ] Push repo; Railway per service — staging Auto deploy **On**, production **Off**, Wait for CI **On**, branch `main`, config paths in `infra/railway/`

**Railway** (first deploy after Doppler Sync)

- [ ] Four services — full UI checklist in [railway/DEPLOY-RUNBOOK.md](../railway/DEPLOY-RUNBOOK.md)
- [ ] Config paths `/infra/railway/*.json`; Root Directory `/`
- [ ] Api pre-deploy migrate via `api.json`; health `/ready`
- [ ] Marketing networking target port **80**
- [ ] Doppler Sync auto-redeploy **OFF**
- [ ] Smoke `GET https://stg-api.<cloud-base>/ready`
