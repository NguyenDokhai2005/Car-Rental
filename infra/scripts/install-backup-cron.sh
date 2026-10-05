#!/usr/bin/env bash
# Cài lịch sao lưu tự động bằng cron trên máy chủ:
#   03:00 hằng ngày        sao lưu PostgreSQL (backup-db.sh), giữ 7 bản
#   03:05 hằng ngày        sao lưu ảnh xe tải lên (backup-uploads.sh), giữ 7 bản. Chạy SAU bản CSDL: nếu có người tải
#                          ảnh giữa hai lần chạy thì ảnh chỉ nằm thừa ở bản ảnh (vô hại). Chiều ngược lại thì CSDL
#                          nhắc tới một ảnh không có trong bản sao lưu, xe sẽ hiện ảnh hỏng sau khi khôi phục.
#   03:30 Chủ nhật hằng tuần  thử khôi phục bản mới nhất, cả CSDL lẫn ảnh (restore-test.sh)
#   phút 17, từ 04 đến 23 giờ  sao lưu BÙ nếu hôm nay chưa có bản nào (backup-catchup.sh). Cron không chạy bù, nên máy tắt
#                          hoặc bị tạm dừng lúc 03:00 thì hôm đó không có bản sao lưu; máy chỉ bật ban ngày thì không
#                          bao giờ có. Máy bật liên tục thì dòng này không làm gì vì 03:00 đã sao lưu rồi.
#
# Script được chép sang $HOME/carrental-config/bin/ (đường dẫn cố định) để cron không phụ thuộc thư mục checkout
# của runner, vốn bị dọn mỗi lần deploy. ci-deploy.sh tự cập nhật các bản chép này sau mỗi lần deploy.
#
# Dùng: bash infra/scripts/install-backup-cron.sh            cài hoặc cập nhật (chạy lại nhiều lần vẫn an toàn)
#       bash infra/scripts/install-backup-cron.sh --dry-run  chỉ in ra việc sẽ làm
#       bash infra/scripts/install-backup-cron.sh --remove   gỡ lịch (không xóa các bản sao lưu đã có)
set -euo pipefail

cd "$(dirname "$0")"

BIN_DIR="$HOME/carrental-config/bin"
BACKUP_DIR="${BACKUP_DIR:-$HOME/carrental-backups}"
MARK="# carrental-backup"
BACKUP_LINE="0 3 * * * $BIN_DIR/backup-db.sh >> $BACKUP_DIR/backup.log 2>&1 $MARK"
UPLOADS_LINE="5 3 * * * $BIN_DIR/backup-uploads.sh >> $BACKUP_DIR/backup.log 2>&1 $MARK"
RESTORE_LINE="30 3 * * 0 $BIN_DIR/restore-test.sh >> $BACKUP_DIR/backup.log 2>&1 $MARK"
CATCHUP_LINE="17 4-23 * * * $BIN_DIR/backup-catchup.sh >> $BACKUP_DIR/backup.log 2>&1 $MARK"

mode="install"
case "${1:-}" in
  --dry-run) mode="dry" ;;
  --remove) mode="remove" ;;
  "") ;;
  *) echo "Tham số không hợp lệ: $1"; exit 1 ;;
esac

current="$(crontab -l 2>/dev/null || true)"
# Bỏ mọi dòng cũ của chúng ta (nhận ra bằng dấu $MARK) để chạy lại không bị lặp dòng.
others="$(printf '%s\n' "$current" | grep -vF "$MARK" || true)"

if [ "$mode" = "remove" ]; then
  printf '%s\n' "$others" | sed '/^$/d' | crontab -
  echo "Đã gỡ lịch sao lưu khỏi cron. Các bản sao lưu trong $BACKUP_DIR vẫn còn."
  exit 0
fi

new="$(printf '%s\n%s\n%s\n%s\n%s\n' "$others" "$BACKUP_LINE" "$UPLOADS_LINE" "$RESTORE_LINE" "$CATCHUP_LINE" | sed '/^$/d')"

# Mỗi dòng của chúng ta phải là: 5 trường thời gian, một dấu cách, rồi đường dẫn lệnh. Thiếu một dấu cách (đã từng xảy ra:
# "0/home/..." thay vì "0 /home/...") khiến cron từ chối cả crontab với thông báo khó hiểu "bad day-of-week". Kiểm tra ở đây
# để cả --dry-run cũng báo lỗi, không đợi tới lúc cài thật.
bad="$(printf '%s\n' "$new" | grep -F "$MARK" | grep -vE '^[0-9*/,-]+( [0-9*/,-]+){4} /' || true)"
if [ -n "$bad" ]; then
  echo "LỖI: dòng cron sai định dạng (thiếu dấu cách giữa lịch chạy và lệnh?):"
  printf '%s\n' "$bad"
  exit 1
fi

if [ "$mode" = "dry" ]; then
  echo "Sẽ chép backup-db.sh, backup-uploads.sh, restore-test.sh và backup-catchup.sh vào $BIN_DIR"
  echo "Crontab mới sẽ là:"
  printf '%s\n' "$new"
  exit 0
fi

mkdir -p "$BIN_DIR" "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
install -m 755 backup-db.sh backup-uploads.sh restore-test.sh backup-catchup.sh "$BIN_DIR/"
printf '%s\n' "$new" | crontab -

echo "Đã cài lịch sao lưu:"
crontab -l | grep -F "$MARK"
echo
if command -v systemctl >/dev/null 2>&1 && ! systemctl is-active --quiet cron 2>/dev/null; then
  echo "CẢNH BÁO: dịch vụ cron chưa chạy. Bật bằng: sudo systemctl enable --now cron"
fi
echo "Chạy thử ngay một lần: $BIN_DIR/backup-db.sh"
echo "Xem nhật ký:           tail -n 20 $BACKUP_DIR/backup.log"
