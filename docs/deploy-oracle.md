# Triển khai trên Oracle Cloud (Always Free)

Hướng dẫn này thay phần tạo máy chủ (mục 2 và 4.1) của [deploy-guide.md](deploy-guide.md) khi dùng Oracle Cloud thay cho AWS. Sau khi máy chạy và cài Docker xong, bạn quay lại `deploy-guide.md` để làm các bước dùng chung: domain, lấy mã, cấu hình, build, HTTPS, vận hành.

Thông tin về giới hạn và chính sách miễn phí dưới đây là hiểu biết của mình tại thời điểm viết. Oracle có thể thay đổi, hãy đối chiếu trang Always Free chính thức của Oracle khi đăng ký.

## Lộ trình

| Bước | Làm ở đâu |
| --- | --- |
| 1. Đăng ký tài khoản Oracle Cloud | Mục 1 dưới đây |
| 2. Tạo máy ảo ARM | Mục 2 |
| 3. Mở cổng 80 và 443 (hai lớp tường lửa) | Mục 3 |
| 4. Kết nối SSH và cài Docker | Mục 4 |
| 5. Trỏ domain về máy | `deploy-guide.md` mục 3 |
| 6. Lấy mã, cấu hình, build, HTTPS, kiểm tra, vận hành | `deploy-guide.md` mục 5 đến 9 |

## 1. Đăng ký tài khoản

Vào trang Oracle Cloud Free Tier và chọn đăng ký. Việc xác minh thanh toán của Oracle khá chặt; nhiều người bị từ chối ngay bước này. Để giảm nguy cơ:

- Dùng **thẻ ghi tên chính bạn**, địa chỉ thanh toán khớp với ngân hàng. Thẻ tín dụng thường dễ qua hơn thẻ ghi nợ hoặc thẻ ảo.
- **Không bật VPN** khi đăng ký; dùng trình duyệt thường, không chế độ ẩn danh nếu gặp lỗi.
- Khai tên, địa chỉ, số điện thoại **thật và nhất quán** ở mọi ô.
- Oracle thường giữ tạm một khoản nhỏ để kiểm tra thẻ rồi hoàn lại. Đây là bình thường.
- Nếu báo lỗi xử lý giao dịch, đừng thử liên tục nhiều lần. Đợi một thời gian rồi thử lại, hoặc dùng thẻ khác.

> Tài khoản AWS của bạn đã bị khóa. Đừng tạo nhiều tài khoản Oracle để lách; việc đó dễ khiến cả hai bị khóa. Nếu bị từ chối, hãy liên hệ bộ phận hỗ trợ của Oracle.

**Chọn Home region cẩn thận, vì không đổi được sau này.** Chọn region gần Việt Nam, ví dụ Singapore, Tokyo, Seoul hoặc Hyderabad, nơi còn sẵn tài nguyên ARM. Máy Always Free chỉ tạo được trong Home region.

Sau khi vào được Console, mở **Billing → Budgets** và đặt ngân sách 1 đến 5 USD kèm cảnh báo email, đề phòng vô tình tạo tài nguyên có phí. Tài nguyên miễn phí vĩnh viễn được gắn nhãn **Always Free**; chỉ tạo loại có nhãn này.

## 2. Tạo máy ảo

Trước hết tạo khóa SSH trên Windows (bỏ qua nếu đã có từ bước AWS):

```powershell
ssh-keygen -t ed25519 -f $HOME\.ssh\carrental -C "carrental-oracle"
```

Trong Console: **Compute → Instances → Create instance**.

| Mục | Chọn |
| --- | --- |
| Name | `carrental-prod` |
| Image | Bấm *Change image* → **Canonical Ubuntu 24.04** |
| Shape | Bấm *Change shape* → tab **Ampere** → **VM.Standard.A1.Flex**, đặt **2 OCPU và 12 GB RAM** |
| Networking | *Create new virtual cloud network* và *Create new public subnet* (mặc định), bật **Automatically assign public IPv4 address** |
| SSH keys | *Paste public keys* → dán nội dung file `carrental.pub` |
| Boot volume | **50 GB** (gói miễn phí cho tổng khoảng 200 GB ổ đĩa) |

