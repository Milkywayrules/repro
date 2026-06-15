# Deploy blueprint — repro

Platform-agnostic prep for **local**, **Railway**, and **Contabo (Coolify)**. Swap targets by changing env vars and deploy target — not application code.

**Status:** implemented — domain map, health probes, auth cookies, CORS derivation, CI scaffold.

---

## Environment matrix

| `APP_ENV` | Purpose              | `DEPLOY_PLATFORM`      | Postgres                    |
| --------- | -------------------- | ---------------------- | --------------------------- |
| `test`    | CI / automated tests | `local` or CI runner   | shared test DB / ephemeral  |
| `dev`     | daily development    | `local`                | shared local DB (with test) |
| `stg`     | pre-production       | `railway` or `contabo` | separate stg DB             |
| `prod`    | live users           | `railway` or `contabo` | separate prod DB            |

`NODE_ENV` stays `development` | `production` | `test` (runtime/optimization). Do not overload it with stg/prod business meaning — use `APP_ENV`.

---

## Domain map

**Knobs:** [`product.ts`](../packages/env/src/lib/product.ts) (`productSlug`, `localTld`, `cloudTld`). **Shape:** [`domains.ts`](../packages/env/src/lib/domains.ts). Default bases: `userepro.test` (local), `userepro.dev` (cloud).

| Env        | Base (default)   | Example API host        |
| ---------- | ---------------- | ----------------------- |
| Local      | `userepro.test`  | `api.userepro.test`     |
| Cloud prod | `userepro.dev`   | `api.userepro.dev`      |
| Cloud stg  | `userepro.dev`   | `stg-api.userepro.dev`  |

**Reverse proxy (local):** `infra/nginx/local.conf` (generated). Cloud: Railway/Coolify routing.

**Browser extension:** WXT dev on `localhost:5555` only — no nginx vhost, no cloud domain, no subdomain in the domain map.

---

## Cloud architecture

All cloud deploys are **long-running VPS/services** (Node/Bun containers on Railway or a Contabo VPS), not edge/serverless Workers.

### Cloudflare (all cloud paths)

```
Browser → Cloudflare (proxied, orange cloud) → origin (Railway or Coolify)
```

