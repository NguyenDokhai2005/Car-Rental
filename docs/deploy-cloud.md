# Triển khai trên server cloud (máy chủ thứ hai)

Hướng dẫn cài Car-Rental lên một server cloud có **IP công khai** và **từ 2 GB RAM**, chạy song song với máy ảo VMware. Sau khi xong, mỗi lần merge vào `main` và CI xanh, GitHub Actions tự deploy lên **cả hai** máy, độc lập với nhau.

Khác máy ảo VMware ở ba điểm:

| | Máy ảo VMware | Server cloud |
| --- | --- | --- |
| Ai truy cập được | Chỉ thiết bị trong mạng nhà | **Cả Internet** |
| Nhãn runner | `carrental-vm` | `carrental-cloud` |
| Environment trên GitHub | `production` | `production-cloud` |

Vì server này mở ra Internet và dự án lưu giấy phép lái xe của người dùng, **mục 2 (tường lửa và SSH) không được bỏ qua**.

Hai máy chủ là hai hệ thống **riêng biệt**: mỗi máy một cơ sở dữ liệu, một kho ảnh, một bộ tài khoản. Dữ liệu không đồng bộ giữa hai máy.

Các lệnh dưới đây chạy trên server qua SSH. Mình chưa chạy chúng trên server của bạn; phần Docker và script deploy là phần đã chạy ổn trên máy ảo VMware.

## Lộ trình

| Bước | Việc | Mốc hoàn thành |
| --- | --- | --- |
| 1 | Xem cấu hình server | Biết RAM, CPU, kiến trúc, IP công khai |
| 2 | Tường lửa và SSH | Chỉ mở 22, 80, 443 |
| 3 | Cài Docker | `docker compose version` chạy được |
| 4 | Lấy mã và cấu hình | Có `~/carrental-config/.env.production` |
| 5 | Chạy lần đầu với HTTPS | Mở được `https://<IP-hoặc-tên-miền>` |
| 6 | Cài runner của GitHub | Runner `carrental-cloud` hiện *Idle* |
| 7 | Merge thay đổi workflow | Workflow Deploy có hai job đều xanh |
| 8 | Sao lưu và tài khoản admin | Cron sao lưu chạy, có một admin |

## 1. Xem cấu hình server

SSH vào server như bạn vẫn làm từ CMD, rồi chạy:

```bash
whoami                                   # tên người dùng, ghi lại (ví dụ ubuntu, root, opc)
. /etc/os-release && echo "$PRETTY_NAME" # hệ điều hành
uname -m                                 # x86_64 hoặc aarch64 (ARM)
nproc                                    # số lõi CPU
free -h                                  # RAM và swap
df -h /                                  # ổ đĩa còn trống
curl -4 -s ifconfig.me; echo             # IP công khai
```

Đối chiếu:

- **RAM dưới 2 GB:** dừng lại. Máy này không build nổi Next.js; phải theo `deploy-micro.md` và workflow cần cách deploy khác.
- **Hệ điều hành không phải Ubuntu/Debian:** lệnh `apt-get` ở dưới không dùng được; báo lại tên hệ điều hành.
- **Đang đăng nhập bằng `root`:** nên tạo người dùng thường trước, vì runner của GitHub từ chối chạy bằng root:

  ```bash
  adduser deploy && usermod -aG sudo deploy
  rsync -a ~/.ssh /home/deploy/ && chown -R deploy:deploy /home/deploy/.ssh
  ```

  Đăng xuất, SSH lại bằng `deploy`, và làm mọi bước còn lại bằng người dùng này.
- **RAM 2 GB:** tạo swap 2 GB để bước build không bị hết bộ nhớ (từ 4 GB trở lên thì bỏ qua):

  ```bash
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  ```

## 2. Tường lửa và SSH

Server cloud bị quét cổng liên tục từ lúc có IP công khai. Chỉ ba cổng được mở ra Internet:

