#!/usr/bin/env bash
# Cập nhật phiên bản mới lên máy chủ: kéo mã, build lại (hoặc dùng image đã nạp), khởi động lại dịch vụ đổi.
# Chạy trên máy chủ: bash infra/scripts/deploy.sh
#
# Máy 1 GB RAM (LOW_MEMORY=1 trong .env.production): KHÔNG build trên máy chủ. Hãy build ở máy khác, chuyển image
# lên và chạy "docker load -i ..." trước, rồi mới chạy script này (xem docs/deploy-micro.md).
set -euo pipefail

cd "$(dirname "$0")/../.."

ENV_FILE=".env.production"
LOW_MEMORY="$(grep -E '^LOW_MEMORY=' "$ENV_FILE" 2>/dev/null | head -n1 | cut -d= -f2- | tr -d '' || true)"

git pull --ff-only

if [ "$LOW_MEMORY" = "1" ]; then
  COMPOSE=(docker compose -f infra/docker-compose.prod.yml -f infra/docker-compose.micro.yml --env-file "$ENV_FILE")
else
  COMPOSE=(docker compose -f infra/docker-compose.prod.yml --env-file "$ENV_FILE")
  "${COMPOSE[@]}" build
fi

# Migration chạy tự động khi container api khởi động (xem docker-compose.prod.yml)
"${COMPOSE[@]}" up -d --remove-orphans
"${COMPOSE[@]}" ps

# Dọn image cũ không còn dùng để khỏi đầy ổ đĩa
docker image prune -f >/dev/null
