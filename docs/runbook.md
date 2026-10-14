# Runbook vận hành Car-Rental

Sổ tay xử lý sự cố cho hai máy chủ: máy ảo VMware (`192.168.205.129`) và server cloud (`207.148.75.230`, `ssh cloud`).
Mỗi mục đi theo thứ tự: **dấu hiệu → kiểm tra → xử lý**. Tài liệu liên quan: [ci-cd.md](ci-cd.md), [backup.md](backup.md), [deploy-cloud.md](deploy-cloud.md).

Trong tài liệu này, `COMPOSE` là viết tắt của:

```bash
cd ~/car-rental
COMPOSE="docker compose -f infra/docker-compose.prod.yml --env-file $HOME/carrental-config/.env.production"
```

## Kiểm tra nhanh trong 1 phút

```bash
~/carrental-config/bin/monitor.sh     # web, API, container, đĩa, bản sao lưu
$COMPOSE ps                           # trạng thái từng container
df -h / && free -m                    # đĩa và RAM
```

`monitor.sh` in `OK` hoặc liệt kê từng vấn đề. Mã thoát 0 là ổn, 1 là có vấn đề.

## Giám sát và cảnh báo

- **Cài (làm một lần trên mỗi máy chủ):** `bash infra/scripts/install-monitor-cron.sh`. Cron chạy `monitor.sh` mỗi 5 phút, log ở `~/carrental-config/monitor.log`.
- **Nhận cảnh báo:** tạo webhook miễn phí (Discord: Server Settings → Integrations → Webhooks; hoặc Slack Incoming Webhook), rồi tạo file `~/carrental-config/monitor.env`:

  ```bash
  MONITOR_WEBHOOK_URL=https://discord.com/api/webhooks/...
  MONITOR_NAME=cloud
  ```

  Đặt quyền `chmod 600 ~/carrental-config/monitor.env`. URL webhook là bí mật: ai có nó cũng gửi được tin vào kênh của bạn, nên không commit và không dán vào chat.
- **Khi nào có tin:** chỉ khi trạng thái đổi (ổn → lỗi, lỗi → ổn, lỗi này → lỗi khác). Sự cố kéo dài không gửi lặp lại.
- **Giới hạn:** `monitor.sh` chạy trên chính máy chủ, nên nếu cả máy chết hoặc mất mạng thì không có ai gửi cảnh báo. Muốn bắt được trường hợp đó cần một dịch vụ kiểm tra từ bên ngoài (ví dụ UptimeRobot bản miễn phí) gọi `https://<địa chỉ>/api/health`. Máy ảo VMware chỉ có IP nội bộ nên không dùng được cách này.

## Log

```bash
$COMPOSE logs --tail 100 api          # API (lỗi 5xx có stack trace ở đây, không trả ra cho người dùng)
$COMPOSE logs --tail 100 web nginx
$COMPOSE logs -f api                  # theo dõi trực tiếp, Ctrl+C để thoát
tail -50 ~/carrental-config/monitor.log
tail -50 ~/carrental-backups/backup.log
```

Mỗi container giữ tối đa 3 file log x 10 MB (cấu hình `x-logging` trong `docker-compose.prod.yml`), nên log không làm đầy đĩa nhưng cũng chỉ còn vài ngày gần nhất.

## Sự cố thường gặp

### Trang web trả 502 Bad Gateway

Nginx chạy nhưng `web` hoặc `api` chưa trả lời.

1. `$COMPOSE ps`: container nào không `healthy`?
2. Máy vừa khởi động lại: chờ khoảng 1 phút, các container tự lên (đã gặp trên máy ảo VMware ngày 2026-10-11).
3. Vẫn lỗi: `$COMPOSE logs --tail 50 api web` để tìm lý do, rồi `$COMPOSE up -d`.

### API không lên sau khi deploy

API chạy migration trước khi nhận request; migration lỗi thì API không khởi động (cố ý, để không chạy với CSDL sai cấu trúc).

1. `$COMPOSE logs --tail 80 api`.
2. Thấy `PRIVATE_UPLOAD_DIR ... không được trùng hay lồng nhau`: hai thư mục lưu file bị cấu hình lồng nhau. Sửa trong compose hoặc `.env.production`.
3. Thấy lỗi migration: **không** sửa migration đã commit. Sửa bằng một migration mới, hoặc quay về bản trước (mục dưới).

