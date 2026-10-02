#!/usr/bin/env bash
# Xin chứng chỉ HTTPS Let's Encrypt lần đầu cho DOMAIN trong .env.production.
# Chạy từ bất kỳ đâu: bash infra/scripts/init-letsencrypt.sh
#
# Vì sao cần script: Nginx không khởi động được nếu thiếu file chứng chỉ, mà Let's Encrypt cần Nginx đang chạy
# (cổng 80) để xác minh domain. Script phá vòng lặp đó bằng chứng chỉ tạm.
set -euo pipefail
# Git Bash trên Windows tự đổi đường dẫn kiểu /var/... thành C:/Program Files/Git/...; tắt để lệnh docker nhận đúng đường dẫn.
export MSYS_NO_PATHCONV=1

cd "$(dirname "$0")/../.."

ENV_FILE=".env.production"
[ -f "$ENV_FILE" ] || { echo "Thiếu $ENV_FILE. Sao chép từ .env.production.example rồi điền giá trị."; exit 1; }

get_var() { grep -E "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '\r'; }

DOMAIN="$(get_var DOMAIN)"
EMAIL="$(get_var LETSENCRYPT_EMAIL)"
STAGING="$(get_var LETSENCRYPT_STAGING)"
[ -n "$DOMAIN" ] && [ "$DOMAIN" != "example.com" ] || { echo "Hãy đặt DOMAIN thật trong $ENV_FILE."; exit 1; }
[ -n "$EMAIL" ] || { echo "Hãy đặt LETSENCRYPT_EMAIL trong $ENV_FILE."; exit 1; }

COMPOSE=(docker compose -f infra/docker-compose.prod.yml --env-file "$ENV_FILE")
CERTBOT=("${COMPOSE[@]}" run --rm --entrypoint)

STAGING_ARG=""
[ "$STAGING" = "1" ] && STAGING_ARG="--staging"

# Đã có chứng chỉ thật (có file renewal) thì không xin lại, tránh chạm giới hạn của Let's Encrypt.
# Đổi từ staging sang thật: xóa chứng chỉ cũ bằng "docker compose ... run --rm --entrypoint sh certbot -c 'rm -rf /etc/letsencrypt/*'"
if "${CERTBOT[@]}" sh certbot -c "test -f /etc/letsencrypt/renewal/$DOMAIN.conf"; then
  echo "Đã có chứng chỉ cho $DOMAIN. Không làm gì thêm."
  exit 0
fi

echo "==> 1/4 Tạo chứng chỉ tạm để Nginx khởi động được"
"${CERTBOT[@]}" sh certbot -c "
  mkdir -p /etc/letsencrypt/live/$DOMAIN &&
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
    -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
    -subj '/CN=localhost'"

echo "==> 2/4 Khởi động Nginx (kéo theo db, api, web)"
"${COMPOSE[@]}" up -d --build nginx

echo "==> 3/4 Xóa chứng chỉ tạm và xin chứng chỉ thật${STAGING_ARG:+ (STAGING)}"
"${CERTBOT[@]}" sh certbot -c "rm -rf /etc/letsencrypt/live/$DOMAIN /etc/letsencrypt/archive/$DOMAIN /etc/letsencrypt/renewal/$DOMAIN.conf"
# shellcheck disable=SC2086
"${CERTBOT[@]}" certbot certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" --email "$EMAIL" --agree-tos --no-eff-email --rsa-key-size 4096 --non-interactive $STAGING_ARG

echo "==> 4/4 Tải lại Nginx với chứng chỉ mới"
"${COMPOSE[@]}" exec nginx nginx -s reload
"${COMPOSE[@]}" up -d certbot

echo
echo "Xong. Thử: curl -I https://$DOMAIN"
[ -n "$STAGING_ARG" ] && echo "Lưu ý: đang dùng chứng chỉ STAGING. Đặt LETSENCRYPT_STAGING=0 rồi xóa chứng chỉ staging và chạy lại để lấy chứng chỉ thật."
exit 0
