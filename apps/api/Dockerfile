# syntax=docker/dockerfile:1
# Build from repo ROOT:  docker build -f apps/api/Dockerfile -t repro-api .
#
# Elysia production pattern: compile to standalone binaries, distroless runtime.
# https://elysiajs.com/patterns/deploy
FROM oven/bun:1.3.14 AS build
WORKDIR /app

ARG TARGETARCH
RUN case "${TARGETARCH}" in \
  amd64) echo bun-linux-x64 > /tmp/bun-target ;; \
  arm64) echo bun-linux-arm64 > /tmp/bun-target ;; \
  *) echo bun-linux-x64 > /tmp/bun-target ;; \
  esac

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

RUN BUN_TARGET="$(cat /tmp/bun-target)" && \
  bun build --compile \
    --minify-whitespace \
    --minify-syntax \
    --target "${BUN_TARGET}" \
    --outfile /app/server \
    apps/api/src/index.ts && \
  bun build --compile \
    --minify-whitespace \
    --minify-syntax \
    --target "${BUN_TARGET}" \
    --outfile /app/migrate \
    packages/db/src/migrate.ts

# Railway pre-deploy runs ./migrate from this image before traffic switches (see infra/railway/api.json).
# Migrate must ship in the same artifact as the server — Railway pre-deploy uses the deployment image, not a separate service.
FROM gcr.io/distroless/base-debian12:nonroot AS runner
WORKDIR /app

COPY --from=build --chmod=755 /app/server ./server
COPY --from=build --chmod=755 /app/migrate ./migrate
COPY --from=build /app/packages/db/src/migrations ./migrations

ENV NODE_ENV=production
ENV MIGRATIONS_DIR=/app/migrations

EXPOSE 5000
USER nonroot:nonroot
CMD ["./server"]
