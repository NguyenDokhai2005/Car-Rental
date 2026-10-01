#!/usr/bin/env bash
# Cập nhật phiên bản mới lên máy chủ: kéo mã, build lại, khởi động lại dịch vụ đổi.
# Chạy trên máy chủ: bash infra/scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/../.."

COMPOSE=(docker compose -f infra/docker-compose.prod.yml --env-file .env.production)

git pull --ff-only
"${COMPOSE[@]}" build
# Migration chạy tự động khi container api khởi động (xem docker-compose.prod.yml)
"${COMPOSE[@]}" up -d --remove-orphans
"${COMPOSE[@]}" ps

# Dọn image cũ không còn dùng để khỏi đầy ổ đĩa
docker image prune -f >/dev/null
