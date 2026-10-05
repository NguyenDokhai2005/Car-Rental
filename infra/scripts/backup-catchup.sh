#!/usr/bin/env bash
# Sao lưu BÙ: nếu hôm nay chưa có bản sao lưu nào thì sao lưu ngay (CSDL, rồi ảnh), sau đó thử khôi phục.
#
# Vì sao cần: lịch chính chạy lúc 03:00, nhưng cron không chạy bù. Máy chủ tắt hoặc bị tạm dừng (suspend) lúc 03:00 thì hôm
# đó không có bản sao lưu nào, và nếu máy chỉ bật ban ngày thì KHÔNG BAO GIỜ có. Script này được cron gọi mỗi giờ từ 04:17
# đến 23:17 (xem install-backup-cron.sh):
#   - Máy bật liên tục: 03:00 đã sao lưu, script thấy hôm nay có bản rồi nên thoát ngay.
#   - Máy chỉ bật ban ngày: lần gọi đầu tiên sau khi bật máy sẽ sao lưu, mỗi ngày đúng một lần.
# Gọi theo giờ (không dùng @reboot) để cả trường hợp tạm dừng rồi chạy tiếp, vốn không phải khởi động lại, cũng được bù.
#
# Biến môi trường: BACKUP_DIR, DB_CONTAINER, UPLOADS_CONTAINER như các script sao lưu;
#   BACKUP_WAIT_SECONDS  thời gian tối đa chờ các container sẵn sàng sau khi bật máy   mặc định 600
set -euo pipefail

BIN_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/carrental-backups}"
DB_CONTAINER="${DB_CONTAINER:-carrental-db-1}"
UPLOADS_CONTAINER="${UPLOADS_CONTAINER:-carrental-api-1}"
WAIT_SECONDS="${BACKUP_WAIT_SECONDS:-600}"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

# Tên file sao lưu có ngày theo giờ của máy (carrental-AAAAMMDD-GGPPSS.dump), nên chỉ cần tìm file của hôm nay.
today="$(date '+%Y%m%d')"
if compgen -G "$BACKUP_DIR/carrental-$today-*.dump" > /dev/null; then
  exit 0 # hôm nay đã có bản sao lưu: không làm gì và không ghi nhật ký, để nhật ký không đầy dòng "bỏ qua" mỗi giờ
fi

# Ngay sau khi bật máy, Docker cần thời gian để dựng lại các container. "healthy" (nếu container có healthcheck) mới chắc là
# PostgreSQL đã nhận kết nối; container không có healthcheck thì chỉ cần đang chạy.
ready() {
  local state
  state="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Running}}{{end}}' "$1" 2>/dev/null || true)"
  [ "$state" = "healthy" ] || [ "$state" = "true" ]
}

waited=0
until ready "$DB_CONTAINER" && ready "$UPLOADS_CONTAINER"; do
  if [ "$waited" -ge "$WAIT_SECONDS" ]; then
    log "LỖI: sao lưu bù không chạy được vì $DB_CONTAINER hoặc $UPLOADS_CONTAINER chưa sẵn sàng sau ${WAIT_SECONDS} giây. Sẽ thử lại ở lần gọi sau."
    exit 1
  fi
  sleep 10
  waited=$((waited + 10))
done

log "Hôm nay chưa có bản sao lưu nào: chạy sao lưu bù."
# Thứ tự như lịch chính: CSDL trước, ảnh sau (xem docs/backup.md), rồi thử khôi phục để biết bản vừa tạo dùng được.
"$BIN_DIR/backup-db.sh"
"$BIN_DIR/backup-uploads.sh"
"$BIN_DIR/restore-test.sh"
log "XONG: sao lưu bù hoàn tất."
