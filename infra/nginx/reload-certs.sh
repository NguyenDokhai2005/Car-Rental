#!/bin/sh
# Chạy tự động trước khi Nginx khởi động (thư mục /docker-entrypoint.d của image).
# Tải lại cấu hình mỗi 6 giờ để Nginx nhận chứng chỉ mới sau khi certbot gia hạn.
( while :; do sleep 6h; nginx -s reload; done ) &