Vì sao 2 OCPU và 12 GB: dư sức cho cả stack (db, api, web, nginx), và còn lại một nửa hạn mức ARM miễn phí cho việc khác sau này. Nếu cần, bạn có thể chọn 4 OCPU và 24 GB.

Bấm **Create**. Khi máy chuyển sang trạng thái *Running*, ghi lại **Public IP address**, gọi là `<IP>`.

### Nếu báo "Out of host capacity"

Đây là lỗi rất thường gặp với máy ARM miễn phí: Oracle hết chỗ trong Availability Domain đó. Thử lần lượt:

1. Chọn **Availability Domain khác** ở mục Placement (nếu region có nhiều AD).
2. Giảm cấu hình xuống 1 OCPU và 6 GB RAM, tạo được rồi tăng sau (có thể chỉnh trên máy đang chạy).
3. Thử lại vào giờ khác trong ngày (đêm và sáng sớm theo giờ của region thường dễ hơn).
4. Nhiều người báo rằng nâng tài khoản lên **Pay As You Go** giúp tạo được máy dễ hơn mà vẫn miễn phí khi chỉ dùng tài nguyên Always Free. Chỉ làm nếu bạn chấp nhận tài khoản gắn thẻ và đã đặt Budget cảnh báo ở mục 1.
5. Phương án cuối: máy **VM.Standard.E2.1.Micro** (AMD, 1 GB RAM) cũng miễn phí và ít bị hết chỗ hơn, nhưng yếu như EC2 `t3.micro`; khi đó phải tạo swap theo `deploy-guide.md` mục 4.1.

### IP cố định (khuyên dùng)

IP công khai mặc định giữ nguyên khi khởi động lại máy, chỉ mất khi xóa máy. Để chắc hơn, gán **Reserved public IP** (miễn phí cho một IP đang gắn vào máy): *Networking → IP management → Reserved public IPs → Create*, rồi vào máy → *Attached VNICs → IPv4 addresses → Edit* và gán IP đó. Làm xong thì dùng IP mới này.

## 3. Mở cổng 80 và 443

Oracle có **hai lớp tường lửa**, phải mở cả hai. Quên lớp thứ hai là lỗi phổ biến nhất khiến Let's Encrypt báo timeout.

### Lớp 1: Security List của mạng (VCN)

*Networking → Virtual cloud networks →* chọn VCN của máy *→ Subnets →* chọn subnet *→ Security Lists →* chọn danh sách mặc định *→ Add Ingress Rules*. Thêm hai quy tắc:

| Source CIDR | IP Protocol | Destination Port Range |
| --- | --- | --- |
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

Quy tắc cổng 22 (SSH) đã có sẵn và đang mở cho mọi nơi. Muốn chặt hơn, sửa nguồn của quy tắc đó thành IP nhà bạn dạng `x.x.x.x/32` (nhớ sửa lại khi IP nhà đổi).

### Lớp 2: tường lửa trong máy (iptables)

Image Ubuntu của Oracle chặn mọi cổng ngoài SSH bằng iptables. SSH vào máy (mục 4) rồi chạy:

```bash
sudo iptables -L INPUT -n --line-numbers
```

Tìm số dòng của luật `REJECT` (thường là dòng 6 hoặc 7). Chèn hai luật cho phép **ngay trước dòng đó**. Ví dụ nếu `REJECT` nằm ở dòng 6:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Nếu báo `netfilter-persistent: command not found`, cài `sudo apt-get install -y iptables-persistent` rồi chạy lại lệnh `save` (chọn Yes khi hỏi lưu luật hiện tại).

Kiểm tra từ máy bạn: `Test-NetConnection <IP> -Port 80` sẽ báo thất bại cho đến khi Nginx chạy (bước HTTPS); lúc đó cổng mở đúng sẽ thành công. Nếu thấy lỗi `timeout` khi cấp chứng chỉ, quay lại kiểm tra cả hai lớp.

## 4. Kết nối và cài Docker

