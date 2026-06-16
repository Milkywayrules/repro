# syntax=docker/dockerfile:1
# Build from repo ROOT:  docker build -f apps/marketing/Dockerfile -t repro-marketing .
FROM oven/bun:1.3.14 AS prune
WORKDIR /app
COPY . .
RUN bunx turbo@2.9.16 prune marketing --docker

FROM oven/bun:1.3.14 AS build
WORKDIR /app

COPY --from=prune /app/out/json/ .
RUN bun install --frozen-lockfile --ignore-scripts

COPY --from=prune /app/out/full/ .

ARG RAILWAY_ENVIRONMENT_NAME
ARG BUILD_MODE=production
RUN if [ "$RAILWAY_ENVIRONMENT_NAME" = "staging" ] || [ "$BUILD_MODE" = "staging" ]; then bunx turbo run build:staging --filter=marketing...; else bunx turbo run build --filter=marketing...; fi

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner

ENV PORT=8080
ENV NGINX_ENVSUBST_FILTER=PORT

COPY apps/marketing/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/marketing/dist /usr/share/nginx/html

EXPOSE 8080
