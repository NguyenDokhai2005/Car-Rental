# Hướng dẫn dựng server và triển khai Car-Rental

Mục tiêu (PLAN Ngày 5): **web chạy trên HTTPS với domain thật**, trên một máy chủ miễn phí.

> **Chọn nền tảng máy chủ:** tài liệu này làm trọn vẹn với **AWS EC2**. Nếu dùng **Oracle Cloud** (phương án dự phòng, ví dụ khi tài khoản AWS không dùng được), làm theo [deploy-oracle.md](deploy-oracle.md) cho phần tạo máy, mở cổng và cài Docker; sau đó quay lại đây làm **mục 3, 5, 6, 7, 8, 9**, các mục này dùng chung cho mọi nền tảng. Mục 2 (EC2) và 4.1 (swap) chỉ dành cho AWS.

Toàn bộ cấu hình đã nằm sẵn trong repo và đã được kiểm thử trên máy Windows có Docker (build image, chạy cả stack, định tuyến qua Nginx, migration tự chạy, đăng ký và đăng nhập qua HTTPS). Phần duy nhất chưa thử được ngoài máy chủ thật là bước Let's Encrypt cấp chứng chỉ, vì nó cần domain và DNS thật.

## 0. Tổng quan

```text
Trình duyệt ── https://domain ──▶ DNS ──▶ IP của máy chủ (EC2)
                                              │ cổng 80, 443
                                  ┌───────────▼────────────┐
                                  │ Docker Compose          │
                                  │  nginx ── /       ──▶ web  (Next.js, :3000)
                                  │     │      /api/    ──▶ api  (NestJS,  :4000) ──▶ db (PostgreSQL)
                                  │     │      /uploads/ ──▶ ổ đĩa ảnh xe (chỉ đọc)
                                  │  certbot: tự gia hạn chứng chỉ
                                  └─────────────────────────┘
```

| Container | Việc làm | Mở cổng ra ngoài? |
| --- | --- | --- |
| `nginx` | Nhận mọi request, kết thúc HTTPS, chuyển tiếp đến web hoặc API | Có: 80 và 443 |
| `web` | Giao diện Next.js | Không |
| `api` | NestJS; tự chạy migration khi khởi động | Không |
| `db` | PostgreSQL 16, dữ liệu trong volume `pgdata` | **Không** |
| `certbot` | Gia hạn chứng chỉ Let's Encrypt mỗi 12 giờ kiểm tra một lần | Không |

Các file liên quan trong repo:

| File | Việc |
| --- | --- |
| `infra/docker-compose.prod.yml` | Định nghĩa 5 container trên |
| `infra/nginx/default.conf.template` | Cấu hình Nginx (`${DOMAIN}` được thay lúc khởi động) |
| `api/Dockerfile`, `web/Dockerfile` | Đóng gói API và web |
| `infra/scripts/init-letsencrypt.sh` | Xin chứng chỉ HTTPS lần đầu |
| `infra/scripts/deploy.sh` | Cập nhật phiên bản mới |
| `.env.production.example` | Mẫu biến môi trường production |

Thứ tự làm: **1** chuẩn bị, **2** tạo EC2, **3** trỏ domain, **4** chuẩn bị máy chủ, **5** lấy mã và cấu hình, **6** build và chạy, **7** HTTPS, **8** kiểm tra.

---

## 1. Chuẩn bị

### 1.1 Tài khoản AWS

