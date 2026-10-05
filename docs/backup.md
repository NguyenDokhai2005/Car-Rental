# Sao lưu và khôi phục dữ liệu (PostgreSQL và ảnh xe)

PLAN Ngày 6 và Ngày 8, SPEC §8: sao lưu cơ sở dữ liệu bằng `pg_dump` và ảnh xe tải lên bằng `tar` hằng ngày, giữ 7 bản mỗi loại, và **thử khôi phục thật**.

## Vì sao cần

Toàn bộ dữ liệu người dùng, xe, đơn và thanh toán nằm trong **một volume Docker trên một máy ảo**, và ảnh xe nằm ở một volume khác (`uploads`). CSDL chỉ lưu đường dẫn ảnh, không lưu ảnh: mất một trong hai thì xe mất ảnh. Máy ảo hỏng đĩa, bị xóa nhầm, hay một lệnh sai cũng có thể làm mất tất cả. Sao lưu là bảo hiểm duy nhất cho tình huống đó.

Nguyên tắc cần nhớ: **một bản sao lưu chưa từng được thử khôi phục thì chưa phải bản sao lưu.** Vì vậy hệ thống tự thử khôi phục mỗi tuần.

## Cách hoạt động

| Script (`infra/scripts/`) | Việc làm | Lịch |
| --- | --- | --- |
| `backup-db.sh` | `pg_dump` định dạng nén `-Fc`, kiểm tra bản sao đọc lại được, xoay vòng giữ 7 bản | 03:00 hằng ngày |
| `backup-uploads.sh` | Đóng gói thư mục ảnh xe thành file `tar` (không nén vì ảnh đã là WebP), kiểm tra đọc lại được, xoay vòng giữ 7 bản | 03:05 hằng ngày, **sau** bản CSDL |
| `restore-test.sh` | Khôi phục bản CSDL mới nhất vào một database **tạm**, kiểm tra đủ bảng và đủ ràng buộc chống đặt trùng. Nếu có bản ảnh thì giải nén thử và đối chiếu: mọi ảnh mà CSDL nhắc tới có file thật không. Rồi xóa database và thư mục tạm. Không đụng dữ liệu thật | 03:30 Chủ nhật hằng tuần |
| `backup-catchup.sh` | Sao lưu **bù**: nếu hôm nay chưa có bản sao lưu nào thì chạy `backup-db.sh`, `backup-uploads.sh` rồi `restore-test.sh`; có rồi thì thoát ngay | Phút 17 mỗi giờ, từ 04 đến 23 giờ |
| `install-backup-cron.sh` | Cài hoặc gỡ bốn dòng cron ở trên | Chạy tay một lần |

Chi tiết quan trọng:

- **Bản dở dang không bao giờ bị nhầm với bản hợp lệ.** Script ghi vào file `.partial` rồi mới đổi tên sau khi kiểm tra (CSDL: file không rỗng và `pg_restore --list` đọc được mục lục; ảnh: `tar -t` đọc được). Mất điện hay hết ổ đĩa giữa chừng thì file dở bị xóa.
- **Máy tắt hoặc tạm dừng lúc 03:00 vẫn có bản sao lưu.** Cron không chạy bù: bỏ lỡ 03:00 là hôm đó không có gì, và máy chỉ bật ban ngày thì không bao giờ có. Vì vậy `backup-catchup.sh` chạy mỗi giờ và sao lưu ngay khi thấy hôm nay chưa có bản nào (chờ tối đa 10 phút cho các container sẵn sàng sau khi bật máy). Máy bật liên tục thì dòng này không làm gì, vì 03:00 đã sao lưu. Gọi theo giờ chứ không dùng `@reboot` để cả trường hợp tạm dừng (suspend) rồi chạy tiếp cũng được bù.
- **Không chạy chồng nhau:** dùng `flock`, lần chạy thứ hai báo lỗi thay vì ghi đè. Sao lưu CSDL và sao lưu ảnh dùng hai khóa riêng nên không cản nhau.
- **Vì sao ảnh sao lưu sau CSDL:** hai bản không chụp cùng một khoảnh khắc. Nếu có người tải ảnh giữa hai lần chạy, bản ảnh (chạy sau) có thêm một ảnh mà bản CSDL chưa biết: chỉ là file thừa, vô hại. Làm ngược lại thì CSDL nhắc tới một ảnh không có trong bản sao lưu, và xe sẽ hiện ảnh hỏng sau khi khôi phục.
- **Quyền riêng tư:** thư mục và file sao lưu chỉ chủ sở hữu đọc được (`700` và `600`), vì bản CSDL chứa email, số điện thoại, mật khẩu đã băm của người dùng.
- Nơi lưu: `~/carrental-backups/`, tên file `carrental-AAAAMMDD-GGPPSS.dump` và `uploads-AAAAMMDD-GGPPSS.tar`; `carrental-latest.dump` và `uploads-latest.tar` luôn trỏ tới bản mới nhất. Nhật ký: `~/carrental-backups/backup.log`.
- Cron gọi các script ở `~/carrental-config/bin/` (đường dẫn cố định), không gọi trong thư mục checkout của runner vì thư mục đó bị dọn mỗi lần deploy. `ci-deploy.sh` tự cập nhật các bản chép này sau mỗi lần deploy.
- Sao lưu ảnh chạy lệnh `tar` **bên trong container API** (nơi volume `uploads` đang được gắn), nên không cần kéo thêm image nào về máy chủ.

