# Sao lưu và khôi phục PostgreSQL

PLAN Ngày 6, SPEC §8: sao lưu cơ sở dữ liệu hằng ngày bằng `pg_dump`, giữ 7 bản, và **thử khôi phục thật**.

## Vì sao cần

Toàn bộ dữ liệu người dùng, xe, đơn và thanh toán nằm trong **một volume Docker trên một máy ảo**. Máy ảo hỏng đĩa, bị xóa nhầm, hay một lệnh sai cũng có thể làm mất tất cả. Sao lưu là bảo hiểm duy nhất cho tình huống đó.

Nguyên tắc cần nhớ: **một bản sao lưu chưa từng được thử khôi phục thì chưa phải bản sao lưu.** Vì vậy hệ thống tự thử khôi phục mỗi tuần.

## Cách hoạt động

| Script (`infra/scripts/`) | Việc làm | Lịch |
| --- | --- | --- |
| `backup-db.sh` | `pg_dump` định dạng nén `-Fc`, kiểm tra bản sao đọc lại được, xoay vòng giữ 7 bản | 03:00 hằng ngày |
| `restore-test.sh` | Khôi phục bản mới nhất vào một database **tạm**, kiểm tra đủ bảng và đủ ràng buộc chống đặt trùng, rồi xóa database tạm. Không đụng database thật | 03:30 Chủ nhật hằng tuần |
| `install-backup-cron.sh` | Cài hoặc gỡ hai dòng cron ở trên | Chạy tay một lần |

Chi tiết quan trọng:

- **Bản dở dang không bao giờ bị nhầm với bản hợp lệ.** Script ghi vào file `.partial` rồi mới đổi tên sau khi kiểm tra: file không rỗng và `pg_restore --list` đọc được mục lục. Mất điện hay hết ổ đĩa giữa chừng thì file dở bị xóa.
- **Không chạy chồng nhau:** dùng `flock`, lần chạy thứ hai báo lỗi thay vì ghi đè.
- **Quyền riêng tư:** thư mục và file sao lưu chỉ chủ sở hữu đọc được (`700` và `600`), vì chứa email, số điện thoại, mật khẩu đã băm của người dùng.
- Nơi lưu: `~/carrental-backups/`, tên file `carrental-AAAAMMDD-GGPPSS.dump`, và `carrental-latest.dump` luôn trỏ tới bản mới nhất. Nhật ký: `~/carrental-backups/backup.log`.
- Cron gọi các script ở `~/carrental-config/bin/` (đường dẫn cố định), không gọi trong thư mục checkout của runner vì thư mục đó bị dọn mỗi lần deploy. `ci-deploy.sh` tự cập nhật các bản chép này sau mỗi lần deploy.

## Cài đặt trên máy ảo (làm một lần)

Điều kiện: PR chứa phần sao lưu đã được merge và lần Deploy đã chạy (để mã mới có trong thư mục của runner). SSH vào máy ảo:

```bash
cd ~/actions-runner/_work/Car-Rental/Car-Rental
bash infra/scripts/install-backup-cron.sh --dry-run     # xem trước việc sẽ làm
bash infra/scripts/install-backup-cron.sh               # cài thật
```

Kiểm tra cron đang chạy và chạy thử ngay hai script:

```bash
systemctl is-active cron                    # phải ra "active"
~/carrental-config/bin/backup-db.sh         # sao lưu thử
~/carrental-config/bin/restore-test.sh      # khôi phục thử
```

Kết quả đúng của lệnh cuối: các dòng đếm số dòng của từng bảng và dòng `XONG: bản sao lưu khôi phục được...`.

Sáng hôm sau xem lịch đã chạy chưa:

```bash
tail -n 5 ~/carrental-backups/backup.log
ls -lh ~/carrental-backups/
```

## Sao lưu ra ngoài máy ảo (quan trọng)

Bản sao lưu ở trên nằm **cùng ổ đĩa với chính cơ sở dữ liệu**. Nếu máy ảo hỏng hoặc bị xóa thì mất cả hai. Cần ít nhất một bản nằm ở **nơi khác**.

**Cách đơn giản: kéo về máy Windows.** Cần SSH bằng khóa (không hỏi mật khẩu): dán nội dung `carrental.pub` vào `~/.ssh/authorized_keys` trên máy ảo. Rồi tạo file `D:\Backups\pull-backup.ps1`:

```powershell
$dest = "D:\Backups"
New-Item -ItemType Directory -Force $dest | Out-Null
$name = "carrental-$(Get-Date -Format yyyyMMdd).dump"
scp -i "$HOME\.ssh\carrental" ubuntu@192.168.205.129:~/carrental-backups/carrental-latest.dump "$dest\$name"
# Giữ 14 bản gần nhất ở Windows
Get-ChildItem "$dest\carrental-*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 14 | Remove-Item
```

