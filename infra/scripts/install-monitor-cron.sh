#!/usr/bin/env bash
# Cài lịch giám sát bằng cron trên máy chủ: mỗi 5 phút chạy monitor.sh, ghi vào ~/carrental-config/monitor.log.
# Script được chép sang ~/carrental-config/bin/ (đường dẫn cố định) vì thư mục checkout của runner bị dọn mỗi lần deploy;
# ci-deploy.sh tự cập nhật bản chép này sau mỗi lần deploy.
#
# Dùng: bash infra/scripts/install-monitor-cron.sh            cài hoặc cập nhật (chạy lại nhiều lần vẫn an toàn)
#       bash infra/scripts/install-monitor-cron.sh --remove   gỡ lịch
#
# Muốn nhận cảnh báo: tạo ~/carrental-config/monitor.env với dòng MONITOR_WEBHOOK_URL=... (xem docs/runbook.md).
set -euo pipefail

cd "$(dirname "$0")"

CONFIG_DIR="$HOME/carrental-config"
BIN_DIR="$CONFIG_DIR/bin"
MARK="# carrental-monitor"
LINE="*/5 * * * * $BIN_DIR/monitor.sh --quiet >> $CONFIG_DIR/monitor.log 2>&1 $MARK"

current="$(crontab -l 2>/dev/null | grep -vF "$MARK" || true)"

if [ "${1:-}" = "--remove" ]; then
  printf '%s\n' "$current" | crontab -
  echo "Đã gỡ lịch giám sát."
  exit 0
fi

mkdir -p "$BIN_DIR"
install -m 755 monitor.sh "$BIN_DIR/"
printf '%s\n%s\n' "$current" "$LINE" | sed '/^$/d' | crontab -
echo "Đã cài: mỗi 5 phút chạy $BIN_DIR/monitor.sh, log ở $CONFIG_DIR/monitor.log"
echo "Chạy thử ngay: $BIN_DIR/monitor.sh"