## Cài đặt trên máy ảo (làm một lần)

Điều kiện: PR chứa phần sao lưu đã được merge và lần Deploy đã chạy (để mã mới có trong thư mục của runner). SSH vào máy ảo:

```bash
cd ~/actions-runner/_work/Car-Rental/Car-Rental
bash infra/scripts/install-backup-cron.sh --dry-run     # xem trước việc sẽ làm
bash infra/scripts/install-backup-cron.sh               # cài thật
```

Đã cài từ trước thì chạy lại lệnh cài thật ở trên: script an toàn khi chạy lại và sẽ thêm các dòng còn thiếu (sao lưu ảnh, sao lưu bù). `--dry-run` phải in ra **bốn** dòng có `# carrental-backup`.

Kiểm tra cron đang chạy và chạy thử ngay các script:

```bash
systemctl is-active cron                    # phải ra "active"
~/carrental-config/bin/backup-db.sh         # sao lưu CSDL thử
~/carrental-config/bin/backup-uploads.sh    # sao lưu ảnh thử
~/carrental-config/bin/restore-test.sh      # khôi phục thử (cả CSDL lẫn ảnh)
```

Kết quả đúng của lệnh cuối: các dòng đếm số dòng của từng bảng, dòng `Ảnh: N file trong bản sao lưu, CSDL nhắc tới N ảnh, thiếu 0` và dòng `XONG: đã khôi phục thử xong`. Con số **thiếu phải là 0** trên máy chủ thật (không có dữ liệu mẫu). Nếu khác 0, script in `CẢNH BÁO`: xem lại giờ chạy của hai bản sao lưu.

Sáng hôm sau xem lịch đã chạy chưa:

```bash
tail -n 8 ~/carrental-backups/backup.log
ls -lh ~/carrental-backups/
```

## Sao lưu ra ngoài máy ảo (quan trọng)

Bản sao lưu ở trên nằm **cùng ổ đĩa với chính cơ sở dữ liệu**. Nếu máy ảo hỏng hoặc bị xóa thì mất cả hai. Cần ít nhất một bản nằm ở **nơi khác**.

**Cách đơn giản: kéo về máy Windows.** Cần SSH bằng khóa (không hỏi mật khẩu): dán nội dung `carrental.pub` vào `~/.ssh/authorized_keys` trên máy ảo. Rồi tạo file `D:\Backups\pull-backup.ps1`:

