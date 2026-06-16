# syntax=docker/dockerfile:1
# Build from repo ROOT:  docker build -f apps/docs/Dockerfile -t repro-docs .
# Next.js needs REAL Node.js (not bun's node shim) for native-module resolution
# (e.g. @takumi-rs OG image generation) at both build and runtime. We use the
# node base image and bring in the bun binary only to run install + the build script.
FROM node:24-slim AS prune
WORKDIR /app
COPY --from=oven/bun:1.3.14 /usr/local/bin/bun /usr/local/bin/bun
COPY . .
RUN bun x turbo@2.9.16 prune docs --docker

FROM node:24-slim AS build
WORKDIR /app
COPY --from=oven/bun:1.3.14 /usr/local/bin/bun /usr/local/bin/bun

COPY --from=prune /app/out/json/ .
RUN bun install --frozen-lockfile --ignore-scripts

COPY --from=prune /app/out/full/ .

RUN bun run --filter docs postinstall
ARG RAILWAY_ENVIRONMENT_NAME
ARG BUILD_MODE=production
RUN if [ "$RAILWAY_ENVIRONMENT_NAME" = "staging" ] || [ "$BUILD_MODE" = "staging" ]; then bun x turbo run build:staging --filter=docs...; else bun x turbo run build --filter=docs...; fi

FROM node:24-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/apps/docs/.next/standalone ./
COPY --from=build /app/apps/docs/.next/static ./apps/docs/.next/static
RUN mkdir -p ./apps/docs/public

USER node
EXPOSE 5009
# node needed for takumi-rs image generation
CMD ["node", "apps/docs/server.js"]
