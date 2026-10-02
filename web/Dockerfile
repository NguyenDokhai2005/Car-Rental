# Build từ thư mục gốc repo (context = ..), xem infra/docker-compose.prod.yml.
# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# ---- build ----
FROM base AS build
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY api/package.json api/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile --filter web...
COPY web web
ENV NEXT_TELEMETRY_DISABLED=1
# Cần Internet: next/font tải font Be Vietnam Pro từ Google lúc build.
RUN pnpm --filter web build

# ---- runtime: chỉ bản standalone, không cần pnpm hay mã nguồn ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /repo/web/.next/standalone ./
COPY --from=build /repo/web/.next/static ./web/.next/static
COPY --from=build /repo/web/public ./web/public
USER node
EXPOSE 3000
CMD ["node", "web/server.js"]