### Deploy (GitHub Actions) báo đỏ

1. Mở lần chạy trên GitHub → job của máy bị lỗi → bước "Deploy". Script in sẵn trạng thái container và 30 dòng log cuối.
2. Hỏng trong vài giây đầu của bước build: thường do đĩa đầy (`df -h /`, `docker system df`) hoặc mất mạng trong máy ảo. Dọn bằng `docker builder prune -f`, rồi bấm **Re-run failed jobs**. Chỉ job hỏng chạy lại, máy còn lại không bị đụng tới.
3. Hỏng ở bước chờ `healthy`: xem log container tương ứng.

### Quay về bản trước (rollback)

Deploy luôn lấy mã của commit vừa vào `main`. Cách quay về an toàn là **revert trên GitHub** để CI/CD tự deploy lại:

```bash
git revert -m 1 <mã merge commit>     # tạo commit đảo ngược, không xóa lịch sử
git push origin main
```

Lưu ý: revert mã **không** đảo ngược migration CSDL. Nếu bản bị revert có migration, mã cũ có thể không chạy được với CSDL mới; khi đó hãy sửa tiến (viết migration mới) thay vì quay lui.

### Đĩa sắp đầy

```bash
df -h /
docker system df                      # image, container, volume, cache build chiếm bao nhiêu
du -sh ~/carrental-backups
docker builder prune -f               # xóa cache build (an toàn, lần build sau chậm hơn)
docker image prune -f                 # xóa image không còn dùng
```

**Không** chạy `docker volume prune` hay `docker system prune --volumes`: volume chứa CSDL (`pgdata`), ảnh xe (`uploads`) và ảnh GPLX (`private_uploads`).

### Mất dữ liệu hoặc cần khôi phục CSDL