```powershell
ssh -i $HOME\.ssh\carrental ubuntu@<IP>
```

Tài khoản mặc định của image Ubuntu trên Oracle là `ubuntu`. Rồi:

```bash
uname -m              # phải ra aarch64 nếu dùng máy ARM
sudo apt-get update && sudo apt-get upgrade -y
```

Cài Docker theo **đúng các lệnh ở `deploy-guide.md` mục 4.2** (không cần chỉnh gì: lệnh tự nhận kiến trúc ARM). Nhớ đăng xuất, đăng nhập lại để dùng `docker` không cần `sudo`, rồi kiểm tra `docker --version && docker compose version`.

Máy ARM 12 GB RAM **không cần tạo swap**, bỏ qua mục 4.1 của `deploy-guide.md`.

## 5. Tiếp tục theo deploy-guide.md

Làm lần lượt: **mục 3** (trỏ domain), **mục 5** (lấy mã và cấu hình), **mục 6** (build; không cần `COMPOSE_PARALLEL_LIMIT=1` và build nhanh hơn nhiều), **mục 7** (HTTPS), **mục 8** (kiểm tra), **mục 9** (vận hành).

Khác biệt cần nhớ khi đọc `deploy-guide.md`:

- Nơi nói "security group" thì ở Oracle là **Security List cộng với iptables** (mục 3 ở trên).
- Nơi nói `t3.micro`, 1 GB RAM, swap: bỏ qua. Máy của bạn mạnh hơn nhiều.
- Có thể nới giới hạn bộ nhớ trong `infra/docker-compose.prod.yml` cho thoải mái: tăng `mem_limit` của `api` và `web` lên `1g`, và `--max-old-space-size` trong `NODE_OPTIONS` lên `768`. Không bắt buộc.
- Mục "snapshot EBS" tương ứng với **Boot volume backup** của Oracle (*Storage → Boot Volumes → chọn volume → Create Manual Backup*). Gói miễn phí có hạn mức bản sao lưu nhất định, hãy kiểm tra trên trang Always Free.

## 6. Rủi ro riêng của Oracle

| Rủi ro | Cách giảm |
| --- | --- |
| Máy bị **thu hồi** vì nhàn rỗi lâu (Oracle có chính sách như vậy cho tài nguyên Always Free dùng rất ít) | Máy có web, API, PostgreSQL chạy thường xuyên thường đủ hoạt động. Lên Pay As You Go vẫn miễn phí trong hạn mức và nhiều người cho rằng giảm rủi ro này |
| Tài khoản bị khóa hoặc dừng | **Luôn có bản sao lưu bên ngoài Oracle**: chạy `pg_dump` (xem `deploy-guide.md` mục 9) và tải về máy bạn bằng `scp` định kỳ. PLAN Ngày 6 sẽ tự động hóa việc này |
| Hết chỗ ARM khi cần dựng lại máy | Giữ lại máy cũ chạy được thì đừng xóa. Bản sao lưu DB cộng mã trong GitHub đủ để dựng lại ở nơi khác |
| Chỉ có một nhà cung cấp miễn phí | Hãy giữ `infra/` và Dockerfile độc lập với nhà cung cấp (đã như vậy), để chuyển sang nơi khác chỉ mất vài giờ |

### Nếu Oracle cũng không đăng ký được

Các phương án miễn phí khác đều có điều kiện riêng, nên hãy tự đọc kỹ trước khi chọn:

- **Google Cloud**: gói Always Free có một máy `e2-micro` (1 GB RAM) ở một số region Mỹ. Máy yếu và xa Việt Nam, nhưng dùng được cho giai đoạn thử nghiệm với swap.
- **Máy tại nhà** (mini PC, máy cũ) kèm dịch vụ đường hầm như Cloudflare Tunnel: không phải mở cổng router, nhưng phụ thuộc điện và mạng nhà bạn. Chỉ phù hợp để thử.

Với bất kỳ nền tảng nào, toàn bộ stack Docker Compose trong repo chạy giống nhau; chỉ phần tạo máy, mở cổng và cài Docker khác.