- TLS: **Full (strict)** — origin must present valid cert (Railway/Coolify/Let's Encrypt).
- WAF / edge rate limits: enable later; app rate limit on `/api/auth/*` first.

### Path A — Railway (stg and/or prod)

```
Cloudflare → Railway service (api)     → DATABASE_URL
           → Railway service (console)
           → Railway service (marketing)
           → Railway service (docs)
           → Railway Postgres plugin OR external DATABASE_URL
```

- **One Railway project**, multiple services — recommended.
- Each service: custom domain in Railway + DNS CNAME at Cloudflare.
- Railway terminates TLS at platform edge (still use Full strict with Railway cert).

See [railway/README.md](./railway/README.md).

### Path B — Contabo VPS + Coolify

```
Cloudflare → Coolify Traefik (on VPS) → Docker container api
                                      → Docker container console
                                      → Docker container marketing
                                      → Docker container docs
                                      → Postgres container OR external DATABASE_URL
```

- **One Coolify instance** on VPS for repro + other sites — acceptable; set CPU/RAM limits per service.
- Coolify Traefik replaces manual nginx — same subdomain routing model as local nginx.
- Do **not** add a second nginx in front of Coolify unless you have a rare edge case.

See [coolify/README.md](./coolify/README.md).

### Swapping Railway ↔ Contabo

Recommended strategy: keep application code platform-agnostic; swap only deploy manifests and env.

Application code depends only on:

- `DATABASE_URL` (any Postgres: Railway plugin, Coolify docker, Neon, Supabase, local)
- `APP_ENV` + `DEPLOY_PLATFORM` (domain map → public URLs)
- Api secrets: Doppler → Railway Sync ([doppler/README.md](./doppler/README.md)); Coolify manual until wired

Deploy manifests live under `infra/railway/` and `infra/coolify/`. No Railway/Coolify SDK in app code.

To migrate stg or prod:

1. Provision the target platform (Railway project or Coolify instance).
2. Copy env vars from the current platform; set `DEPLOY_PLATFORM` to `railway` or `contabo`.
3. Point Cloudflare DNS CNAMEs at the new origin.
4. Run `db:migrate` as a deploy gate before switching traffic.
5. Decommission the old services after smoke tests pass.

---

## Postgres plug-and-play

| Provider                      | `DATABASE_URL` example shape                    | When                            |
| ----------------------------- | ----------------------------------------------- | ------------------------------- |
| Local docker / native         | `postgresql://...@localhost:5432/...`           | dev + test                      |
| Railway Postgres              | `postgresql://...@...railway.app:...`           | stg/prod on Railway             |
| Coolify Postgres container    | `postgresql://...@postgres:5432/...` (internal) | stg/prod on Contabo             |
| External managed (Neon, etc.) | provider connection string                      | any env — saves VPS/Railway RAM |

**Local low-RAM machines:** use external managed Postgres for dev — set `DATABASE_URL` only; no code change.

**Migrations:** `db:migrate` runs as deploy gate before traffic (all environments).

---

## Health checks

| Route         | Probe type    | Checks              | Fails when                       |
| ------------- | ------------- | ------------------- | -------------------------------- |
| `GET /health` | **Liveness**  | process responds    | process hung (restart container) |
| `GET /ready`  | **Readiness** | Postgres `SELECT 1` | DB down (stop routing traffic)   |

**Railway api deploy healthcheck:** `https://api.<host>/ready` — configured in `infra/railway/api.toml` (`healthcheckPath = "/ready"`). Fails the deploy if Postgres is unreachable.

**Manual liveness smoke:** `GET https://api.<host>/health` — process responds without DB check.

**Coolify:** use `/ready` for routing readiness and/or `/health` for liveness, same semantics as above.

---

## Auth cookies (confirmed)

```ts
sameSite: 'lax',
secure: true,
httpOnly: true,
domain: env.AUTH_COOKIE_DOMAIN, // derived from product.ts + DEPLOY_PLATFORM
```

Cookie domain derives from `DEPLOY_PLATFORM` via `defaultCookieDomain()` in `@repro/env/domains`. Optional `AUTH_COOKIE_DOMAIN` env override.

**SameSite:** `lax` — cookie shared across `api` + `console` on the same registrable domain.

---

## CORS / trusted origins

Derived from domain map in `@repro/env/domains` — console, marketing, docs only. Extension and preview URLs excluded.

---

## Console API URL (Vite — confirmed)

Vite **mode env files** only: `.env.development`, `.env.staging`, `.env.production`. See [vite-env-patterns.md](./vite-env-patterns.md).

Platform env vars can override file values at build time if the deploy platform injects `VITE_*` — document per platform, do not rely on CI setting them by default.

---

## Implementation workflow

Composer implements the full scope in a single pass (not slice-by-slice) → human QA (nginx, auth, CI) → fix issues → loop until green.

| Phase            | Scope                                                                               | Verify                          |
| ---------------- | ----------------------------------------------------------------------------------- | ------------------------------- |
| **Env contract** | domain map, CORS, cookies, ports, health                                            | `check`, `check-types`          |
| **Local proxy**  | local-dev nginx (`infra/nginx/local.conf`), marketing `:5002` | `nginx -t`, curl health, auth   |
| **CI**           | check, types, docs types, build, migrate dry-run placeholder, Firefox extension zip | CI green                        |
| **Deploy docs**  | Railway/Coolify placeholders                                                        | supervisor review before deploy |

---

## Confirmed decisions

- Local base: from `product.ts` (`localBaseDomain`)
- Stg: cloud only, `stg-*` prefix domains
- Contabo: Coolify Traefik (no manual nginx)
- Cloudflare: proxied; Full (strict); WAF later
- Marketing: **Astro** on `:5002`, www → apex 301
- Extension: `localhost:5555` only; no cloud domain
- Preview CORS: defer
- Resend: `.env.example` placeholder only
- Rate limit: `/api/auth/*` only (Elysia middleware)
- Docs: deploys to stg + prod cloud like other apps
- Postgres: per platform default; external URL via `DATABASE_URL`
- Auth cookies: `lax` + shared cookie domain
- Vite: `.env.[mode]` files (not `config.json`)
- Cloud deploys: long-running containers on Railway or Contabo VPS — not edge/serverless
