# marketing

Astro site for the marketing apex (`https://<local-base>` via nginx).

CSP for the static page comes from `buildDocumentAppCsp()` in `src/pages/index.astro`. Container `nginx.conf` is headers-only (no duplicated CSP).

```bash
bun run dev:marketing
```

Local proxy: `infra/nginx/local.conf` (generated).
