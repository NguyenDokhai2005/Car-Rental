# Triển khai trên máy ảo VMware (máy tại nhà)

Hướng dẫn chạy Car-Rental trong một máy ảo Ubuntu Server dưới **VMware Workstation** trên máy trạm của bạn, giữ chạy liên tục. Đây là cách luyện triển khai không tốn tiền và không phụ thuộc nhà cung cấp đám mây.

Hạn chế cần biết ngay từ đầu: đây là **máy tại nhà**, không phải server thật. Web ngừng khi mất điện, mất mạng hoặc khi bạn tắt máy. Nhà mạng Việt Nam hay chặn cổng hoặc dùng IP chia chung, nên người ngoài mạng nhà **không truy cập trực tiếp được**. Hướng dẫn này lo phần chạy trong mạng nhà (LAN); cho người ngoài xem cần thêm Cloudflare Tunnel (xem cuối tài liệu).

Các lệnh VMware và Task Scheduler dưới đây mình **chưa thử trên máy bạn**; phần Docker và triển khai đã được kiểm thử.

## Lộ trình

| Bước | Việc | Mốc hoàn thành |
| --- | --- | --- |
| 1 | Tạo máy ảo Ubuntu Server | Đăng nhập được vào máy ảo |
| 2 | SSH và cài Docker | `docker compose version` chạy được |
| 3 | Lấy mã và cấu hình | Có file `.env.production` |
| 4 | Build và chạy với HTTPS tự ký | Mở được `https://<IP-máy-ảo>` |
| 5 | Tự bật máy ảo cùng Windows | Khởi động lại Windows, web tự lên lại |
| 6 | Chỉnh Windows để chạy liên tục | Máy không ngủ khi gập nắp |

## 1. Tạo máy ảo

Tải **Ubuntu Server 24.04 LTS** (ISO, x86_64). Trong VMware Workstation: **File → New Virtual Machine → Typical**:

| Mục | Chọn |
| --- | --- |
| Cài từ | File ISO vừa tải |
| Guest OS | Linux → **Ubuntu 64-bit** |
| Tên và nơi lưu | `carrental`, đặt trên ổ SSD (ví dụ `D:\VMs\carrental`) |
| Ổ đĩa | **40 GB**, *Store virtual disk as a single file* |
| *Customize Hardware* | **RAM 4096 MB**, **2 CPU**, Network Adapter **Bridged** |

Bridged giúp máy ảo có IP riêng trong mạng nhà, các thiết bị khác truy cập được. Nếu máy trạm chỉ dùng Wi-Fi và bridged chập chờn, đổi sang NAT (khi đó chỉ truy cập được từ chính máy Windows qua cổng chuyển tiếp).

Trình cài đặt Ubuntu: giữ mặc định các bước ngôn ngữ, bàn phím, mạng (DHCP), mirror và ổ đĩa. Tên máy `carrental`, người dùng `ubuntu`, đặt mật khẩu. **Tick *Install OpenSSH server*.** Cài xong chọn Reboot.

**IP cố định:** vào trang quản trị router, đặt *DHCP reservation* gán IP cố định cho máy ảo theo địa chỉ MAC của nó, để IP không đổi.

## 2. SSH và cài Docker

Trong máy ảo chạy `ip a` để lấy IP (dạng `192.168.x.x`), gọi là `<IP>`. Từ PowerShell trên Windows:

```powershell
ssh ubuntu@<IP>
```

Cài Docker bằng đúng các lệnh ở `deploy-guide.md` **mục 4.2**. Máy ảo 4 GB RAM không cần tạo swap. Nhớ đăng xuất rồi đăng nhập lại để dùng `docker` không cần `sudo`.

## 3. Lấy mã và cấu hình

Lấy mã theo `deploy-guide.md` **mục 5.1** (deploy key và `git clone` nếu repo riêng tư; repo công khai thì `git clone https://...` là đủ). Rồi:

```bash
cd ~/car-rental
cp .env.production.example .env.production
chmod 600 .env.production
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
echo "JWT_ACCESS_SECRET=$(openssl rand -hex 48)"
nano .env.production
```

Điền như sau:

| Biến | Giá trị |
| --- | --- |
| `DOMAIN` | **IP của máy ảo**, ví dụ `192.168.1.50` (không có `https://`) |
| `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET` | Hai chuỗi hex vừa tạo ở trên |
| `LETSENCRYPT_EMAIL`, `LETSENCRYPT_STAGING` | Để nguyên, chế độ này không dùng |

## 4. Build và chạy với HTTPS chứng chỉ tự ký

Let's Encrypt cần tên miền thật và cổng 80 truy cập được từ Internet, nên không dùng được ở đây. Thay vào đó dùng chứng chỉ **tự ký**:

```bash
bash infra/scripts/init-selfsigned.sh
```

Script tạo chứng chỉ cho `DOMAIN` (có khai báo IP trong `subjectAltName`), rồi build và khởi động db, api, web, nginx. Lần đầu build mất khoảng 10 đến 20 phút. Migration chạy tự động khi API khởi động.

Mở `https://<IP>` trên máy Windows hoặc bất kỳ thiết bị nào cùng mạng. Trình duyệt hiện cảnh báo "kết nối không riêng tư" vì chứng chỉ không do tổ chức uy tín cấp; chọn **Nâng cao → Tiếp tục truy cập**. Cảnh báo này bình thường với chứng chỉ tự ký. Đăng nhập vẫn hoạt động vì kết nối vẫn là HTTPS.