| Cổng | Dùng cho | Mở cho |
| --- | --- | --- |
| 22 | SSH | Tốt nhất chỉ IP của bạn; nếu IP nhà đổi liên tục thì mở cho mọi nơi nhưng **bắt buộc** tắt đăng nhập bằng mật khẩu |
| 80 | HTTP (chuyển hướng sang HTTPS, xác minh Let's Encrypt) | Mọi nơi |
| 443 | HTTPS | Mọi nơi |

**Cách 1, bảng điều khiển của nhà cung cấp cloud** (Security Group, Security List, Firewall, tùy nhà cung cấp): tạo nhóm luật chỉ mở ba cổng trên rồi gắn vào server. Luật này chặn từ ngoài máy nên là lớp chắc nhất.

**Cách 2, `ufw` ngay trên server** (khi không vào được bảng điều khiển). Cho phép cổng 22 **trước khi** bật, nếu không bạn tự khóa mình ra ngoài:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable
sudo ufw status verbose      # Status: active, ba cổng trên ALLOW IN
```

Lưu ý về `ufw` và Docker: Docker tự chèn luật mạng riêng nên các cổng nó công bố **không bị `ufw` chặn**. Ở dự án này điều đó không gây hại, vì Compose chỉ công bố 80 và 443 (đúng hai cổng cần mở) và PostgreSQL không có `ports`. Nhưng đừng bao giờ thêm `ports` cho một dịch vụ nội bộ rồi trông vào `ufw` để che nó.

Không vào được bảng điều khiển cũng có nghĩa là không có đường lui nếu SSH hỏng. Mỗi lần đổi cấu hình SSH hoặc tường lửa: giữ một phiên đang mở, thử bằng một phiên **mới**, rồi mới đóng phiên cũ.

**SSH bằng khóa, tắt mật khẩu.** Nếu bạn đang đăng nhập bằng mật khẩu, tạo khóa trên Windows (PowerShell) rồi chép lên:

```powershell
ssh-keygen -t ed25519 -f $HOME\.ssh\carrental-cloud -C "carrental-cloud"
type $HOME\.ssh\carrental-cloud.pub | ssh <user>@<IP> "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
ssh -i $HOME\.ssh\carrental-cloud <user>@<IP>     # phải vào được mà KHÔNG hỏi mật khẩu
```

Chỉ khi lệnh cuối vào được, mới tắt đăng nhập bằng mật khẩu trên server (giữ nguyên phiên SSH đang mở để phòng hờ):

```bash
echo -e "PasswordAuthentication no\nPermitRootLogin no" | sudo tee /etc/ssh/sshd_config.d/01-carrental.conf
sudo sshd -t && sudo systemctl reload ssh
sudo sshd -T | grep -Ei '^(passwordauthentication|permitrootlogin)'     # cả hai phải là "no"
```

Tên file bắt đầu bằng `01` là có chủ ý: SSH đọc các file trong thư mục này theo thứ tự tên và **giá trị gặp đầu tiên thắng**. Image của nhà cung cấp cloud thường có sẵn `50-cloud-init.conf` bật đăng nhập mật khẩu; file của mình phải đứng trước nó. Lệnh `sshd -T` in cấu hình đang thật sự có hiệu lực, đừng chỉ tin vào nội dung file.

Mở một cửa sổ PowerShell **mới** và SSH thử lại trước khi đóng phiên cũ. Thử thêm `ssh -o PubkeyAuthentication=no <user>@<IP>`: lệnh này **phải bị từ chối** (`Permission denied (publickey)`), chứng tỏ mật khẩu đã tắt thật.

Cập nhật hệ thống và bật tự cài bản vá bảo mật:

```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y unattended-upgrades
```

## 3. Cài Docker

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

(Trên Debian, thay hai chỗ `ubuntu` trong địa chỉ `download.docker.com/linux/ubuntu` bằng `debian`.)

**Đăng xuất rồi SSH lại** để quyền nhóm `docker` có hiệu lực, rồi kiểm tra:

```bash
docker --version && docker compose version
docker run --rm hello-world
```

## 4. Lấy mã và cấu hình

Repo công khai nên không cần khóa:

```bash
git clone https://github.com/NguyenDokhai2005/Car-Rental.git ~/car-rental
cd ~/car-rental
cp .env.production.example .env.production
chmod 600 .env.production
sed -i "s|^DOMAIN=.*|DOMAIN=<IP-hoặc-tên-miền>|" .env.production
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" .env.production
sed -i "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$(openssl rand -hex 48)|" .env.production
grep -E "^(DOMAIN|LOW_MEMORY)=" .env.production                               # xem lại mà không in khóa ra màn hình
grep -cE "^(POSTGRES_PASSWORD|JWT_ACCESS_SECRET)=.{40,}" .env.production      # phải ra 2
```

Các lệnh `sed` điền giá trị thẳng vào file, khóa bí mật không hiện trên màn hình (không lọt vào ảnh chụp hay lịch sử cuộn). Ý nghĩa từng biến:

| Biến | Giá trị |
| --- | --- |
| `DOMAIN` | Tên miền nếu có, ví dụ `thuexe.example.com`; nếu chưa có thì **IP công khai** của server (không có `https://`) |
| `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET` | Hai chuỗi hex vừa in ra ở trên. **Tạo mới cho server này, không dùng lại của máy ảo VMware** |
| `LETSENCRYPT_EMAIL` | Email của bạn (chỉ dùng khi có tên miền) |
| `LETSENCRYPT_STAGING` | `1` khi thử lần đầu với tên miền, sau đó đổi `0` |
| `LOW_MEMORY` | `0` |

Vì sao mỗi máy chủ một bộ khóa riêng: nếu một máy bị lộ khóa JWT, token giả tạo ra từ khóa đó không dùng được trên máy còn lại.

## 5. Chạy lần đầu với HTTPS

Chọn **một** trong hai cách, theo giá trị `DOMAIN` ở trên.

**Chưa có tên miền (dùng IP), chứng chỉ tự ký:**

```bash
bash infra/scripts/init-selfsigned.sh
```

Trình duyệt sẽ cảnh báo "kết nối không riêng tư"; chọn **Nâng cao → Tiếp tục truy cập**. Dùng được để thử, nhưng người dùng thật sẽ không tin một trang có cảnh báo này.

**Có tên miền, chứng chỉ Let's Encrypt:** trước hết tạo bản ghi DNS loại **A** trỏ tên miền về IP công khai của server, đợi vài phút, kiểm tra `nslookup <tên-miền>` ra đúng IP. Rồi:

```bash
bash infra/scripts/init-letsencrypt.sh
```

Chạy với `LETSENCRYPT_STAGING=1` trước; khi thành công, đổi thành `0` và chạy lại để lấy chứng chỉ thật (chi tiết ở `deploy-guide.md` mục 7). Tên miền con miễn phí (ví dụ DuckDNS) cũng dùng được và không vi phạm ràng buộc chi phí $0.

Chạy script trong `tmux` (`sudo apt-get install -y tmux && tmux new -s deploy`) để rớt kết nối SSH thì build vẫn tiếp tục; vào lại bằng `tmux attach -t deploy`. Thời gian build lần đầu đo được trên máy 1 lõi, 1.6 GB RAM, có swap: khoảng 4 phút. Kiểm tra:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file .env.production ps    # db, api, web phải (healthy)
curl -sk https://localhost/api/me      # {"code":"UNAUTHORIZED",...}: API sống và đang chặn người chưa đăng nhập
```

Rồi mở `https://<DOMAIN>` từ máy của bạn. Nếu trên server chạy được mà từ ngoài không vào được: cổng 80/443 chưa được mở ở tường lửa của nhà cung cấp (mục 2).

Đổi từ IP sang tên miền sau này: sửa `DOMAIN` trong **cả hai** file `.env.production` (ở `~/car-rental` và `~/carrental-config`), rồi chạy `init-letsencrypt.sh`.

## 6. Cài runner của GitHub

**6.1 Đặt file cấu hình ra ngoài thư mục mã.** Workflow dọn thư mục checkout mỗi lần chạy, nên file bí mật phải nằm cố định ở nơi khác:

```bash
mkdir -p ~/carrental-config
cp ~/car-rental/.env.production ~/carrental-config/.env.production
chmod 600 ~/carrental-config/.env.production
docker volume ls | grep letsencrypt     # phải thấy carrental_letsencrypt (chứng chỉ vừa tạo ở mục 5)
```

**6.2 Lấy lệnh cài.** Trên GitHub: repo → **Settings → Actions → Runners → New self-hosted runner**, chọn **Linux** và kiến trúc khớp với `uname -m` ở mục 1 (**x64** cho `x86_64`, **ARM64** cho `aarch64`). Trang đó hiện sẵn các lệnh tải và cấu hình kèm mã xác thực tạm thời (hết hạn sau khoảng 1 giờ). 
Gõ `cd ~` trước, rồi chạy khối lệnh **Download** của trang đó (nó tạo `actions-runner` ngay tại thư mục đang đứng; đứng nhầm trong `~/car-rental` thì runner nằm lẫn vào thư mục mã).

Với khối **Configure**, đừng dán nguyên văn: chỉ lấy chuỗi sau `--token` rồi chạy lệnh dưới đây, để tên và nhãn được đặt sẵn thay vì phải trả lời từng câu hỏi (bấm Enter cho qua là mất nhãn):

```bash
cd ~/actions-runner
./config.sh --url https://github.com/NguyenDokhai2005/Car-Rental --token <MÃ> \
  --name carrental-cloud --labels carrental-cloud --work _work --unattended
```

Nhãn phải đúng từng ký tự: workflow tìm runner theo nhãn này, và nhãn khác với `carrental-vm` là thứ bảo đảm mỗi job chạy đúng máy của nó. Lỡ đăng ký thiếu nhãn thì thêm được trên GitHub: trang Runners → bấm vào runner → bánh răng ở mục Labels.

Mã sau `--token` cho phép đăng ký runner vào repo trong khoảng 1 giờ: đừng để nó lọt vào ảnh chụp màn hình.

**6.3 Cài thành dịch vụ** để runner tự chạy lại khi server khởi động lại:

```bash
cd ~/actions-runner
sudo ./svc.sh install $USER     # dịch vụ chạy bằng người dùng thường này, không phải root
sudo ./svc.sh start
sudo ./svc.sh status            # phải thấy "active (running)"
```

Trang Runners trên GitHub phải hiện **hai** runner: `carrental-vm` và `carrental-cloud`, cả hai *Idle* (máy ảo có thể *Offline* nếu máy tính của bạn đang tắt).

## 7. Merge thay đổi workflow

File `.github/workflows/deploy.yml` đã được sửa để chạy hai job. **Chỉ merge PR chứa thay đổi này sau khi xong mục 6.** Nếu merge trước, job của server cloud không tìm thấy runner, nằm ở trạng thái *Queued* tới 24 giờ rồi báo lỗi (job của máy ảo vẫn chạy bình thường).

Sau khi merge: tab **Actions** → sau khi **CI** xanh, workflow **Deploy** hiện hai job *Deploy lên máy ảo VMware* và *Deploy lên server cloud*. Mỗi job tự build, khởi động, chờ dịch vụ khỏe và kiểm tra `https://localhost/` (200) cùng `/api/me` (401) ngay trên máy của nó.

**Duyệt tay trước khi deploy (khuyên bật cho server cloud):** lần chạy đầu tiên, GitHub tự tạo environment `production-cloud` **không có** người duyệt. Vào **Settings → Environments → production-cloud → Required reviewers**, thêm chính bạn. Environment `production` của máy ảo giữ nguyên cài đặt cũ.

## 8. Sao lưu và tài khoản admin

**Sao lưu** (sau khi workflow Deploy đã chạy thành công ít nhất một lần trên server này):

```bash
cd ~/actions-runner/_work/Car-Rental/Car-Rental
bash infra/scripts/install-backup-cron.sh --dry-run     # phải in ra bốn dòng có "# carrental-backup"
bash infra/scripts/install-backup-cron.sh
~/carrental-config/bin/backup-db.sh && ~/carrental-config/bin/restore-test.sh
```

Chi tiết và cách chép bản sao lưu ra ngoài server: `backup.md`.

**Tài khoản admin.** Cơ sở dữ liệu của server này trống, không có tài khoản mẫu. Đăng ký một tài khoản qua trang web, rồi nâng quyền:

```bash
docker compose -f ~/car-rental/infra/docker-compose.prod.yml --env-file ~/carrental-config/.env.production \
  exec db psql -U carrental -d carrental -c "UPDATE users SET role = 'admin' WHERE email = 'email-cua-ban@example.com';"
```

## Sau khi runner hoạt động

Thư mục `~/car-rental` chỉ dùng cho lần cài đầu. Từ đây mã chạy thật nằm trong `~/actions-runner/_work/Car-Rental/Car-Rental` và do workflow cập nhật. Đừng chạy `deploy.sh` hay `git pull` trong `~/car-rental` nữa: hai nơi cùng điều khiển một bộ container sẽ ghi đè lên nhau.

## Lỗi thường gặp

| Triệu chứng | Nguyên nhân và cách xử lý |
| --- | --- |
| Job *Deploy lên server cloud* cứ *Queued* | Runner chưa chạy hoặc sai nhãn. Trên server: `cd ~/actions-runner && sudo ./svc.sh status`; trang Runners phải có nhãn `carrental-cloud` |
| Job của máy ảo *Queued*, job cloud xanh | Máy tính của bạn đang tắt nên máy ảo tắt theo. Bật lại, job tự chạy; quá 24 giờ thì job báo lỗi, bấm *Re-run failed jobs* |
| `Must not run with sudo` khi `./config.sh` | Đang dùng `root`. Tạo người dùng thường (mục 1) |
| Trên server `curl -k https://localhost` được, từ ngoài không vào được | Chưa mở cổng 80/443 ở tường lửa của nhà cung cấp cloud |
| `init-letsencrypt.sh` báo không xác minh được tên miền | Bản ghi DNS chưa trỏ đúng IP, hoặc cổng 80 chưa mở |
| Đăng nhập xong không giữ phiên | Đang mở bằng địa chỉ khác `DOMAIN` (ví dụ mở bằng IP trong khi `DOMAIN` là tên miền). Cookie chỉ hoạt động đúng địa chỉ đã cấu hình |
| Build bị `Killed` | Hết RAM. Tạo swap (mục 1) |
| Deploy đỏ ở bước chờ khỏe lại | Đọc log in sẵn trong job. Hay gặp: `~/carrental-config/.env.production` khác file đã dùng ở mục 5 (mật khẩu DB không khớp volume đã tạo) |
