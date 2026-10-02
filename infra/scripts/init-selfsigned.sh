#!/usr/bin/env bash
# Chạy hệ thống với HTTPS dùng chứng chỉ TỰ KÝ, cho máy ảo hoặc mạng nội bộ không có tên miền thật.
# Dùng thay cho init-letsencrypt.sh khi không thể xin chứng chỉ Let's Encrypt.
#
# DOMAIN trong .env.production có thể là địa chỉ IP của máy ảo (ví dụ 192.168.1.50) hoặc một tên (ví dụ carrental.local).
# Trình duyệt sẽ cảnh báo "kết nối không riêng tư" lần đầu vì chứng chỉ không do tổ chức uy tín cấp; chọn
# Nâng cao -> Tiếp tục truy cập. Cookie đăng nhập (cờ Secure) vẫn hoạt động vì vẫn là HTTPS.
#
# Chạy: bash infra/scripts/init-selfsigned.sh          (tạo chứng chỉ nếu chưa có rồi khởi động hệ thống)
#       bash infra/scripts/init-selfsigned.sh --force  (tạo lại chứng chỉ)
set -euo pipefail
export MSYS_NO_PATHCONV=1

cd "$(dirname "$0")/../.."

ENV_FILE=".env.production"
[ -f "$ENV_FILE" ] || { echo "Thiếu $ENV_FILE. Sao chép từ .env.production.example rồi điền giá trị."; exit 1; }

get_var() { grep -E "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '\r'; }

DOMAIN="$(get_var DOMAIN)"
[ -n "$DOMAIN" ] && [ "$DOMAIN" != "example.com" ] || { echo "Hãy đặt DOMAIN (IP hoặc tên máy) trong $ENV_FILE."; exit 1; }

# Chứng chỉ phải khai báo tên miền hoặc IP trong subjectAltName thì trình duyệt mới chấp nhận cho phép tiếp tục.
if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then SAN="IP:$DOMAIN"; else SAN="DNS:$DOMAIN"; fi

COMPOSE=(docker compose -f infra/docker-compose.prod.yml --env-file "$ENV_FILE")
BUILD_FLAG="--build"
if [ "$(get_var LOW_MEMORY)" = "1" ]; then
  COMPOSE=(docker compose -f infra/docker-compose.prod.yml -f infra/docker-compose.micro.yml --env-file "$ENV_FILE")
  BUILD_FLAG=""
fi

CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
if [ "${1:-}" != "--force" ] && "${COMPOSE[@]}" run --rm --entrypoint sh certbot -c "test -f $CERT_DIR/fullchain.pem"; then
  echo "==> Đã có chứng chỉ cho $DOMAIN (dùng --force để tạo lại)"
else
  echo "==> 1/2 Tạo chứng chỉ tự ký cho $DOMAIN (hiệu lực 365 ngày)"
  "${COMPOSE[@]}" run --rm --entrypoint sh certbot -c "
    mkdir -p $CERT_DIR &&
    openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
      -keyout $CERT_DIR/privkey.pem -out $CERT_DIR/fullchain.pem \
      -subj '/CN=$DOMAIN' -addext 'subjectAltName=$SAN'"
fi

echo "==> 2/2 Khởi động hệ thống (Nginx kéo theo db, api, web; không chạy certbot)"
# shellcheck disable=SC2086
"${COMPOSE[@]}" up -d $BUILD_FLAG nginx
"${COMPOSE[@]}" ps

echo
echo "Xong. Mở https://$DOMAIN trong trình duyệt, bỏ qua cảnh báo chứng chỉ (Nâng cao -> Tiếp tục)."
exit 0
