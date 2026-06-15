# repro

Better-T-Stack monorepo: TanStack Start console, Elysia API, Astro marketing, Fumadocs docs, Better Auth, Drizzle + PostgreSQL.

## Product hostnames

Three constants in [`packages/env/src/lib/product.ts`](packages/env/src/lib/product.ts) drive every URL, cookie domain, CSP, and generated nginx/hosts file:

| Constant | Default | Result |
| -------- | ------- | ------ |
| `productSlug` | `userepro` | hostname label |
| `localTld` | `test` | local base → `userepro.test` |
| `cloudTld` | `dev` | cloud base → `userepro.dev` |

Surfaces: `api.`, `console.`, `docs.` + marketing apex. Staging uses `stg-*` prefixes on the cloud base.

---

## Use cases

### 1. First clone (same product name)

```bash
bun install
cp apps/api/.env.example apps/api/.env   # fill BETTER_AUTH_SECRET
bun run setup:local                    # sync infra + mkcert + nginx
# merge infra/hosts.example → /etc/hosts (+ Windows hosts if WSL)
bun run db:push
bun run dev
```

Open **https://console.userepro.test** (not `localhost` ports — auth cookies need HTTPS hostnames).

Details: [infra/README.md](infra/README.md), [infra/certs/README.md](infra/certs/README.md).

### 2. Daily dev

```bash
bun run dev
```

### 3. Fork template → new product slug

```bash
bun run configure-product myapp --local-tld test --cloud-tld dev
bun run setup:local
# update /etc/hosts from infra/hosts.example
bun run dev
```

`configure-product` updates `product.ts` and regenerates `infra/nginx/local.conf` + `infra/hosts.example`.

### 4. Hand-edit `product.ts` (slug or TLD only)

```bash
# edit packages/env/src/lib/product.ts
bun run sync:local-infra
bun run setup:local          # if local base changed (certs/nginx)
# update hosts if local base changed
```

Prefer **use case 3** — same outcome, validated CLI args.

### 5. Check local prereqs

```bash
bash scripts/check-local-prereqs.sh
```

---

## Scripts

| Command | When |
| ------- | ---- |
| `bun run configure-product <slug>` | New slug / TLDs (writes `product.ts` + sync) |
| `bun run sync:local-infra` | After manual `product.ts` edit |
| `bun run setup:local` | First clone, or after local base change (sync + TLS + nginx) |
| `bun run dev` | Start all apps |
| `bun run db:push` | Apply Drizzle schema |

Deploy topology: [infra/blueprint.md](infra/blueprint.md). Agent guide: [AGENTS.md](AGENTS.md).

---

## Database

PostgreSQL via Docker Compose or external URL in `apps/api/.env`:

```bash
docker compose up -d db
bun run db:push
```

## UI

Shared shadcn/ui in `packages/ui`. Add components:

```bash
npx shadcn@latest add button -c packages/ui
```

## Project structure

```
repro/
├── apps/          api, console, marketing, docs, browser-extension
├── packages/      env (product + topology), auth, db, ui
├── infra/         nginx/local.conf, hosts.example, deploy docs
└── scripts/       configure-product, sync-local-infra, setup-local
```

## Git hooks

`bun run check` — Biome via Ultracite.
