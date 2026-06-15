# syntax=docker/dockerfile:1
# Build from repo ROOT:  docker build -f apps/marketing/Dockerfile -t repro-marketing .
FROM oven/bun:1.3.14 AS build
WORKDIR /app

# Cache dependency install (all workspace package.json files — bun lockfile requires them)
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
RUN if [ "$RAILWAY_ENVIRONMENT_NAME" = "staging" ] || [ "$BUILD_MODE" = "staging" ]; then bun run --filter marketing build:staging; else bun run --filter marketing build; fi

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner
ENV PORT=8080
ENV NGINX_ENVSUBST_FILTER=PORT
COPY apps/marketing/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/marketing/dist /usr/share/nginx/html
EXPOSE 8080
