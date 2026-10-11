#!/usr/bin/env bash
# Kiểm tra sức khỏe máy chủ và báo khi có chuyện. Chạy bằng cron mỗi 5 phút (xem install-monitor-cron.sh) hoặc chạy tay:
#   bash monitor.sh           kiểm tra, in kết quả, gửi cảnh báo nếu trạng thái vừa đổi
#   bash monitor.sh --quiet   chỉ in khi có vấn đề (dùng cho cron)
#
# Kiểm tra: trang web và API trả lời qua Nginx, các container đang chạy và khỏe, đĩa còn chỗ, bản sao lưu CSDL còn mới.
# Mã thoát: 0 nếu mọi thứ ổn, 1 nếu có ít nhất một vấn đề.
#
# Cảnh báo (tùy chọn, miễn phí): đặt MONITOR_WEBHOOK_URL trong ~/carrental-config/monitor.env là webhook của Discord hoặc
# Slack. Script chỉ gửi khi trạng thái ĐỔI (ổn sang lỗi, lỗi này sang lỗi khác, lỗi sang ổn), nên một sự cố kéo dài
# không sinh ra hàng trăm tin nhắn.
#
# Biến môi trường:
#   MONITOR_BASE_URL      địa chỉ kiểm tra                    mặc định https://localhost
#   MONITOR_DISK_MAX      ngưỡng % đĩa đã dùng                mặc định 85
#   MONITOR_BACKUP_HOURS  tuổi tối đa của bản sao lưu (giờ)   mặc định 30
#   MONITOR_NAME          tên máy chủ trong tin cảnh báo      mặc định tên máy
set -uo pipefail

CONFIG_DIR="${CARRENTAL_CONFIG_DIR:-$HOME/carrental-config}"
[ -f "$CONFIG_DIR/monitor.env" ] && . "$CONFIG_DIR/monitor.env"

BASE_URL="${MONITOR_BASE_URL:-https://localhost}"
DISK_MAX="${MONITOR_DISK_MAX:-85}"
BACKUP_HOURS="${MONITOR_BACKUP_HOURS:-30}"
NAME="${MONITOR_NAME:-$(hostname)}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/carrental-backups}"
STATE_FILE="${MONITOR_STATE_FILE:-$CONFIG_DIR/monitor.state}"
CONTAINERS="${MONITOR_CONTAINERS:-carrental-db-1 carrental-api-1 carrental-web-1 carrental-nginx-1}"
QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

problems=()
note() { problems+=("$1"); }

http_code() { curl -sk -o /dev/null -m 10 -w '%{http_code}' "$1" 2>/dev/null || echo 000; }

code="$(http_code "$BASE_URL/")"
[ "$code" = "200" ] || note "Trang web trả $code (mong đợi 200)"

code="$(http_code "$BASE_URL/api/health")"
[ "$code" = "200" ] || note "API /api/health trả $code (mong đợi 200)"

for container in $CONTAINERS; do
  state="$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || echo "không tồn tại")"
  if [ "$state" != "running" ]; then
    note "Container $container: $state"
    continue
  fi
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container" 2>/dev/null)"
  [ "$health" = "unhealthy" ] && note "Container $container: unhealthy"
done

used="$(df -P / | awk 'NR==2 { gsub("%", "", $5); print $5 }')"
if [ -n "$used" ] && [ "$used" -ge "$DISK_MAX" ]; then
  note "Đĩa đã dùng ${used}% (ngưỡng ${DISK_MAX}%)"
fi

# Chỉ kiểm tra bản sao lưu khi máy này có cài sao lưu (có thư mục). Máy chưa cài thì không báo động giả.
if [ -d "$BACKUP_DIR" ]; then
  latest="$(ls -1t "$BACKUP_DIR"/carrental-2*.dump 2>/dev/null | head -n 1)"
  if [ -z "$latest" ]; then
    note "Chưa có bản sao lưu CSDL nào trong $BACKUP_DIR"
  else
    age_hours=$(( ( $(date +%s) - $(stat -c %Y "$latest") ) / 3600 ))
    [ "$age_hours" -gt "$BACKUP_HOURS" ] && note "Bản sao lưu CSDL mới nhất đã ${age_hours} giờ tuổi (ngưỡng ${BACKUP_HOURS} giờ)"
  fi
fi

now="$(date '+%Y-%m-%d %H:%M:%S')"
if [ "${#problems[@]}" -eq 0 ]; then
  current="OK"
  [ "$QUIET" -eq 0 ] && echo "$now OK: web, API, container, đĩa (${used:-?}%) và sao lưu đều ổn"
else
  current="$(printf '%s; ' "${problems[@]}")"
  echo "$now CÓ VẤN ĐỀ: $current"
fi

previous="$(cat "$STATE_FILE" 2>/dev/null || echo "OK")"
if [ "$current" != "$previous" ]; then
  mkdir -p "$(dirname "$STATE_FILE")"
  printf '%s' "$current" > "$STATE_FILE"
  if [ -n "${MONITOR_WEBHOOK_URL:-}" ]; then
    if [ "$current" = "OK" ]; then text="[$NAME] Đã ổn trở lại."; else text="[$NAME] $current"; fi
    # Discord đọc trường "content", Slack đọc "text": gửi cả hai để dùng được với cả hai loại webhook.
    payload="$(printf '%s' "$text" | python3 -c 'import json,sys; t=sys.stdin.read(); print(json.dumps({"content": t, "text": t}))' 2>/dev/null)"
    if [ -n "$payload" ]; then
      curl -s -m 10 -H "Content-Type: application/json" -d "$payload" "$MONITOR_WEBHOOK_URL" >/dev/null 2>&1 \
        || echo "$now Không gửi được cảnh báo tới webhook"
    fi
  fi
fi

[ "$current" = "OK" ]
