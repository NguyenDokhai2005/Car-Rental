#!/usr/bin/env bash
# Sao lưu ảnh xe tải lên (volume uploads) thành một file tar, kiểm tra bản sao rồi xoay vòng bản cũ.
# Đi cặp với backup-db.sh: CSDL chỉ lưu đường dẫn ảnh, file ảnh nằm ở volume, nên mất một trong hai là mất ảnh.
# Chạy bằng cron (xem install-backup-cron.sh) hoặc tay: bash backup-uploads.sh
#
# Biến môi trường (đều có giá trị mặc định cho máy chủ production):
#   BACKUP_DIR         nơi lưu bản sao              mặc định $HOME/carrental-backups
#   BACKUP_KEEP        số bản giữ lại               mặc định 7
#   UPLOADS_CONTAINER  container đang gắn volume    mặc định carrental-api-1
#   UPLOADS_PATH       đường dẫn ảnh trong container mặc định /data/uploads
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/carrental-backups}"
KEEP="${BACKUP_KEEP:-7}"
CONTAINER="${UPLOADS_CONTAINER:-carrental-api-1}"
UPLOADS_PATH="${UPLOADS_PATH:-/data/uploads}"

umask 077
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

# Khóa riêng, không dùng chung với backup-db.sh để hai việc không cản nhau.
if command -v flock >/dev/null 2>&1; then
  exec 9>"$BACKUP_DIR/.lock-uploads"
  flock -n 9 || { log "LỖI: đang có một lần sao lưu ảnh khác chạy."; exit 1; }
fi

if ! docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true; then
  log "LỖI: container $CONTAINER không chạy."
  exit 1
fi

stamp="$(date '+%Y%m%d-%H%M%S')"
final="$BACKUP_DIR/uploads-$stamp.tar"
partial="$final.partial"
trap 'rm -f "$partial"' EXIT

log "Bắt đầu sao lưu ảnh từ $CONTAINER:$UPLOADS_PATH"
# Không nén (gzip): ảnh đã là WebP, nén thêm gần như không nhỏ đi mà tốn CPU.
# Chạy trong container API vì volume đang gắn ở đó, không cần kéo thêm image nào về.
docker exec "$CONTAINER" tar -C "$UPLOADS_PATH" -cf - . > "$partial"

# Kiểm tra: đọc lại được mục lục. Thư mục ảnh rỗng (chưa ai tải ảnh) là hợp lệ, nên không bắt buộc có file.
if ! tar -tf "$partial" > /dev/null; then
  log "LỖI: không đọc lại được bản sao lưu (file hỏng)."
  exit 1
fi
files="$(tar -tf "$partial" | grep -vc '/$' || true)"

mv "$partial" "$final"
ln -sfn "$(basename "$final")" "$BACKUP_DIR/uploads-latest.tar" 2>/dev/null || cp -f "$final" "$BACKUP_DIR/uploads-latest.tar"

# shellcheck disable=SC2012
ls -1t "$BACKUP_DIR"/uploads-2*.tar 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
  rm -f "$old"
  log "Đã xóa bản cũ: $(basename "$old")"
done

size="$(du -h "$final" | cut -f1)"
count="$(ls -1 "$BACKUP_DIR"/uploads-2*.tar | wc -l | tr -d ' ')"
log "XONG: $(basename "$final") ($size, ${files:-0} ảnh). Đang giữ $count bản."