Làm theo [backup.md, mục "Khôi phục khi có sự cố"](backup.md#khôi-phục-khi-có-sự-cố). Khôi phục ghi đè toàn bộ CSDL hiện tại, nên phải chắc bản sao lưu đúng trước khi chạy. Ảnh GPLX hiện **chưa** nằm trong bản sao lưu.

### Chứng chỉ HTTPS

- **Có domain (Let's Encrypt):** container `certbot` tự gia hạn. Kiểm tra: `$COMPOSE logs --tail 30 certbot`.
- **Dùng IP (chứng chỉ tự ký, như server cloud hiện tại):** trình duyệt luôn cảnh báo, đây là hành vi đúng. Hết hạn thì chạy lại `bash infra/scripts/init-selfsigned.sh`.

### Runner GitHub Actions không nhận việc

```bash
sudo systemctl status 'actions.runner.*'
sudo systemctl restart 'actions.runner.*'
```

Trên GitHub: Settings → Actions → Runners phải thấy runner ở trạng thái *Idle*.

## Thao tác quản trị

- **Khóa hoặc mở tài khoản, duyệt xe, duyệt GPLX:** làm trên trang quản trị (`/admin`), không sửa tay trong CSDL.
- **Người dùng quên mật khẩu:** hệ thống chưa gửi được email/SMS. Quản trị viên mở `/admin/users`, vào trang chi tiết của người đó và bấm **Đặt lại mật khẩu**; mật khẩu tạm chỉ hiện một lần, báo cho người dùng qua điện thoại và nhắc họ đổi lại ở trang hồ sơ. Xác minh đúng người trước khi đặt lại (ví dụ gọi lại số điện thoại đã đăng ký).
- **Gỡ xe, hủy đơn có tranh chấp:** làm ở `/admin/vehicles` và `/admin/bookings`, luôn kèm lý do (chủ xe và khách đọc được). Khi hủy đơn, admin chọn phần trăm tiền thuê hoàn cho khách; tiền cọc luôn hoàn đủ.
- **Xem ai đã can thiệp gì** (khóa, đặt lại mật khẩu, gỡ xe, hủy đơn). Bảng `admin_actions` chỉ thêm dòng, không sửa hay xóa được:

  ```bash
  $COMPOSE exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select a.created_at, u.email as admin, a.action, a.reason, a.details from admin_actions a join users u on u.id = a.admin_id order by a.created_at desc limit 20"'
  ```
- **Xem ai đã mở ảnh GPLX:**

  ```bash
  $COMPOSE exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select l.accessed_at, a.email as nguoi_xem, t.email as ho_so_cua, l.ip_address from license_access_logs l join users a on a.id = l.actor_id join users t on t.id = l.target_user_id order by l.accessed_at desc limit 20"'
  ```

- **Thanh toán:** đang là giả lập (SPEC mục Thanh toán), không có tiền thật. Sổ tiền ở `/admin/bookings` là số liệu theo dõi.

## Trang kỹ thuật (`/dev`)

Dành cho vai trò `dev`: hiện trạng máy chủ, API, web và CSDL; nhật ký yêu cầu HTTP; log của API; lỗi JavaScript trên trình duyệt người dùng. Vai trò này không có quyền nghiệp vụ (không xem được người dùng, đơn, GPLX), và quản trị viên không vào được trang này.

- **Dữ liệu nằm trong bộ nhớ của API** (2.000 yêu cầu, 1.000 dòng log máy chủ, 500 lỗi trình duyệt): mỗi lần deploy hoặc khởi động lại API là mất. Cần log cũ hơn thì dùng `$COMPOSE logs api`.
- **Tạo tài khoản `dev` hoặc `admin`** (hai vai trò này không đăng ký được qua web). Script đọc mật khẩu từ biến môi trường; gõ lệnh với dấu cách ở đầu để shell không lưu vào lịch sử, và không dán mật khẩu vào nơi nào khác:

  ```bash
  ID=$($COMPOSE ps -q api)
  docker exec -u root "$ID" mkdir -p /app/scripts
  docker cp api/scripts/create-staff.mjs "$ID":/app/scripts/create-staff.mjs
   docker exec -w /app -e STAFF_ROLE=dev -e STAFF_EMAIL=ky-thuat@example.com -e STAFF_NAME="Họ Tên" \
    -e STAFF_PHONE=0901234567 -e STAFF_PASSWORD='mat-khau-dai-it-nhat-12-ky-tu' "$ID" node scripts/create-staff.mjs
  docker exec -u root "$ID" rm -rf /app/scripts
  ```

- **Mục Cơ sở dữ liệu** cho xem dữ liệu trong các bảng, chỉ đọc. Tài khoản `dev` vì thế thấy được dữ liệu khách hàng (họ tên, email, số điện thoại, đơn thuê); chỉ cấp cho người thật sự cần. Cột mật khẩu, token, số và đường dẫn ảnh GPLX luôn bị che. Xem ai đã tra cứu gì: `$COMPOSE logs api | grep "Xem dữ liệu bảng"`.
- **Thu hồi quyền:** quản trị viên khóa tài khoản đó ở `/admin/users`; tài khoản bị khóa mất quyền ngay ở yêu cầu kế tiếp.
- Phần "Frontend (Web)" báo sự cố trong khi trang web vẫn mở được: kiểm tra biến `WEB_INTERNAL_URL` của container API (mặc định trong compose là `http://web:3000`).

## Việc định kỳ

| Tần suất | Việc |
| --- | --- |
| Hằng ngày (tự động) | Sao lưu CSDL và ảnh xe lúc 03:00; `monitor.sh` mỗi 5 phút |
| Hằng tuần (tự động) | Thử khôi phục bản sao lưu mới nhất (Chủ nhật 03:30) |
| Hằng tuần (tay) | Đọc `monitor.log` và `backup.log`; chép bản sao lưu ra ngoài máy chủ |
| Hằng tháng (tay) | `pnpm audit --prod`; cập nhật hệ điều hành (`sudo apt update && sudo apt upgrade`); xem `df -h /` |

## Việc còn tồn

- Ảnh GPLX (volume `private_uploads`) chưa được sao lưu.
- Chưa có giám sát từ bên ngoài máy chủ (xem mục Giám sát).
- Chưa có Content-Security-Policy cho toàn trang (mới có cho `/uploads/`).
- Server cloud chưa cài cron sao lưu (chưa có thư mục `~/carrental-backups`): chạy `bash infra/scripts/install-backup-cron.sh`.
