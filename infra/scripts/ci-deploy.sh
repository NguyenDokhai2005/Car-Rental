#!/usr/bin/env bash
# Deploy do GitHub Actions gọi, chạy bên trong máy chủ (self-hosted runner), trên bản mã vừa được checkout.
# Khác deploy.sh: không "git pull" (runner đã lấy đúng commit cần deploy) và có kiểm tra sau khi chạy.
#
# File cấu hình bí mật nằm NGOÀI thư mục checkout (checkout bị dọn mỗi lần), mặc định:
#   $HOME/carrental-config/.env.production      (đổi bằng biến CARRENTAL_ENV_FILE)
#
# Điều kiện: hệ thống đã được chạy ít nhất một lần bằng init-letsencrypt.sh hoặc init-selfsigned.sh
# để chứng chỉ HTTPS đã có trong volume của Docker.
set -euo pipefail

cd "$(dirname "$0")/../.."

ENV_FILE="${CARRENTAL_ENV_FILE:-$HOME/carrental-config/.env.production}"
if [ ! -f "$ENV_FILE" ]; then
  echo "Thiếu $ENV_FILE. Tạo file này trên máy chủ trước (xem docs/ci-cd.md, mục 'Cài runner')."
  exit 1
fi

COMPOSE=(docker compose -f infra/docker-compose.prod.yml --env-file "$ENV_FILE")

# Deploy hỏng thì in trạng thái và log gần nhất ngay trong log của workflow, để biết nguyên nhân mà không phải SSH vào máy.
on_error() {
  echo
  echo "==> DEPLOY THẤT BẠI. Trạng thái và log gần nhất:"
  "${COMPOSE[@]}" ps || true
  "${COMPOSE[@]}" logs --tail 30 api web nginx || true
}
trap on_error ERR

echo "==> Commit đang deploy: $(git rev-parse --short HEAD 2>/dev/null || echo '?')"

echo "==> 1/4 Build image"
"${COMPOSE[@]}" build

echo "==> 2/4 Khởi động dịch vụ (migration chạy tự động khi api khởi động)"
"${COMPOSE[@]}" up -d --remove-orphans
# Nginx đọc cấu hình từ file mẫu lúc khởi động; tạo lại để nhận thay đổi cấu hình mới.
"${COMPOSE[@]}" up -d --force-recreate --no-deps nginx

wait_healthy() {
  local container="$1" waited=0
  until [ "$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || true)" = "healthy" ]; do
    if [ "$waited" -ge 180 ]; then
      echo "Hết thời gian chờ $container khỏe lại. Log gần nhất:"
      docker logs --tail 40 "$container" || true
      return 1
    fi
    sleep 3
    waited=$((waited + 3))
  done
  echo "    $container: healthy"
}

echo "==> 3/4 Chờ các dịch vụ khỏe lại"
for service in db api web; do
  wait_healthy "carrental-$service-1"
done

echo "==> 4/4 Kiểm tra từ bên ngoài qua Nginx"
check_code() {
  local url="$1" expected="$2" got="" attempt
  for attempt in $(seq 1 15); do
    got="$(curl -sk -o /dev/null -w '%{http_code}' "$url" || true)"
    [ "$got" = "$expected" ] && { echo "    $url -> $got (đúng)"; return 0; }
    sleep 2
  done
  echo "    $url -> $got, mong đợi $expected"
  return 1
}
check_code "https://localhost/" 200
# API chưa đăng nhập phải trả 401: chứng tỏ API sống và đang chặn người lạ
check_code "https://localhost/api/me" 401

# Dọn image cũ không còn dùng để khỏi đầy ổ đĩa
docker image prune -f >/dev/null

echo "==> Deploy xong."
