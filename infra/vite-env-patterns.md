# Console env — Vite mode files

The console uses `@repro/env/console`. **Public URLs derive** from `VITE_APP_ENV` + `VITE_DEPLOY_PLATFORM` via `@repro/env/domains` — mode files only need environment switches and optional port overrides.

---

## Pattern

| File               | Vite mode     | When loaded                    |
| ------------------ | ------------- | ------------------------------ |
| `.env.development` | `development` | `vite dev`                     |
| `.env.staging`     | `staging`     | `vite build --mode staging`    |
| `.env.production`  | `production`  | `vite build` (default)         |

**Local development** (`.env.development`):

```bash
VITE_CONSOLE_PORT=5001
VITE_API_PORT=5000
VITE_APP_ENV=dev
VITE_DEPLOY_PLATFORM=local
```

Derives: `VITE_API_URL`, `VITE_CONSOLE_URL`, etc. from `@repro/env/topology` + `product.ts`.

**Staging** (`.env.staging`):

```bash
VITE_APP_ENV=stg
VITE_DEPLOY_PLATFORM=railway
```

**Production** (`.env.production`):

```bash
VITE_APP_ENV=prod
VITE_DEPLOY_PLATFORM=railway
```

Override URLs only when needed:

```bash
VITE_API_URL=https://custom-api.example.com
```

---

## Auth client

```ts
import { env } from '@repro/env/console'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: env.VITE_API_URL,
})
```

---

## Build commands

```bash
bun run dev:console
vite build --mode staging
vite build
```

---

## vite.config.ts

`allowedHosts` and HMR use `VITE_CONSOLE_URL` from env or derived defaults from `domains.ts`.
