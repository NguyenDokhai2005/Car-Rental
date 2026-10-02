# Build từ thư mục gốc repo (context = ..), xem infra/docker-compose.prod.yml.
# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate \
 && apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# ---- build: cài đủ gói, biên dịch, rồi tách riêng bản chỉ có gói production ----
FROM base AS build
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY api/package.json api/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile --filter api...
COPY api api
RUN pnpm --filter api exec prisma generate && pnpm --filter api build
RUN pnpm --filter api --prod deploy /out

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Thư mục lưu file; volume mới tạo sẽ thừa hưởng quyền sở hữu của node
RUN mkdir -p /data/uploads && chown node:node /data /data/uploads
# --chown tại lúc COPY, không chown -R sau đó (chown -R sẽ nhân đôi dung lượng node_modules trong image)
COPY --from=build --chown=node:node /out ./
USER node
# Sinh lại Prisma Client trong thư mục đã đóng gói
RUN node_modules/.bin/prisma generate
EXPOSE 4000
CMD ["node", "dist/main"]
