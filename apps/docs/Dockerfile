# syntax=docker/dockerfile:1
# Build from repo ROOT:  docker build -f apps/docs/Dockerfile -t repro-docs .
# Next.js needs REAL Node.js (not bun's node shim) for native-module resolution
# (e.g. @takumi-rs OG image generation) at both build and runtime. We use the
# node base image and bring in the bun binary only to run install + the build script.
FROM node:22-slim AS build
WORKDIR /app
COPY --from=oven/bun:1.3.14 /usr/local/bin/bun /usr/local/bin/bun

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
RUN bun run --filter docs postinstall
ARG RAILWAY_ENVIRONMENT_NAME
ARG BUILD_MODE=production
RUN if [ "$RAILWAY_ENVIRONMENT_NAME" = "staging" ] || [ "$BUILD_MODE" = "staging" ]; then bun run --filter docs build:staging; else bun run --filter docs build; fi

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/apps/docs/.next/standalone ./
COPY --from=build /app/apps/docs/.next/static ./apps/docs/.next/static
RUN mkdir -p ./apps/docs/public

USER node
EXPOSE 5009
CMD ["node", "apps/docs/server.js"]
