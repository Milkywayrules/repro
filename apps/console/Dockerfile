# syntax=docker/dockerfile:1
# Build from repo ROOT:  docker build -f apps/console/Dockerfile -t repro-console .
FROM oven/bun:1.3.14 AS build
WORKDIR /app

COPY package.json bun.lock turbo.json ./

COPY apps/api/package.json apps/api/
COPY apps/browser-extension/package.json apps/browser-extension/
COPY apps/console/package.json apps/console/
COPY apps/docs/package.json apps/docs/
COPY apps/marketing/package.json apps/marketing/

COPY packages/auth/package.json packages/auth/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/env/package.json packages/env/
COPY packages/ui/package.json packages/ui/

RUN bun install --frozen-lockfile --ignore-scripts

COPY . .
ARG RAILWAY_ENVIRONMENT_NAME
ARG BUILD_MODE=production
RUN if [ "$RAILWAY_ENVIRONMENT_NAME" = "staging" ] || [ "$BUILD_MODE" = "staging" ]; then bun run --filter console build:staging; else bun run --filter console build; fi

# dist/server/server.js keeps bare imports (react, @tanstack/*) — install prod externals only
FROM oven/bun:1.3.14 AS console-runtime-deps
WORKDIR /app/console-runtime
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/apps/console/package.json ./package.json.full
RUN bun -e "\
const root = JSON.parse(await Bun.file('/app/package.json').text()); \
const catalog = root.workspaces?.catalog ?? {}; \
const pkg = JSON.parse(await Bun.file('package.json.full').text()); \
delete pkg.devDependencies; \
for (const [name, spec] of Object.entries(pkg.dependencies ?? {})) { \
  const value = String(spec); \
  if (value.startsWith('workspace:')) delete pkg.dependencies[name]; \
  else if (value === 'catalog:') pkg.dependencies[name] = catalog[name]; \
  else if (value.startsWith('catalog:')) pkg.dependencies[name] = catalog[value.slice(8)]; \
} \
await Bun.write('package.json', JSON.stringify(pkg, null, 2)); \
" && rm package.json.full /app/package.json && bun install --production --ignore-scripts

FROM oven/bun:1.3.14-slim AS runner
WORKDIR /app/apps/console
ENV NODE_ENV=production
COPY --from=build /app/apps/console/dist ./dist
COPY --from=console-runtime-deps /app/console-runtime/node_modules ./node_modules
USER bun
EXPOSE 5001
CMD ["bun", "run", "dist/server/server.js"]