```powershell
$dest = "D:\Backups"
New-Item -ItemType Directory -Force $dest | Out-Null
$day = Get-Date -Format yyyyMMdd
scp -i "$HOME\.ssh\carrental" ubuntu@192.168.205.129:~/carrental-backups/carrental-latest.dump "$dest\carrental-$day.dump"
scp -i "$HOME\.ssh\carrental" ubuntu@192.168.205.129:~/carrental-backups/uploads-latest.tar "$dest\uploads-$day.tar"
# Giữ 14 bản gần nhất của mỗi loại ở Windows
foreach ($pattern in "carrental-*.dump", "uploads-*.tar") {
  Get-ChildItem "$dest\$pattern" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 14 | Remove-Item
}
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

**Khôi phục ảnh** (khi mất volume `uploads`, hoặc dựng máy mới). Chạy khi API đang chạy; `tar` giải nén trong container API nên file thuộc đúng người dùng `node`:

```bash
docker exec -i carrental-api-1 tar -C /data/uploads -xf - < ~/carrental-backups/uploads-latest.tar
```

Lệnh này chỉ thêm và ghi đè file có trong bản sao lưu, không xóa file khác. Dùng bản ảnh **cùng ngày** với bản CSDL đã khôi phục.

**Trường hợp 2: mất cả máy ảo.** Dựng máy ảo mới, cài Docker, đặt lại `~/carrental-config/.env.production`, chạy hệ thống bằng `init-selfsigned.sh` (như `deploy-vmware.md`). Chép file `.dump` và `.tar` lấy từ máy Windows vào máy ảo bằng `scp`, rồi làm đúng các bước ở trường hợp 1, kèm bước khôi phục ảnh.

## Giới hạn hiện tại

| Giới hạn | Hệ quả |
| --- | --- |
| Sao lưu mỗi ngày một lần | Khi sự cố có thể mất tối đa dữ liệu của gần 24 giờ, gồm cả ảnh mới tải lên trong ngày. Nếu máy tắt cả ngày thì hôm đó không có bản sao lưu (cũng không có dữ liệu mới) |
| Ảnh được sao lưu nguyên bộ mỗi ngày | Mỗi bản `tar` chứa toàn bộ ảnh, giữ 7 bản nên tốn khoảng 7 lần dung lượng ảnh. Ảnh đã nén WebP (khoảng 20 đến 600 KB), vài trăm ảnh vẫn chỉ vài chục MB. Nếu sau này lên hàng chục GB thì chuyển sang sao lưu gia tăng (chỉ chép file mới) hoặc kho đối tượng |
| Ảnh GPLX | Chưa có (PLAN Ngày 20). Khi làm, GPLX nằm ở kho riêng nên cần bổ sung sao lưu riêng, có mã hóa |
| Chưa mã hóa bản sao lưu | Giữ trên máy bạn thì ổn; nếu đưa ra ngoài phải tự mã hóa (xem trên) |
| Không khôi phục về thời điểm bất kỳ trong ngày | Cần bật lưu nhật ký giao dịch (WAL) nếu sau này cần |

## Lỗi thường gặp

| Triệu chứng | Nguyên nhân và cách xử lý |
| --- | --- |
| `LỖI: container carrental-db-1 không chạy` | Hệ thống đang dừng. Kiểm tra `docker ps`; tên container khác thì đặt biến `DB_CONTAINER` |
| `LỖI: container carrental-api-1 không chạy` | Như trên nhưng cho sao lưu ảnh (ảnh nằm ở volume gắn vào container API); đổi bằng biến `UPLOADS_CONTAINER` |
| `LỖI: đang có một lần sao lưu khác chạy` | Lần trước chưa xong hoặc bị treo. Xem `ps aux \| grep backup-` |
| Cron không chạy | `systemctl is-active cron`; nếu không, `sudo systemctl enable --now cron`. Xem `backup.log` |
| `LỖI: sao lưu bù không chạy được vì ... chưa sẵn sàng` | Sau khi bật máy, các container chưa lên kịp trong 10 phút. Lần gọi giờ sau sẽ tự thử lại; nếu lặp lại mãi thì xem `docker ps` |
| `permission denied` khi chạy `docker` từ cron | Người dùng chưa thuộc nhóm `docker` (`groups`). Thêm bằng `sudo usermod -aG docker $USER` rồi đăng nhập lại |
| `restore-test.sh` báo `CẢNH BÁO: N ảnh có trong CSDL nhưng không có trong bản sao lưu ảnh` | Trên máy phát triển là bình thường (dữ liệu mẫu trỏ tới file không có thật). Trên máy chủ thật phải là 0: kiểm tra `uploads-latest.tar` có cũ hơn `carrental-latest.dump` không, và `crontab -l` có đủ hai dòng 03:00 và 03:05 |
| `restore-test.sh` báo `giải nén bản sao lưu ảnh bị lỗi` | Bản `tar` hỏng. Chạy `backup-uploads.sh` lại và điều tra nguyên nhân (ổ đĩa đầy?) |
| `restore-test.sh` báo thiếu bảng hoặc ràng buộc | Bản sao lưu thiếu dữ liệu. Chạy `backup-db.sh` lại và điều tra nguyên nhân; nếu vừa thêm bảng mới vào schema, cập nhật danh sách `REQUIRED_TABLES` trong script |
| Ổ đĩa đầy | Bản CSDL vài chục KB đến vài MB; bản ảnh lớn hơn (xem giới hạn trên). Kiểm tra `df -h`, `du -sh ~/carrental-backups` và `docker system df` |
