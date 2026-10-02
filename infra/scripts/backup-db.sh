#!/usr/bin/env bash
# Sao lưu PostgreSQL của Car-Rental bằng pg_dump (định dạng nén -Fc), kiểm tra bản sao rồi xoay vòng bản cũ.
# SPEC §8: hằng ngày, giữ 7 bản. Chạy bằng cron (xem install-backup-cron.sh) hoặc tay: bash backup-db.sh
#
# Biến môi trường (đều có giá trị mặc định cho máy chủ production):
#   BACKUP_DIR      nơi lưu bản sao         mặc định $HOME/carrental-backups
#   BACKUP_KEEP     số bản giữ lại          mặc định 7
#   DB_CONTAINER    container PostgreSQL    mặc định carrental-db-1
#   DB_USER         người dùng PostgreSQL   mặc định carrental
#   DB_NAME         tên database            mặc định carrental
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/carrental-backups}"
KEEP="${BACKUP_KEEP:-7}"
DB_CONTAINER="${DB_CONTAINER:-carrental-db-1}"
DB_USER="${DB_USER:-carrental}"
DB_NAME="${DB_NAME:-carrental}"

# Bản sao chứa email, số điện thoại và mật khẩu đã băm của người dùng: chỉ chủ sở hữu được đọc.
umask 077
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

# Không cho hai lần sao lưu chạy chồng nhau (ví dụ một lần chạy lâu, lần cron kế tiếp đã tới).
if command -v flock >/dev/null 2>&1; then
  exec 9>"$BACKUP_DIR/.lock"
  flock -n 9 || { log "LỖI: đang có một lần sao lưu khác chạy."; exit 1; }
fi

if ! docker inspect -f '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null | grep -q true; then
  log "LỖI: container $DB_CONTAINER không chạy."
  exit 1
fi

stamp="$(date '+%Y%m%d-%H%M%S')"
final="$BACKUP_DIR/carrental-$stamp.dump"
partial="$final.partial"
# Ghi vào file tạm rồi mới đổi tên: bản dở dang (mất điện, hết ổ đĩa) không bao giờ bị nhầm là bản sao hợp lệ.
trap 'rm -f "$partial"' EXIT

log "Bắt đầu sao lưu $DB_NAME từ $DB_CONTAINER"
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -Fc "$DB_NAME" > "$partial"

# Kiểm tra bản sao: không rỗng và đọc lại được mục lục (nếu file hỏng, pg_restore --list sẽ lỗi).
if [ ! -s "$partial" ]; then
  log "LỖI: file sao lưu rỗng."
  exit 1
fi
entries="$(docker exec -i "$DB_CONTAINER" pg_restore --list < "$partial" | grep -c ' TABLE DATA ')" || true
if [ "${entries:-0}" -lt 1 ]; then
  log "LỖI: không đọc được bảng dữ liệu nào trong bản sao."
  exit 1
fi

mv "$partial" "$final"
# Đường dẫn cố định tới bản mới nhất, tiện cho khôi phục và cho việc chép ra ngoài máy.
ln -sfn "$(basename "$final")" "$BACKUP_DIR/carrental-latest.dump" 2>/dev/null || cp -f "$final" "$BACKUP_DIR/carrental-latest.dump"

# Xoay vòng: giữ KEEP bản mới nhất, xóa phần còn lại.
# shellcheck disable=SC2012
ls -1t "$BACKUP_DIR"/carrental-2*.dump 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
  rm -f "$old"
  log "Đã xóa bản cũ: $(basename "$old")"
done

size="$(du -h "$final" | cut -f1)"
count="$(ls -1 "$BACKUP_DIR"/carrental-2*.dump | wc -l | tr -d ' ')"
log "XONG: $(basename "$final") ($size, $entries bảng có dữ liệu). Đang giữ $count bản."
