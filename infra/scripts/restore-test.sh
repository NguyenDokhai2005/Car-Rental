#!/usr/bin/env bash
# Thử khôi phục một bản sao lưu vào một database TẠM, kiểm tra nội dung, rồi xóa database tạm.
# KHÔNG đụng tới database thật. Một bản sao lưu chưa từng thử khôi phục thì chưa thể coi là bản sao lưu.
#
# Dùng: bash restore-test.sh                 (thử bản mới nhất)
#       bash restore-test.sh /đường/dẫn/file.dump
#
# Biến môi trường: BACKUP_DIR, DB_CONTAINER, DB_USER giống backup-db.sh.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/carrental-backups}"
DB_CONTAINER="${DB_CONTAINER:-carrental-db-1}"
DB_USER="${DB_USER:-carrental}"
FILE="${1:-$BACKUP_DIR/carrental-latest.dump}"
TEST_DB="carrental_restore_test"

# Các bảng bắt buộc phải có sau khi khôi phục (SPEC §5). Thêm bảng mới vào đây khi mở rộng schema.
REQUIRED_TABLES="users refresh_tokens vehicles vehicle_images vehicle_blocks bookings payments license_access_logs"
# Ràng buộc quan trọng nhất: nếu mất, hệ thống có thể đặt trùng lịch.
REQUIRED_CONSTRAINTS="bookings_no_overlap vehicle_blocks_no_overlap"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }
fail() { log "LỖI: $*"; exit 1; }

[ -s "$FILE" ] || fail "không tìm thấy file sao lưu hoặc file rỗng: $FILE"
docker inspect -f '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null | grep -q true || fail "container $DB_CONTAINER không chạy."

psql_admin() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -tA "$@"; }
psql_test()  { docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$TEST_DB" -v ON_ERROR_STOP=1 -tA "$@"; }

cleanup() { psql_admin -c "DROP DATABASE IF EXISTS $TEST_DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

log "Thử khôi phục $(basename "$(readlink -f "$FILE" 2>/dev/null || echo "$FILE")") vào database tạm $TEST_DB"
psql_admin -c "DROP DATABASE IF EXISTS $TEST_DB" -c "CREATE DATABASE $TEST_DB" >/dev/null

# --exit-on-error: gặp lỗi đầu tiên là dừng, không âm thầm bỏ qua phần hỏng.
docker exec -i "$DB_CONTAINER" pg_restore -U "$DB_USER" -d "$TEST_DB" --exit-on-error < "$FILE" \
  || fail "pg_restore báo lỗi. Bản sao lưu này KHÔNG dùng được để khôi phục."

errors=0
for table in $REQUIRED_TABLES; do
  present="$(psql_test -c "select to_regclass('public.$table') is not null")"
  if [ "$present" != "t" ]; then log "THIẾU bảng: $table"; errors=$((errors + 1)); fi
done
for constraint in $REQUIRED_CONSTRAINTS; do
  present="$(psql_test -c "select count(*) from pg_constraint where conname = '$constraint'")"
  if [ "$present" != "1" ]; then log "THIẾU ràng buộc: $constraint"; errors=$((errors + 1)); fi
done
[ "$errors" -eq 0 ] || fail "bản khôi phục thiếu $errors mục cần thiết."

log "Số dòng sau khi khôi phục:"
for table in $REQUIRED_TABLES; do
  printf '    %-22s %s\n' "$table" "$(psql_test -c "select count(*) from $table")"
done

log "XONG: bản sao lưu khôi phục được và đủ bảng, đủ ràng buộc. Đã xóa database tạm."
