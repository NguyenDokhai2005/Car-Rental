# Triển khai trên máy 1 GB RAM (Oracle AMD Micro)

Hướng dẫn này dành cho máy rất nhỏ, cụ thể là Oracle Cloud **VM.Standard.E2.1.Micro** (Always Free): **1/8 lõi CPU (có thể tăng vọt tạm thời) và 1 GB RAM**, kiến trúc x86_64. Nó chạy được Car-Rental ở quy mô demo, nhưng khác máy thường ở hai điểm:

1. **Giảm bộ nhớ từng container** để tất cả nằm gọn trong 1 GB cùng hệ điều hành. Bắt buộc có swap.
2. **Không build image trên máy chủ.** Build Next.js trên CPU 1/8 lõi rất chậm và hết RAM. Bạn build trên máy Windows của mình rồi chuyển image lên.

Mọi thứ khác (domain, HTTPS Let's Encrypt, vận hành) giống `deploy-guide.md`. Tài liệu này chỉ nói phần khác biệt.

> Máy này phù hợp để **chạy thử và demo** với ít người dùng. Khi có chỗ trống máy ARM của Oracle (hoặc khi cần mạnh hơn), chuyển sang máy lớn theo cách sao lưu và khôi phục ở `deploy-guide.md` mục 10.

## Bộ nhớ dự kiến

| Thành phần | Giới hạn | Ghi chú |
| --- | --- | --- |
| PostgreSQL | 192 MB | `shared_buffers` 32 MB, tối đa 30 kết nối |
| API (NestJS) | 288 MB | Dư cho bước migration lúc khởi động |
| Web (Next.js) | 192 MB | |
| Nginx | 32 MB | |
| Certbot | 64 MB | |
| **Cộng container** | **khoảng 770 MB** | |
| Hệ điều hành và Docker | khoảng 250 đến 300 MB | |

Tổng sát 1 GB nên **swap 2 GB là bắt buộc**. Mức giới hạn là trần, thực tế lúc rảnh các container dùng ít hơn nhiều.

## 1. Tạo máy

Console Oracle → **Compute → Instances → Create instance**:

| Mục | Chọn |
| --- | --- |
| Name | `carrental-prod` |
| Image | *Change image* → **Canonical Ubuntu 24.04** (không chọn bản *Minimal*) |
| Shape | *Change shape* → **Virtual machine** → thẻ **AMD** → **VM.Standard.E2.1.Micro** (nhãn *Always Free-eligible*) |
| Networking | **Select existing virtual cloud network** → `carrental-vcn` và subnet **công khai** (nếu chưa có mạng, tạo bằng *VCN Wizard → Create VCN with Internet Connectivity*). Bật **Automatically assign public IPv4 address** |
| SSH keys | **Paste public key**, dán nội dung `Get-Content $HOME\.ssh\carrental.pub` (cả dòng `ssh-ed25519 ...`) |
| Storage | **50 GB** |

Đổi shape thì phải chọn lại Image, vì kiến trúc đổi sang x86_64. Bấm **Create**, đợi trạng thái *Running* rồi ghi lại **Public IP address** (`<IP>`).

Nếu gặp "Out of capacity" với máy này thì thử lại sau ít phút; loại Micro thường còn chỗ hơn máy ARM.

## 2. Mở cổng 80 và 443 (hai lớp)

**Lớp 1: Security List.** VCN → tab *Security* → *Default Security List* → *Add Ingress Rules*: nguồn `0.0.0.0/0`, TCP, cổng `80`; thêm quy tắc nữa cho cổng `443`. Cổng 22 có sẵn.

**Lớp 2: iptables trong máy** (sau khi SSH vào, mục 3):

```bash
sudo iptables -L INPUT -n --line-numbers      # tìm số dòng của luật REJECT, ví dụ 6
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save                # báo thiếu thì: sudo apt-get install -y iptables-persistent
```

## 3. Kết nối, swap, Docker

```powershell
ssh -i $HOME\.ssh\carrental ubuntu@<IP>
```

Tạo swap 2 GB và cài Docker theo `deploy-guide.md` **mục 4.1 và 4.2** (lệnh y hệt). Thêm một bước để máy ít dùng swap khi không cần thiết:

```bash
echo 'vm.swappiness=20' | sudo tee /etc/sysctl.d/99-swappiness.conf && sudo sysctl --system
free -h        # dòng Swap phải là 2.0Gi
```

Nhớ đăng xuất rồi đăng nhập lại sau khi cài Docker.

## 4. Build image trên máy Windows của bạn

Máy Windows của bạn là x86_64, **cùng kiến trúc** với máy Oracle AMD, nên image build ở nhà chạy được trên server. Cần Docker Desktop đang chạy. Trong thư mục gốc dự án, PowerShell:

```powershell
docker build --platform linux/amd64 -f api/Dockerfile -t carrental-api:latest .
docker build --platform linux/amd64 -f web/Dockerfile -t carrental-web:latest .
```

Kiểm tra kiến trúc (cả hai phải ra `amd64`):

```powershell
docker image inspect carrental-api:latest carrental-web:latest --format '{{.RepoTags}} {{.Architecture}}'
```

Đóng gói thành một file và chuyển lên server (vài trăm MB đến khoảng 1,2 GB tùy phiên bản Docker, vài phút tùy mạng):

```powershell
docker save carrental-api:latest carrental-web:latest -o carrental-images.tar
scp -i $HOME\.ssh\carrental carrental-images.tar ubuntu@<IP>:~/
```

Nếu có Git Bash, nén trước sẽ nhẹ hơn nhiều: `docker save carrental-api:latest carrental-web:latest | gzip > carrental-images.tgz` rồi `scp` file `.tgz`. Dùng PowerShell thì không nén bằng đường ống `|` được, vì PowerShell làm hỏng dữ liệu nhị phân; hãy dùng `-o` như ở trên.

Trên **server**, nạp image rồi xóa file để lấy lại chỗ:

```bash
docker load -i ~/carrental-images.tar      # hoặc carrental-images.tgz (docker tự nhận file nén)
rm ~/carrental-images.tar
docker images | grep carrental             # phải thấy carrental-api và carrental-web
```

## 5. Lấy mã cấu hình và đặt biến môi trường

Server vẫn cần mã nguồn, nhưng chỉ để lấy các file cấu hình (Compose, Nginx), không build. Làm theo `deploy-guide.md` **mục 5.1** (deploy key và `git clone`). Rồi:

```bash
cd ~/car-rental
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

Điền như `deploy-guide.md` mục 5.2 (`DOMAIN`, `LETSENCRYPT_EMAIL`, `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `LETSENCRYPT_STAGING=1` lúc đầu) và **đặt thêm `LOW_MEMORY=1`**. Dòng này làm các script dùng file giảm bộ nhớ và không build.