Đặt lịch chạy hằng ngày lúc 04:00 (PowerShell quyền Administrator):

```powershell
$action  = New-ScheduledTaskAction -Execute "powershell.exe" -Argument '-NoProfile -ExecutionPolicy Bypass -File "D:\Backups\pull-backup.ps1"'
$trigger = New-ScheduledTaskTrigger -Daily -At 4am
Register-ScheduledTask -TaskName "Keo ban sao luu Car-Rental" -Action $action -Trigger $trigger
```

Lưu ý: máy Windows và máy ảo vẫn **cùng một máy vật lý**. Hỏng ổ đĩa hay mất máy là mất cả hai. Để an toàn thật sự, chép thêm một bản lên nơi ngoài hẳn (ổ cứng rời, hoặc kho đám mây như Google Drive).
**Bản sao chứa dữ liệu cá nhân của người dùng:** nén và đặt mật khẩu (ví dụ 7-Zip, AES-256) trước khi đưa lên đám mây.

## Khôi phục khi có sự cố

**Cảnh báo: các lệnh dưới đây xóa database hiện tại.** Chỉ làm khi thật sự cần, và trước đó chạy `backup-db.sh` để giữ lại trạng thái hiện tại nếu còn truy cập được.

**Trường hợp 1: database hỏng hoặc dữ liệu bị xóa nhầm, máy ảo vẫn còn.** SSH vào máy ảo:

```bash
cd ~/actions-runner/_work/Car-Rental/Car-Rental
DC="docker compose -f infra/docker-compose.prod.yml --env-file $HOME/carrental-config/.env.production"

$DC stop api                                                                   # ngừng ghi vào database
docker exec carrental-db-1 psql -U carrental -d postgres \
  -c "DROP DATABASE carrental" -c "CREATE DATABASE carrental"                  # tạo lại database trống
docker exec -i carrental-db-1 pg_restore -U carrental -d carrental --exit-on-error \
  < ~/carrental-backups/carrental-latest.dump                                  # nạp bản sao lưu
$DC start api
curl -sk https://localhost/api/me                                              # phải trả {"code":"UNAUTHORIZED",...}
```

Muốn quay về một ngày cụ thể thì thay `carrental-latest.dump` bằng tên file ngày đó. Bản sao đã chứa bảng `_prisma_migrations` nên API không chạy lại migration.

**Trường hợp 2: mất cả máy ảo.** Dựng máy ảo mới, cài Docker, đặt lại `~/carrental-config/.env.production`, chạy hệ thống bằng `init-selfsigned.sh` (như `deploy-vmware.md`). Chép file `.dump` lấy từ máy Windows vào máy ảo bằng `scp`, rồi làm đúng các bước ở trường hợp 1.

## Giới hạn hiện tại

| Giới hạn | Hệ quả |
| --- | --- |
| Sao lưu mỗi ngày một lần | Khi sự cố có thể mất tối đa dữ liệu của gần 24 giờ |
| Chỉ sao lưu PostgreSQL | **Ảnh xe tải lên (volume `carrental_uploads`) chưa được sao lưu.** Hiện chưa có tính năng tải ảnh (PLAN Ngày 8); cần bổ sung khi có |
| Chưa mã hóa bản sao lưu | Giữ trên máy bạn thì ổn; nếu đưa ra ngoài phải tự mã hóa (xem trên) |
| Không khôi phục về thời điểm bất kỳ trong ngày | Cần bật lưu nhật ký giao dịch (WAL) nếu sau này cần |

## Lỗi thường gặp

| Triệu chứng | Nguyên nhân và cách xử lý |
| --- | --- |
| `LỖI: container carrental-db-1 không chạy` | Hệ thống đang dừng. Kiểm tra `docker ps`; tên container khác thì đặt biến `DB_CONTAINER` |
| `LỖI: đang có một lần sao lưu khác chạy` | Lần trước chưa xong hoặc bị treo. Xem `ps aux | grep backup-db` |
| Cron không chạy | `systemctl is-active cron`; nếu không, `sudo systemctl enable --now cron`. Xem `backup.log` |
| `permission denied` khi chạy `docker` từ cron | Người dùng chưa thuộc nhóm `docker` (`groups`). Thêm bằng `sudo usermod -aG docker $USER` rồi đăng nhập lại |
| `restore-test.sh` báo thiếu bảng hoặc ràng buộc | Bản sao lưu thiếu dữ liệu. Chạy `backup-db.sh` lại và điều tra nguyên nhân; nếu vừa thêm bảng mới vào schema, cập nhật danh sách `REQUIRED_TABLES` trong script |
| Ổ đĩa đầy | Mỗi bản vài chục KB đến vài MB nên hiếm khi do sao lưu; kiểm tra `df -h` và `docker system df` |
