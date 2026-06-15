# Agent guide — repro

Monorepo agent instructions for this Better-T-Stack project. Pair with Cursor rules under `.cursor/rules/` and MCP config in [`.cursor/mcp.json`](.cursor/mcp.json).

**Stack:** Bun, Turborepo, TanStack Start (console), Elysia (API), Drizzle + PostgreSQL, Better Auth, shadcn/ui (`packages/ui`), evlog, WXT (extension), Fumadocs, Astro (marketing).

**Code style:** Ultracite (Biome). Run `bun run check` / `bun run fix`. Deeper lint guidance lives in workspace rules — do not duplicate generic TS/React lint prose here.

**Local dev:** subdomain nginx + TLS — [README.md](README.md#use-cases) for setup flows. Knobs: [`product.ts`](packages/env/src/lib/product.ts) (default `userepro.test` / `userepro.dev`).

**Deploy blueprint:** [infra/blueprint.md](infra/blueprint.md) — Railway, Contabo/Coolify, Cloudflare. **Operator runbook:** [infra/railway/DEPLOY-RUNBOOK.md](infra/railway/DEPLOY-RUNBOOK.md).

---

## Personal behavior (MUST FOLLOW)

- be responsible, be professional, be curious, dont prefer assumptions, dont overstepped — proceed when requirements and docs are clear.
- fuck off if you `do too much → realize it → long apology`.
- you are allowed to be contradict. always agree to anything is not making you any better.
- when i ask (e.g. "so it is mandatory for phase 1 & 2? the rest is optional?), better to answer those questions. you often assumes then take action, dont be like that.
- when there are questions that not yet answered by me, confirm again, maybe i forgot.
- on **critical or ambiguous** items (e.g. scope, deletes, auth, merge targets, product intent, refactors): MUST **ask or confirm using question picker with me first** — do not guess.
- **chat proposals are not implementation approval** — answer first; code only when requirements are clear or I explicitly say go.
- **one question at a time with the picker**; use a structured format: single pick, multi pick, or short essay — not a wall of mixed questions.
- if docs conflict or stakes are high, stop and ask before implementing.

---

## Quick reference

| Task                          | Command                                      |
| ----------------------------- | -------------------------------------------- |
| Install deps                  | `bun install` (also runs `lefthook install`) |
| **Local bootstrap**           | `bun run setup:local`                        |
| Dev (all apps)                | `bun run dev`                                |
| Dev console only              | `bun run dev:console`                        |
| Dev API only                  | `bun run dev:api`                            |
| Dev marketing only            | `bun run dev:marketing`                      |
| Dev browser extension         | `turbo -F browser-extension dev`             |
| Dev docs                      | `bun run dev:docs`                           |
| Typecheck                     | `bun run check-types`                        |
| Typecheck docs                | `turbo -F docs types:check`                  |
| Lint / format check           | `bun run check`                              |
| Auto-fix lint / format        | `bun run fix`                                |
| Push DB schema                | `bun run db:push`                            |
| Generate migrations           | `bun run db:generate`                        |
| Run migrations                | `bun run db:migrate`                         |
| DB studio                     | `bun run db:studio`                          |
| Configure product slug / TLDs | `bun run configure-product <slug>`           |
| Regenerate nginx / hosts      | `bun run sync:local-infra`                   |

Diagnose Ultracite: `bun x ultracite doctor`.

**Browse locally (via nginx + TLS)** — shapes from `product.ts`; default `userepro.test`:

| Surface   | URL pattern                    |
| --------- | ------------------------------ |
| Console   | `https://console.<local-base>` |
| API       | `https://api.<local-base>`     |
| Marketing | `https://<local-base>` (apex)  |
| Docs      | `https://docs.<local-base>`    |

Default local console: **https://console.userepro.test** (see `product.ts` if slug changed).

Do not use raw `localhost` ports in the browser — auth cookies require HTTPS on the public hostnames.

---

## Local dev checklist

WSL2 typical layout: **nginx + dev servers in WSL**, **browser on Windows**. Hosts must exist on **both** OSes — see [infra/README.md](infra/README.md#wsl2--windows-browser).

| Step | What                                                                                                                           | Status signal                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| 1    | Merge [infra/hosts.example](infra/hosts.example) into WSL `/etc/hosts` **and** Windows `C:\Windows\System32\drivers\etc\hosts` | `ping api.<local-base>` resolves |
| 2    | `bun run setup:local` (certs + nginx symlinks) or [infra/certs/README.md](infra/certs/README.md)                               | `:443` listening                 |

| 3 | **Windows:** `certmgr.msc` → Trusted Root → import `rootCA.pem` (Windows path: `wslpath -w "$(mkcert -CAROOT)/rootCA.pem"` in WSL; also printed by `setup:local`) — [infra/certs/README.md](infra/certs/README.md#windows-browser-wsl2) | padlock on API hostname |
| 4 | `cp apps/api/.env.example apps/api/.env` and fill `BETTER_AUTH_SECRET` | API starts without env errors |
| 5 | `bun run dev` | upstreams on `:5000`–`:5002`, `:5009` |
| 6 | Open https://console.<local-base> | not raw `localhost` ports |

**TLS:** `bun run setup:local` handles cert generation + nginx symlinks. **Windows CA trust** is manual (one-time per machine).

---

## Domains & ports

**Product knobs (slug + TLDs):** [`packages/env/src/lib/product.ts`](packages/env/src/lib/product.ts) — `productSlug`, `localTld`, `cloudTld` → `{slug}.{tld}` bases.

**Topology (subdomain shape, ports, URL derivation):** [`packages/env/src/lib/domains.ts`](packages/env/src/lib/domains.ts) — `getHostConfig`, `deriveUrls`, `deriveCorsOrigins`, `localDevPorts`. Apps import `@repro/env/{api,console,...}` only.

**Fork / rename:** `bun run configure-product <slug> [--local-tld test] [--cloud-tld dev]` (writes `product.ts` + sync) then `bun run setup:local` (sync + TLS/nginx).

### Hostname shape (default slug `userepro`)

| Env   | Base domain     | Example surfaces                                    |
| ----- | --------------- | --------------------------------------------------- |
| Local | `userepro.test` | `api.`, `console.`, `docs.` + apex marketing        |
| Cloud | `userepro.dev`  | same; staging uses `stg-*` host prefix on same base |

Generated local infra: `infra/nginx/local.conf`, `infra/hosts.example` (from `bun run sync:local-infra`).

**Extension dev:** WXT on `localhost:5555` — no nginx vhost, no cloud domain.

**Other infra:** PostgreSQL `:5432` (`DATABASE_URL`); Drizzle Studio `:4983`.

---

## Env architecture

Three concerns — not three places you hand-sync URLs:

| Layer                      | Where                                                                     | What belongs here                                                                              |
| -------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Topology**               | `product.ts` + `domains.ts`                                               | Slug/TLD knobs; subdomain shape; URL/CORS derivation; `localDevPorts`                          |
| **Secrets + environment**  | `apps/api/.env` (local); [Doppler `api`](infra/doppler/README.md) (cloud) | api: `DATABASE_URL`, `BETTER_AUTH_SECRET`, switches. Client apps: mode files only              |
| **Client build overrides** | Per-app mode files (optional)                                             | `VITE_APP_ENV`, `VITE_DEPLOY_PLATFORM`, optional URL overrides — URLs derive from topology lib |

### What to commit vs what goes in env (production-grade)

| Change type                                       | Where                                             | Commit code?                                       |
| ------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------- |
| Rename product slug or cloud/local TLD            | `configure-product`                               | **Yes** — then `setup:local` if local base changed |
| Add staging surface / `stg-*` host                | `domains.ts`                                      | **Yes**                                            |
| CORS allow-list surfaces                          | `domains.ts` (`deriveCorsOrigins`)                | **Yes** — encodes which apps call the API          |
| Local dev ports (`5000`–`5009`)                   | `domains.ts` `localDevPorts` + `local.conf`       | **Yes** — infra contract                           |
| **Cloud** public URLs at runtime                  | Derived from `APP_ENV` + `DEPLOY_PLATFORM`        | **No URL vars in env**                             |
| DB connection string                              | local `.env` / Doppler (cloud api)                | **Never commit**                                   |
| Auth secret, API keys                             | local `.env` / Doppler (cloud api)                | **Never commit**                                   |
| `APP_ENV`, `DEPLOY_PLATFORM` (api cloud)          | Doppler `stg` / `prd`                             | **Not in git**                                     |
| `APP_ENV`, `DEPLOY_PLATFORM` (client apps)        | committed mode files                              | **Yes** (no secrets)                               |
| Cookie domain (`.{cloud-base}` / `.{local-base}`) | **Derived** from `product.ts` + `DEPLOY_PLATFORM` | Optional `AUTH_COOKIE_DOMAIN` override in env      |

**Industry pattern:** topology (who talks to whom, on which hostnames) is **versioned code** or **infra-as-code**. Secrets and per-environment _switches_ (`APP_ENV`) are **runtime config**. Ports in production are usually platform-assigned (`PORT` from Railway) — not `5000` in prod env files.

**Do not put in prod env files:** hardcoded public URLs (derive them), local ports, CORS lists (derive them), cookie domain for all envs in one file without per-target config.

**Optional escape hatch:** read `BASE_DOMAIN` from Doppler/env in `product.ts` instead of a constant — trade-off: less type-safe. Default: three constants in `product.ts`.

Per-app `VITE_*` files should be **optional overrides**, not the source of truth — URLs derive from `APP_ENV` + `DEPLOY_PLATFORM` via topology.

**Port convention:** each app sets **`PORT`** in its own mode file (no `API_PORT` / `MARKETING_PORT` prefixes). `localDevPorts` in `domains.ts` is nginx/infra reference only.

**Runtime imports:**

| Context                                             | Import                                                                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| API process                                         | `@repro/env/api` — server env + derived URLs + `CORS_ORIGINS`                                                          |
| Console app code                                    | `@repro/env/console`                                                                                                   |
| Marketing app code                                  | `@repro/env/marketing`                                                                                                 |
| Docs app code                                       | `@repro/env/docs`                                                                                                      |
| Build configs (`vite.config.ts`, `astro.config.ts`) | `loadEnv()` in the app + `@repro/env/topology` for URL derivation and schema parse — **build wiring stays in the app** |

**Derived automatically** (from `APP_ENV` + `DEPLOY_PLATFORM`): `API_URL`, `CONSOLE_URL`, `MARKETING_URL`, `DOCS_URL`, `BETTER_AUTH_URL`, `CORS_ORIGINS`, `AUTH_COOKIE_DOMAIN`.

**Per-app mode files** — see [Env files by app](#env-files-by-app) below.

**Auth cookies:** `sameSite: "lax"`, `secure: true`, `httpOnly: true`, `domain: AUTH_COOKIE_DOMAIN` (derived).

**Health:** `GET /health` (liveness), `GET /ready` (Postgres `SELECT 1`).

### Env files by app

Every app that derives URLs needs **`APP_ENV` + `DEPLOY_PLATFORM`** — naming differs by runtime:

| App                   | Var names                                      | Files                                                                 | Secrets?                                     |
| --------------------- | ---------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------- |
| **api**               | `APP_ENV`, `DEPLOY_PLATFORM`, `PORT`           | `.env` + `.env.example`                                               | Yes (`DATABASE_URL`, `BETTER_AUTH_SECRET`)   |
| **console**           | `VITE_APP_ENV`, `VITE_DEPLOY_PLATFORM`, `PORT` | `.env.example`, `.env.development`, `.env.staging`, `.env.production` | No — Vite requires `VITE_` prefix for client |
| **marketing**         | `APP_ENV`, `DEPLOY_PLATFORM`, `PORT`           | `.env.example`, `.env.development`, `.env.staging`, `.env.production` | No                                           |
| **docs**              | `APP_ENV`, `DEPLOY_PLATFORM`, `PORT`           | `.env.example`, `.env.development`, `.env.staging`, `.env.production` | No                                           |
| **browser-extension** | —                                              | —                                                                     | No (`localhost:5555`)                        |

**Same semantics, different names:** `APP_ENV=dev` (api) ≡ `VITE_APP_ENV=dev` (console). Only **api** needs a copied `.env` for secrets; other apps ship committed mode files with defaults.

**After clone:** `bun install` (runs `lefthook install` via `postinstall`, skipped in CI) → `bun run setup:local` once. **post-checkout** prints the status table via `check-local-prereqs.sh`.

### Cloud deploy (Railway + Doppler)

**Primary migrate:** Railway api pre-deploy (`infra/railway/api.toml`) with internal `DATABASE_URL` from Doppler Sync. **App deploy:** Railway auto-deploy on merge — no GHA redeploy step.

**Escape hatch:** manual [deploy.yml](../.github/workflows/deploy.yml) — `check-types` + `db:migrate` using GitHub Environment `DATABASE_URL` (`staging` / `production`). No Doppler CLI in CI.

**Doppler project:** `api` · configs `dev`, `dev_personal`, `stg`, `prd` · Sync to Railway api only. Console / marketing / docs use committed mode files.

Full setup: [infra/doppler/README.md](infra/doppler/README.md) · operator steps: [infra/railway/DEPLOY-RUNBOOK.md](infra/railway/DEPLOY-RUNBOOK.md).

---

## Project layout

```
repro/
├── apps/
│   ├── api/               # API — Elysia + Better Auth (:5000)
│   ├── browser-extension/ # WXT (:5555, no nginx)
│   ├── console/           # TanStack Start (:5001)
│   ├── docs/              # Next.js + Fumadocs (:5009)
│   └── marketing/         # Astro (:5002)
├── packages/
│   ├── auth/              # Better Auth (Drizzle adapter)
│   ├── config/            # Shared TS / tooling config
│   ├── db/                # Drizzle schema, client, drizzle-kit
│   ├── env/               # @repro/env/{api,console,marketing,docs,topology}
│   └── ui/                # Shared shadcn/ui
├── infra/                 # nginx, hosts, blueprint, deploy docs
└── .agents/skills/        # Optional — load on demand
```

**Terminology:** API / **console** / marketing / docs / browser extension — folder names, turbo names, and prose match.

**Import conventions:** `@repro/ui/components/<name>` · `@repro/auth` · `@repro/db` · `@repro/env/{api,console,marketing,docs}` · `@repro/env/topology` (build configs only)

---

## Validation — Zod repo-wide

Use **Zod** for env, request bodies, query params, and form validation across the monorepo.

- **Do** use Zod for env, request bodies, query params, forms.
- **Do** use Elysia + Zod via Standard Schema when route validation is needed.
- **Do not** use Elysia TypeBox in app or package code.
- **Do** use `zod` schemas and `safeParse` / `parse` patterns (see `@repro/env`, console auth forms).
- **Do** use Elysia with Zod via Standard Schema (e.g. `zodToStandardSchema` / `@standard-schema/zod`) when route validation is needed.
- **Do not** use Elysia TypeBox (`Elysia.t`, `@sinclair/typebox`) in app or package code.
- **Do not** add TypeBox-based validation because `.agents/skills/elysiajs/` examples use it — those are reference only.

---

## Agent doc map

| Need                             | Open                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Git commits (style + no trailer) | [.cursor/rules/verasic-git-commits.mdc](.cursor/rules/verasic-git-commits.mdc)                           |
| JSDoc / code comments            | [.cursor/rules/verasic-jsdoc-and-comments.mdc](.cursor/rules/verasic-jsdoc-and-comments.mdc)             |
| MCP servers                      | [.cursor/mcp.json](.cursor/mcp.json)                                                                     |
| Local nginx / hosts / TLS        | [infra/README.md](infra/README.md), [infra/certs/README.md](infra/certs/README.md)                       |
| Deploy blueprint                 | [infra/blueprint.md](infra/blueprint.md)                                                                 |
| Doppler (api secrets + Sync)     | [infra/doppler/README.md](infra/doppler/README.md)                                                       |
| Railway deploy runbook           | [infra/railway/DEPLOY-RUNBOOK.md](infra/railway/DEPLOY-RUNBOOK.md)                                       |
| Vite mode env patterns           | [infra/vite-env-patterns.md](infra/vite-env-patterns.md)                                                 |
| Domain config options            | [infra/domain-config-options.md](infra/domain-config-options.md)                                         |
| Human onboarding                 | [README.md](README.md)                                                                                   |
| shadcn MCP                       | [.agents/skills/shadcn/mcp.md](.agents/skills/shadcn/mcp.md)                                             |
| Better Auth                      | [.agents/skills/better-auth-best-practices/SKILL.md](.agents/skills/better-auth-best-practices/SKILL.md) |
| Drizzle                          | [.agents/skills/drizzle-orm-patterns/SKILL.md](.agents/skills/drizzle-orm-patterns/SKILL.md)             |
| Log debugging                    | [.agents/skills/analyze-logs/SKILL.md](.agents/skills/analyze-logs/SKILL.md)                             |

Skills under `.agents/skills/` are reference — load when the task matches.

---

## MCP servers

| Server          | Use when                                                         |
| --------------- | ---------------------------------------------------------------- |
| **shadcn**      | Registries, component source, install commands for `packages/ui` |
| **better-auth** | Auth plugins, sessions, adapters                                 |
| **playwright**  | Browser automation at local console URL when nginx is up         |

**Not configured yet:** GitHub, Sentry, Cloudflare, Resend — add when those features land.

---

## CLIs agents use

| CLI                              | When                                  |
| -------------------------------- | ------------------------------------- |
| `bun run …`                      | Root scripts (`dev`, `check`, `db:*`) |
| `turbo -F <pkg> <task>`          | Single workspace package              |
| `bunx shadcn@latest …`           | UI components (`-c packages/ui`)      |
| `bunx @better-auth/cli@latest …` | Auth schema                           |
| `drizzle-kit`                    | Via `bun run db:*`                    |
| `wxt`                            | Browser extension                     |

**Post-edit hook:** `bun run fix --skip=correctness/noUnusedImports`. **Git hooks:** lefthook + Biome on pre-commit.

---

## Stack-specific guidance

### Console (`console.*`)

- Routes: `apps/console/src/routes/`
- App env: `@repro/env/console`
- Build config: `apps/console/vite.config.ts` — `loadEnv` + `@repro/env/topology`
- Mode files: `apps/console/.env.development` — `VITE_APP_ENV` + ports only; URLs derive from `domains.ts`
- Production build: `bun run build` (default) or `bun run build:staging` (`--mode staging`); Docker `BUILD_MODE=staging` selects `build:staging` in `apps/console/Dockerfile`
- Production serve: `bun run start` → `dist/server/server.js` (TanStack Start + Nitro emit `dist/`, not `.output/`)

### API (`api.*`)

- `@repro/env/api`; binds `PORT`; `/api/auth/*`, `/health`, `/ready`
- evlog wide events — no `console.log` in request paths

### Marketing (apex on local/cloud base)

- `apps/marketing/astro.config.ts` — `loadEnv` + `@repro/env/topology`
- `apps/marketing/.env.development` — `APP_ENV`, `DEPLOY_PLATFORM`, `PORT`

### Docs (`docs.*`)

- `apps/docs/dev.ts` — loads `.env.development`, validates via `@repro/env/docs`, passes `env.PORT` to `next dev` (Next cannot read `PORT` from `.env` at bind time)
- Typecheck: `turbo -F docs types:check`

### Browser extension

- `turbo -F browser-extension dev` → `localhost:5555`

### Better Auth + Drizzle

- Schema: `packages/db/src/schema/auth.ts` · Config: `packages/auth/src/index.ts`
- After schema changes: `bunx @better-auth/cli@latest generate` then `db:push` / `db:migrate`

### shadcn/ui

- `packages/ui` — tokens in `globals.css`, config in `components.json`

### Debugging

- Logs: `.evlog/logs/` · skill: analyze-logs
- Console middleware: `apps/console/src/routes/__root.tsx`

---

## Testing

- No committed test runner yet; Testing Library in console devDeps.
- CI: `.github/workflows/ci.yml` — check, types, build, extension zip.
- Playwright MCP against https://console.userepro.test when nginx is running (or your `product.ts` local base).

---

## Repo-specific principles

1. **Zod everywhere** — never TypeBox in app code.
2. **Subdomain URLs** — public nginx hosts, not localhost ports, for auth.
3. **Workspace packages** — thin API handlers; shared auth, db, ui, env.
4. **Domain map in `packages/env/src/lib/domains.ts`** — single hostname/URL source; env files hold secrets and optional overrides.
5. **Agent-first debugging** — evlog + analyze-logs.

Run `bun run fix` before committing.