Đặt lệnh tắt (thay cho lệnh ở mục 5.1 của `deploy-guide.md`):

```bash
echo "alias dc='docker compose -f ~/car-rental/infra/docker-compose.prod.yml -f ~/car-rental/infra/docker-compose.micro.yml --env-file ~/car-rental/.env.production'" >> ~/.bashrc
source ~/.bashrc
```

## 6. HTTPS và chạy

Trỏ domain về `<IP>` như `deploy-guide.md` mục 3, rồi chạy script xin chứng chỉ (script tự nhận `LOW_MEMORY=1`, không build, dùng image đã nạp):

```bash
cd ~/car-rental
bash infra/scripts/init-letsencrypt.sh
```

Làm theo `deploy-guide.md` mục 7 (thử staging, rồi chuyển sang chứng chỉ thật) và mục 8 (kiểm tra).

Kiểm tra bộ nhớ sau khi chạy:

```bash
free -h
docker stats --no-stream      # cột MEM USAGE / LIMIT của từng container
```

## 7. Cập nhật phiên bản mới

Mỗi lần có thay đổi mã: build lại ở máy Windows, chuyển, nạp, rồi chạy script.

```powershell
# trên Windows
docker build --platform linux/amd64 -f api/Dockerfile -t carrental-api:latest .
docker build --platform linux/amd64 -f web/Dockerfile -t carrental-web:latest .
docker save carrental-api:latest carrental-web:latest -o carrental-images.tar
scp -i $HOME\.ssh\carrental carrental-images.tar ubuntu@<IP>:~/
```

```bash
# trên server
docker load -i ~/carrental-images.tar && rm ~/carrental-images.tar
bash ~/car-rental/infra/scripts/deploy.sh      # kéo cấu hình mới, khởi động lại dịch vụ đổi; migration tự chạy
```

Chỉ build lại image đổi (chỉ sửa `api/` thì chỉ cần build và chuyển `carrental-api`).

## Lỗi thường gặp (riêng cho máy nhỏ)

| Triệu chứng | Nguyên nhân và cách xử lý |
| --- | --- |
| `dc up` báo `No such image: carrental-api:latest` hoặc `pull access denied` | Chưa nạp image. Chạy `docker load` ở mục 4. Compose đang đặt `pull_policy: never` nên sẽ không tự tải |
| Container tự khởi động lại liên tục, `docker inspect` có `OOMKilled: true` | Container vượt giới hạn bộ nhớ. Xem `docker stats`; tăng `mem_limit` của container đó trong `infra/docker-compose.micro.yml` (và giảm cái khác), kiểm tra swap còn hoạt động |
| SSH hoặc trang web rất chậm, `free -h` cho thấy swap đầy | Hết RAM thật. Tạm thời `dc restart`, về lâu dài chuyển sang máy lớn hơn |
| `docker compose` báo `build: !reset` không hợp lệ | Docker Compose quá cũ. Cần phiên bản 2.24 trở lên; cài lại `docker-compose-plugin` theo `deploy-guide.md` mục 4.2 |
| `no space left on device` khi `docker load` | Ổ đầy. Xóa file `.tar`, chạy `docker image prune -a -f`, kiểm tra `df -h` |
| Đăng nhập chậm hơn (có thể nửa giây đến vài giây) | Bình thường trên CPU 1/8 lõi: băm mật khẩu argon2 tốn CPU. Trên máy Windows của mình một lần đăng nhập chỉ khoảng 40 ms, máy Micro chậm hơn nhiều lần |
| Nginx trả 429 khi bạn thử nhanh nhiều lần | Giới hạn tốc độ cho `/api/auth/` (20 yêu cầu mỗi phút mỗi IP, cho phép dồn 10). Đợi một lúc rồi thử lại |

## Đã kiểm thử

Cấu hình này đã được chạy thử trên máy Windows với đúng các giới hạn bộ nhớ ở trên: build image `linux/amd64`, `docker save`, xóa image rồi `docker load`, chạy stack bằng `docker-compose.prod.yml` kèm `docker-compose.micro.yml` (Compose không tự build), migration tự chạy, đăng ký và đăng nhập qua HTTPS, và tải 8 lần đăng nhập đồng thời. Không container nào bị `OOMKilled`; lúc rảnh API dùng khoảng 48 MB, PostgreSQL khoảng 55 MB, web khoảng 43 MB. Chưa thử trên máy Oracle thật: tốc độ CPU 1/8 lõi và bộ nhớ thực của hệ điều hành là hai điều chỉ biết được khi chạy ở đó.