- Cần thẻ thanh toán quốc tế để đăng ký. Bật xác thực hai lớp (MFA) cho tài khoản gốc ngay.
- **Đặt cảnh báo chi phí trước khi tạo gì**: Billing → Budgets → tạo ngân sách 5 USD/tháng có gửi email.
- **Chính sách Free Tier hiện hành** (tài khoản tạo từ 15/7/2025, theo trang [AWS Free Tier FAQs](https://aws.amazon.com/free/faqs/)): tài khoản mới tự vào **Free plan**, kéo dài **tối đa 6 tháng hoặc đến khi hết tín dụng**, tùy cái nào đến trước. Bạn nhận **100 USD khi đăng ký** và có thể nhận thêm **tối đa 100 USD** khi hoàn thành các hoạt động khám phá dịch vụ (tổng tối đa 200 USD). Khi Free plan hết hạn, AWS **tạm khóa tài khoản** và bạn có khoảng **90 ngày** để nâng lên Paid plan, nếu không sẽ mất quyền truy cập. Free plan chỉ cho dùng một số dịch vụ và loại máy; EC2 hiện cho `t3.micro`, `t3.small`, `t4g.micro`, `t4g.small`, `c7i-flex.large`, `m7i-flex.large`. **Hãy ghi lại ngày hết hạn** và đặt nhắc lịch trước một tháng, vì hết hạn thì web ngừng chạy. Danh sách loại máy và điều kiện có thể đổi, hãy xem lại trong console khi tạo máy (nhãn *Free tier eligible*).
- Mỗi địa chỉ IPv4 công khai của AWS bị tính phí theo giờ (khoảng 3,6 USD/tháng nếu chạy liên tục), kể cả đang gắn vào máy. Với Free plan khoản này được trừ vào tín dụng, nên tín dụng của bạn sẽ hết dần theo tiền máy, ổ đĩa và địa chỉ IP. Theo dõi tại *Billing → Credits* và *Cost Explorer*.

### 1.2 Domain

Let's Encrypt chỉ cấp chứng chỉ cho tên miền, không cấp cho IP trần. Ba cách:

| Cách | Chi phí | Ghi chú |
| --- | --- | --- |
| Mua domain (`.com`, `.vn`...) ở nhà đăng ký như Namecheap, Porkbun, PA Vietnam | khoảng 10 USD/năm | Lâu dài, nên dùng khi ra mắt |
| Subdomain miễn phí của **DuckDNS** (`ten-ban.duckdns.org`) | 0 | Hợp ràng buộc chi phí $0 của dự án; đăng nhập duckdns.org, tạo subdomain, điền IP |
| `1-2-3-4.sslip.io` (tự trỏ về IP `1.2.3.4`) | 0 | Chỉ để thử nhanh; thường chạm giới hạn cấp chứng chỉ vì nhiều người dùng chung |

Cấu hình hiện tại phục vụ **một tên miền** (ví dụ `carrental.example.com`). Nếu dùng domain gốc, `www.` chưa được phục vụ.

### 1.3 Khóa SSH (trên máy Windows của bạn)

Mở PowerShell:

```powershell
ssh-keygen -t ed25519 -f $HOME\.ssh\carrental -C "carrental-aws"
```

Sinh ra hai file: `carrental` (khóa **riêng**, tuyệt đối không chia sẻ) và `carrental.pub` (khóa công khai, dán vào AWS).

---

## 2. Tạo máy chủ EC2

Vào AWS Console, chọn region gần Việt Nam (ví dụ **Asia Pacific (Singapore) ap-southeast-1**), rồi EC2 → **Launch instance**:

| Mục | Chọn |
| --- | --- |
| Name | `carrental-prod` |
| AMI | **Ubuntu Server 24.04 LTS** (64-bit x86) |
| Instance type | **`t3.small`** (2 GB RAM, x86) là lựa chọn khuyên dùng: đủ thoải mái cho cả stack. `t3.micro` (1 GB) rẻ hơn nhưng chật và phải tạo swap. Chỉ chọn loại có nhãn **Free tier eligible**. Tiền máy được trừ vào tín dụng, nên máy to hơn thì tín dụng hết nhanh hơn |
| Key pair | **Import key pair** → dán nội dung file `carrental.pub` (hoặc tạo key mới trong console) |
| Network settings | Tạo security group mới với 3 quy tắc: **SSH (22) nguồn "My IP"**, **HTTP (80) từ Anywhere**, **HTTPS (443) từ Anywhere** |
| Storage | **20 đến 30 GiB gp3** (image Docker và dữ liệu cần chỗ) |

Bấm Launch. Sau đó:

1. EC2 → **Elastic IPs** → *Allocate Elastic IP address* → chọn nó → *Associate* với `carrental-prod`. Elastic IP giữ địa chỉ cố định khi khởi động lại máy, nếu không DNS sẽ hỏng mỗi lần IP đổi.
2. Ghi lại IP này, gọi là `<IP>` bên dưới.

> Không bao giờ mở cổng 22 cho "Anywhere" lâu dài. IP nhà bạn đổi thì sửa lại quy tắc SSH trong security group.

---

## 3. Trỏ domain về máy chủ

Phải làm **trước** bước HTTPS, vì Let's Encrypt kiểm tra domain đang trỏ về máy bạn.

- **Domain mua**: ở trang quản lý DNS, tạo bản ghi **A**: tên `@` (hoặc subdomain bạn muốn như `app`), giá trị `<IP>`, TTL thấp (300 giây).
- **DuckDNS**: nhập `<IP>` vào ô current ip của subdomain rồi bấm update.

Kiểm tra (chạy trên máy bạn, có thể mất vài phút):

```powershell
nslookup carrental.example.com
```

Kết quả phải ra đúng `<IP>`.

---

## 4. Chuẩn bị máy chủ

Kết nối:

```powershell
ssh -i $HOME\.ssh\carrental ubuntu@<IP>
```

### 4.1 Cập nhật và tạo swap

Máy 1 GB RAM sẽ hết bộ nhớ khi build image nếu không có swap. Tạo 2 GB:

```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h        # dòng Swap phải là 2.0Gi
```

### 4.2 Cài Docker

Theo hướng dẫn chính thức của Docker cho Ubuntu:

```bash
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

**Đăng xuất rồi SSH lại** để quyền nhóm `docker` có hiệu lực, rồi kiểm tra:

```bash
docker --version && docker compose version
```

Lưu ý: Docker tự chèn luật mạng riêng và **bỏ qua tường lửa `ufw`**. Vì vậy hãy coi security group của AWS là tường lửa chính, và không công bố cổng nào ngoài 80, 443 trong Compose (cấu hình hiện tại đã đúng như vậy: PostgreSQL không có `ports`).

---

## 5. Lấy mã nguồn và cấu hình

### 5.1 Lấy mã

Repo riêng tư cần khóa triển khai (deploy key) chỉ đọc:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/deploy_key -N "" -C "carrental-server"
cat ~/.ssh/deploy_key.pub        # sao chép toàn bộ dòng này
```

Trên GitHub: repo → Settings → **Deploy keys** → Add deploy key, dán vào, **không** tick "Allow write access". Quay lại máy chủ:

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/deploy_key\n  IdentitiesOnly yes\n' >> ~/.ssh/config
git clone git@github.com:<tai-khoan>/<ten-repo>.git ~/car-rental
cd ~/car-rental
git checkout main        # nhánh chứa code cần triển khai
```

> Các nhánh `feat/database-schema`, `feat/auth`, `feat/deploy` cần được gộp vào `main` (qua PR) trước, hoặc bạn checkout thẳng nhánh `feat/deploy` để thử.

Đặt một lệnh tắt cho các lệnh Compose dài (thêm vào `~/.bashrc` để dùng lâu dài):

```bash
echo "alias dc='docker compose -f ~/car-rental/infra/docker-compose.prod.yml --env-file ~/car-rental/.env.production'" >> ~/.bashrc
source ~/.bashrc
```

Từ đây `dc ps` thay cho lệnh dài.

### 5.2 Biến môi trường

```bash
cd ~/car-rental
cp .env.production.example .env.production
chmod 600 .env.production        # chỉ chủ sở hữu đọc được
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
echo "JWT_ACCESS_SECRET=$(openssl rand -hex 48)"
nano .env.production
```

Điền vào file:

| Biến | Giá trị |
| --- | --- |
| `DOMAIN` | Domain của bạn, ví dụ `carrental.example.com` (không có `https://`) |
| `LETSENCRYPT_EMAIL` | Email thật, Let's Encrypt gửi cảnh báo sắp hết hạn vào đây |
| `LETSENCRYPT_STAGING` | Để `1` cho lần đầu (xem mục 7) |
| `POSTGRES_PASSWORD` | Chuỗi hex ở lệnh `echo` phía trên |
| `JWT_ACCESS_SECRET` | Chuỗi hex ở lệnh `echo` phía trên |

Không đặt các giá trị này ở đâu khác ngoài file này; **không commit** `.env.production` (đã nằm trong `.gitignore`). API từ chối khởi động nếu secret ngắn hơn 32 ký tự hoặc còn là `change-me`.

---

## 6. Build và chạy

Build image trên máy yếu rất chậm. Build **tuần tự** để không hết RAM (lần đầu khoảng 10 đến 20 phút trên 1 GB RAM):

```bash
cd ~/car-rental
COMPOSE_PARALLEL_LIMIT=1 dc build
```

Nếu thấy `Killed` hoặc `exit code 137`, máy hết bộ nhớ: kiểm tra swap (mục 4.1) hoặc xem mục 11. Phương án khác là build trên máy bạn rồi chuyển image lên (`docker save` và `docker load`); bước CI/CD ở PLAN Ngày 6 sẽ tự động hóa việc này.

Chưa cần `dc up` ngay; bước 7 sẽ khởi động cả stack.

---

## 7. HTTPS với Let's Encrypt

Điều kiện: domain đã trỏ đúng IP (mục 3), cổng 80 và 443 đã mở trong security group (mục 2).

### 7.1 Thử với staging trước (khuyên dùng)

Let's Encrypt giới hạn số lần xin thất bại và số chứng chỉ trùng. Cấu hình sai mà thử trực tiếp bằng chế độ thật thì dễ bị khóa vài giờ đến vài ngày. Chế độ staging không có giới hạn đó, chỉ khác là trình duyệt không tin chứng chỉ.

Với `LETSENCRYPT_STAGING=1` trong `.env.production`:

```bash
cd ~/car-rental
bash infra/scripts/init-letsencrypt.sh
```

Script làm 4 việc: tạo chứng chỉ tạm để Nginx khởi động được; bật Nginx (kéo theo db, api, web; api tự chạy migration); xóa chứng chỉ tạm rồi xin chứng chỉ thật qua cổng 80; tải lại Nginx. Khi xong sẽ in `Xong.`.

Thử: `curl -k -I https://<domain>` phải trả `HTTP/2 200` (`-k` bỏ qua lỗi tin cậy vì đang là chứng chỉ staging).

### 7.2 Chuyển sang chứng chỉ thật

```bash
cd ~/car-rental
sed -i 's/^LETSENCRYPT_STAGING=.*/LETSENCRYPT_STAGING=0/' .env.production
dc run --rm --entrypoint sh certbot -c 'rm -rf /etc/letsencrypt/*'
bash infra/scripts/init-letsencrypt.sh
```

Mở `https://<domain>` trong trình duyệt: phải có ổ khóa, không cảnh báo.

### 7.3 Gia hạn

Chứng chỉ Let's Encrypt sống 90 ngày. Container `certbot` tự kiểm tra mỗi 12 giờ và gia hạn khi còn dưới 30 ngày; Nginx tự tải lại cấu hình mỗi 6 giờ để nhận chứng chỉ mới. Bạn không phải làm gì, nhưng hãy thử một lần:

```bash
dc run --rm --entrypoint certbot certbot renew --dry-run     # phải báo "Congratulations, all simulated renewals succeeded"
dc run --rm --entrypoint certbot certbot certificates         # xem ngày hết hạn
```

---

## 8. Kiểm tra

```bash
dc ps                                    # db, api, web phải (healthy), nginx và certbot Up
curl -sI http://<domain> | head -3       # 301, Location: https://...
curl -sI https://<domain> | head -3      # 200
curl -s https://<domain>/api/me          # {"code":"UNAUTHORIZED",...}: API sống và đang chặn người chưa đăng nhập
free -h                                  # RAM và swap còn dư
```

Thử đăng ký rồi đăng nhập thật:

```bash
curl -s -X POST https://<domain>/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"thu@example.com","password":"MatKhau123","fullName":"Người Thử","phone":"0901234567","role":"renter"}'
```

Cổng PostgreSQL phải **không** truy cập được từ ngoài. Kiểm tra từ máy bạn: `Test-NetConnection <IP> -Port 5432` phải báo `TcpTestSucceeded : False`.

### Tạo tài khoản admin đầu tiên

Đăng ký không cho tự chọn admin (SPEC §7), và dữ liệu mẫu (`seed`) **không được chạy ở production**. Đăng ký một tài khoản bình thường qua trang web hoặc curl, rồi nâng quyền bằng SQL:

```bash
dc exec db psql -U carrental -d carrental \
  -c "UPDATE users SET role = 'admin' WHERE email = 'email-cua-ban@example.com';"
```

---

## 9. Vận hành hằng ngày

| Việc | Lệnh |
| --- | --- |
| Xem trạng thái | `dc ps` |
| Xem log (theo dõi) | `dc logs -f api` (thay `api` bằng `web`, `nginx`, `db`) |
| Khởi động lại một dịch vụ | `dc restart api` |
| **Cập nhật phiên bản mới** | `bash ~/car-rental/infra/scripts/deploy.sh` |
| Vào PostgreSQL | `dc exec db psql -U carrental -d carrental` |
| Sao lưu thủ công | `dc exec -T db pg_dump -U carrental -Fc carrental > ~/carrental-$(date +%F).dump` |
| Xem dung lượng Docker | `docker system df` |
| Dọn image cũ | `docker image prune -a -f` |

Ghi chú:

- `deploy.sh` kéo mã mới, build lại, khởi động lại dịch vụ thay đổi. **Migration tự chạy** khi container `api` khởi động; migration lỗi thì API không lên (tránh chạy với cấu trúc DB sai).
- **Quay về bản cũ**: `git checkout <commit>` rồi `deploy.sh`. Lưu ý migration **không tự lùi**; nếu bản mới đã thêm cột hay bảng, bản cũ vẫn chạy được với cấu trúc mới miễn là migration chỉ thêm. Hãy sao lưu trước khi deploy bản có migration lớn.
- Máy khởi động lại thì mọi container tự lên (đã đặt `restart: unless-stopped`; Docker tự chạy khi bật máy).
- Sao lưu tự động hằng ngày và thử khôi phục là việc của PLAN Ngày 6. Trong lúc đó, ít nhất hãy chụp snapshot EBS (EC2 → Volumes → Create snapshot) trước các thay đổi lớn.

### Danh sách an toàn

- [ ] MFA cho tài khoản AWS gốc; cảnh báo chi phí đã bật
- [ ] Security group: 22 chỉ từ IP của bạn; chỉ mở 80, 443
- [ ] `.env.production` quyền `600`, không nằm trong git
- [ ] PostgreSQL không có cổng công bố ra ngoài
- [ ] `LETSENCRYPT_STAGING=0` và trình duyệt hiện ổ khóa hợp lệ
- [ ] Đã thử `certbot renew --dry-run`
- [ ] Đã ghi lại ngày hết hạn của gói miễn phí

---

## 10. Phương án dự phòng: Oracle Cloud Always Free

Hướng dẫn đầy đủ từng bước (đăng ký, tạo máy ARM, mở cổng ở hai lớp tường lửa, cài Docker, rủi ro riêng) nằm ở **[deploy-oracle.md](deploy-oracle.md)**. Các image Docker của repo đã được kiểm tra build và chạy được trên kiến trúc ARM64 mà máy Oracle miễn phí tốt nhất sử dụng.

**Chuyển từ nền tảng này sang nền tảng khác:** sao lưu (`pg_dump`), dựng máy mới theo hướng dẫn, khôi phục (`pg_restore`) trước khi chuyển DNS. Hạ TTL của bản ghi DNS xuống 300 giây trước đó một ngày, rồi đổi IP.

---

## 11. Lỗi thường gặp

| Triệu chứng | Nguyên nhân và cách xử lý |
| --- | --- |
| Certbot báo `Timeout during connect` hoặc `Connection refused` | Cổng 80 bị chặn (security group, hoặc iptables trên Oracle) hoặc DNS chưa trỏ đúng. Kiểm tra `curl -I http://<domain>` từ **bên ngoài** |
| `too many failed authorizations` | Đã thử quá nhiều lần ở chế độ thật. Đợi một giờ, và dùng staging khi còn đang sửa lỗi |
| Nginx cứ khởi động lại, log có `cannot load certificate` | Chưa có chứng chỉ. Chạy `init-letsencrypt.sh` thay vì `dc up` trực tiếp |
| Nginx báo `host not found in upstream "api"` | Container api hoặc web chưa lên. `dc ps` và `dc logs api` |
| 502 Bad Gateway | api hoặc web lỗi. Xem `dc logs api` hoặc `dc logs web` |
| `dc build` bị `Killed` hoặc `exit code 137` | Hết RAM. Kiểm tra swap (`free -h`), build tuần tự (`COMPOSE_PARALLEL_LIMIT=1`), hoặc build trên máy khác |
| API không lên, log có `P3009` hoặc lỗi migration | Migration lỗi. Xem `dc logs api` để biết lệnh SQL nào hỏng; không sửa migration đã áp dụng |
| API báo `JWT_ACCESS_SECRET phải là chuỗi ngẫu nhiên` | Secret ngắn hơn 32 ký tự hoặc còn `change-me` trong `.env.production` |
| Đăng nhập xong nhưng trình duyệt không giữ phiên | Cookie đặt cờ `Secure` nên chỉ chạy trên HTTPS. Kiểm tra bạn đang vào bằng `https://` và `DOMAIN` khớp đúng địa chỉ trên thanh địa chỉ |
| `no space left on device` | `docker system df` rồi `docker image prune -a -f`; tăng dung lượng EBS nếu vẫn thiếu |
| Không SSH được | IP nhà bạn đã đổi nên security group chặn: sửa quy tắc SSH sang IP mới |
| Trang chủ hiện nhưng dữ liệu là mẫu | Đúng với hiện trạng: web chưa gọi API (PLAN Ngày 9 đến 17 sẽ nối). Triển khai vẫn đạt mốc "web chạy trên HTTPS" |

---

## Việc tiếp theo

PLAN Ngày 6: GitHub Actions chạy test, build và **tự deploy qua SSH** mỗi lần push; sao lưu PostgreSQL định kỳ bằng cron và `pg_dump`, thử khôi phục. Script `infra/scripts/deploy.sh` ở trên chính là thứ mà CI sẽ gọi.