Kiểm tra từ máy ảo:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file .env.production ps    # db, api, web phải (healthy)
curl -sk https://localhost/api/me      # {"code":"UNAUTHORIZED",...}: API sống và đang chặn người chưa đăng nhập
```

Mọi thao tác vận hành (log, cập nhật, sao lưu) làm theo `deploy-guide.md` **mục 9**, thay các lệnh Docker Compose bằng bản không có `micro`.

Container có `restart: unless-stopped` nên tự chạy lại khi máy ảo khởi động.

## 5. Tự bật máy ảo cùng Windows

VMware Workstation không tự chạy máy ảo khi Windows mới bật và chưa ai đăng nhập. Dùng **Task Scheduler** gọi `vmrun`. Mở PowerShell **với quyền Administrator**, sửa đường dẫn `.vmx` cho đúng:

```powershell
$vmx    = "D:\VMs\carrental\carrental.vmx"
$vmrun  = "C:\Program Files (x86)\VMware\VMware Workstation\vmrun.exe"
$cred   = Get-Credential          # tài khoản Windows của bạn
$action = New-ScheduledTaskAction -Execute $vmrun -Argument "-T ws start `"$vmx`" nogui"
$trig   = New-ScheduledTaskTrigger -AtStartup
$trig.Delay = "PT1M"              # đợi 1 phút cho dịch vụ VMware khởi động xong
Register-ScheduledTask -TaskName "CarRental VM" -Action $action -Trigger $trig `
  -User $cred.UserName -Password $cred.GetNetworkCredential().Password -RunLevel Highest
```

Kiểm tra: khởi động lại Windows, đợi vài phút, rồi chạy

```powershell
& "C:\Program Files (x86)\VMware\VMware Workstation\vmrun.exe" list
```

Phải thấy đường dẫn `.vmx` đang chạy, và `https://<IP>` mở được. Nếu không, xem lịch sử tác vụ trong Task Scheduler và gửi thông báo lỗi để được hỗ trợ.

## 6. Chỉnh Windows để chạy liên tục

PowerShell quyền Administrator:

```powershell
powercfg /change standby-timeout-ac 0                                # không ngủ khi cắm điện
powercfg /h off                                                      # tắt ngủ đông
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0     # gập nắp: không làm gì
powercfg /setactive SCHEME_CURRENT
```

Ngoài ra:

- **Windows Update:** đặt *Active hours* rộng nhất có thể để Windows không tự khởi động lại giữa ngày. Mỗi lần Windows khởi động lại, máy ảo tắt theo rồi tự bật lại nhờ bước 5 (web ngừng vài phút).
- **Pin:** cắm sạc liên tục làm pin chai. Nếu hãng có công cụ giới hạn sạc, đặt 60 đến 80%.
- **Tắt máy đúng cách:** trước khi tắt hoặc khởi động lại Windows, tắt máy ảo gọn bằng `vmrun -T ws stop "D:\VMs\carrental\carrental.vmx" soft`. Windows tắt đột ngột sẽ ngắt máy ảo như mất điện; PostgreSQL chịu được nhưng không nên làm thường xuyên.
- **Sao lưu:** dữ liệu nằm trong máy ảo trên một ổ đĩa. Chạy `pg_dump` định kỳ và chép ra ngoài (xem `deploy-guide.md` mục 9). PLAN Ngày 6 sẽ tự động hóa.

## Lỗi thường gặp

| Triệu chứng | Nguyên nhân và cách xử lý |
| --- | --- |
| Trình duyệt cảnh báo chứng chỉ | Bình thường với chứng chỉ tự ký. Chọn Nâng cao → Tiếp tục. Muốn hết cảnh báo thì phải có tên miền thật và Let's Encrypt |
| Không vào được `https://<IP>` từ thiết bị khác | Máy ảo đang dùng NAT thay vì Bridged, hoặc tường lửa Windows chặn. Kiểm tra mạng của máy ảo và chạy `ping <IP>` |
| IP máy ảo đổi sau khi khởi động lại | Chưa đặt DHCP reservation ở router. Đổi IP thì phải đổi `DOMAIN` và chạy lại `init-selfsigned.sh --force` |
| Đăng nhập xong nhưng không giữ phiên | Đang truy cập bằng `http://` hoặc bằng địa chỉ khác với `DOMAIN`. Cookie đăng nhập có cờ `Secure`, chỉ hoạt động trên HTTPS và đúng địa chỉ đã cấu hình |
| `docker build` rất chậm hoặc bị `Killed` | Máy ảo thiếu RAM hoặc CPU. Tăng RAM lên 6 GB hoặc thêm CPU trong cài đặt VMware (tắt máy ảo trước) |
| Máy ảo không tự bật sau khi khởi động lại Windows | Kiểm tra tác vụ `CarRental VM` trong Task Scheduler (đường dẫn `vmrun`, mật khẩu tài khoản Windows còn đúng) |

## Cho người ngoài mạng nhà truy cập (chưa làm)

Cách ít rủi ro nhất là **Cloudflare Tunnel**: máy ảo tự kết nối ra ngoài nên không phải mở cổng router, tránh được việc nhà mạng chặn cổng hay IP đổi liên tục. Cần một tên miền do Cloudflare quản lý DNS. Khi đó HTTPS do Cloudflare đảm nhận nên cấu hình Nginx của dự án cần thêm một chế độ chạy HTTP phía sau Tunnel. Phần này chưa được viết; hãy báo khi bạn cần.

Không nên mở cổng 80 và 443 thẳng từ router ra Internet: máy trạm của bạn nằm cùng mạng với các thiết bị khác, và dự án chứa giấy phép lái xe của người dùng.
