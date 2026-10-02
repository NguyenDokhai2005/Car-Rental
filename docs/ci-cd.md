# CI/CD với GitHub Actions

PLAN Ngày 6. **CI** (kiểm tra tự động, `ci.yml`) và **CD** (tự đưa lên máy chủ, `deploy.yml`) đều đã viết. CD cần cài một lần *self-hosted runner* trong máy ảo (xem mục CD bên dưới).

## CI: `.github/workflows/ci.yml`

Chạy khi mở hoặc cập nhật Pull Request, và khi mã vào `main`. Gồm 3 job chạy song song:

| Job | Làm gì | Thời gian ước tính |
| --- | --- | --- |
| **API** (typecheck, lint, test, build) | Cài gói, sinh Prisma Client, `typecheck`, `lint`, chạy toàn bộ test với **PostgreSQL 16 thật**, build | 3 đến 5 phút |
| **Web** (typecheck, lint, build) | `typecheck`, `lint`, `next build` | 2 đến 3 phút |
| **Docker** (build image) | Build image của `api` và `web` để chắc Dockerfile còn chạy được; **không đẩy image đi đâu** | 3 đến 6 phút (nhanh hơn từ lần thứ hai nhờ bộ nhớ đệm) |

Vì sao test API dùng PostgreSQL thật thay vì giả lập: dự án dựa vào `btree_gist` và các ràng buộc `EXCLUDE` (chống đặt trùng lịch), chỉ PostgreSQL thật mới kiểm chứng được. Workflow dựng một container PostgreSQL ngay trên máy chạy CI; bộ test tự tạo database `carrental_test` và áp dụng toàn bộ migration trước khi chạy (`api/test/global-setup.ts`).

Một lần chạy mới tự hủy lần chạy cũ trên cùng một nhánh (`concurrency`) để đỡ tốn phút.

## Xem kết quả

- Trong Pull Request, cuối trang có mục **Checks**: dấu xanh là đạt, dấu đỏ là hỏng. Bấm **Details** để đọc log.
- Hoặc tab **Actions** của repo, chọn lần chạy.

## Bật chặn merge khi CI đỏ (làm một lần)

PLAN ghi "CI xanh mới merge". Bật bằng cách đặt luật cho `main`:

1. GitHub → **Settings → Branches → Add branch ruleset** (hoặc *Add classic branch protection rule*), nhánh áp dụng `main`.
2. Bật **Require a pull request before merging** (không cho push thẳng vào `main`).
3. Bật **Require status checks to pass before merging**, rồi chọn ba mục:
   - `API (typecheck, lint, test, build)`
   - `Web (typecheck, lint, build)`
   - `Docker (build image)`
4. Lưu.

Ba tên này chỉ xuất hiện trong ô tìm kiếm **sau khi workflow đã chạy ít nhất một lần**, nên hãy mở PR đầu tiên trước.

## Chạy lại các bước CI trên máy mình

Cần Docker đang chạy cho PostgreSQL (`docker compose up -d db` ở thư mục gốc). Từ thư mục gốc dự án:

```bash
pnpm install --frozen-lockfile
pnpm --filter api exec prisma generate
pnpm --filter api typecheck && pnpm --filter api lint && pnpm --filter api test && pnpm --filter api build
pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web build
```

Nếu các lệnh này qua trên máy bạn thì CI gần như chắc chắn xanh.

## Bảo mật (repo công khai)

- Workflow chỉ cần `permissions: contents: read`, tức là chỉ đọc mã. PR từ người lạ không thể sửa repo hay đọc secret.
- Vào **Settings → Actions → General → Fork pull request workflows** và đặt **Require approval for all outside collaborators**, để người lạ mở PR không tự chạy workflow trên tài khoản của bạn.
- **Tuyệt đối không dùng *self-hosted runner* cho các job chạy trên PR.** Runner tự lưu chạy mã ngay trên máy bạn; repo công khai thì ai cũng gửi được PR chứa mã độc. Phần deploy sẽ chỉ chạy khi push vào `main`, không bao giờ trên PR.

## Lỗi thường gặp

| Triệu chứng | Nguyên nhân và cách xử lý |
| --- | --- |
| `ERR_PNPM_OUTDATED_LOCKFILE` | Đã sửa `package.json` mà quên cập nhật `pnpm-lock.yaml`. Chạy `pnpm install` và commit file lock |
| Test API lỗi kết nối `localhost:5432` | Container PostgreSQL chưa sẵn sàng. Workflow đã có kiểm tra sức khỏe; nếu lỗi lặp lại, xem log bước khởi tạo dịch vụ |
| Job Web lỗi tải font | `next/font` cần Internet để tải Be Vietnam Pro lúc build; thường là lỗi mạng tạm thời, chạy lại job |
| Job Docker lỗi `pnpm install --frozen-lockfile` | Cùng nguyên nhân như `ERR_PNPM_OUTDATED_LOCKFILE` ở trên |
| Hỏng chỉ trên CI mà chạy được ở máy mình | So sánh phiên bản: CI dùng Node 22 và pnpm 9.15.9 (khớp Dockerfile). Kiểm tra bằng `node -v` và `pnpm -v` |

## CD: `.github/workflows/deploy.yml`

Tự đưa bản mới lên máy ảo VMware sau khi CI xanh trên `main`.

### Vì sao cần "self-hosted runner"

Máy ảo nằm sau mạng NAT tại nhà nên **GitHub không SSH vào được**. Thay vào đó cài một chương trình **runner** ngay trong máy ảo. Runner tự kết nối ra GitHub (chỉ chiều đi ra, không phải mở cổng router), hỏi "có việc gì cho tôi không", nhận job deploy và chạy tại chỗ.

```text
Merge PR vào main
      │
      ▼
CI chạy trên máy GitHub (ci.yml) ──đỏ──▶ dừng, không deploy
      │ xanh
      ▼
deploy.yml: job giao cho runner trong máy ảo VMware
      │
      ▼
checkout đúng commit đã qua CI ─▶ infra/scripts/ci-deploy.sh
      │
      ▼
build ─▶ up -d ─▶ chờ db/api/web khỏe ─▶ kiểm tra https://localhost/ (200) và /api/me (401)
```

### Điều kiện chạy (an toàn cho repo công khai)

Job `deploy` chỉ chạy khi **cả bốn** điều kiện đúng: CI thành công, sự kiện là **push** (không phải PR), nhánh là `main`, và commit nằm trong **chính repo này** (không phải fork). Các job CI của Pull Request chạy trên máy do GitHub cấp (`ubuntu-latest`) nên mã của PR **không bao giờ chạm tới máy ảo của bạn**.

Workflow lấy đúng commit CI đã kiểm tra (`head_sha`), không phải "main mới nhất", để không deploy nhầm mã chưa qua CI.

### `infra/scripts/ci-deploy.sh` làm gì

1. `docker compose build`.
2. `docker compose up -d` (migration chạy tự động khi API khởi động), rồi tạo lại container Nginx để nhận cấu hình mới.
3. Chờ `db`, `api`, `web` ở trạng thái healthy (tối đa 3 phút mỗi dịch vụ).
4. Kiểm tra từ ngoài qua Nginx: `https://localhost/` phải trả 200 và `https://localhost/api/me` phải trả 401 (API sống và đang chặn người chưa đăng nhập).

Khi có bước nào hỏng, script **in trạng thái và log gần nhất** ngay trong log của workflow và thoát với mã lỗi, nên job hiện đỏ kèm nguyên nhân mà bạn không phải SSH vào máy. Dữ liệu trong PostgreSQL và ảnh upload nằm trong volume Docker nên **không mất sau mỗi lần deploy**.

Đã thử trên Docker ở máy phát triển: deploy lần đầu, deploy lại (giữ nguyên người dùng đã đăng ký), thiếu file cấu hình (báo lỗi rõ), bản hỏng (job đỏ kèm log nguyên nhân), và khôi phục bằng bản tốt.

### Cài runner (làm một lần, trong máy ảo)

**1. Đặt file cấu hình ra ngoài thư mục mã.** Checkout của workflow bị dọn sạch mỗi lần chạy, nên `.env.production` (mật khẩu DB, khóa JWT) phải nằm cố định ở nơi khác:

```bash
mkdir -p ~/carrental-config
cp ~/car-rental/.env.production ~/carrental-config/.env.production
chmod 600 ~/carrental-config/.env.production
docker volume ls | grep letsencrypt     # phải thấy carrental_letsencrypt (chứng chỉ HTTPS đã tạo ở lần cài đầu)
```

Nếu muốn đặt ở chỗ khác, đặt biến `CARRENTAL_ENV_FILE` cho runner.

**2. Lấy lệnh cài từ GitHub.** Repo → **Settings → Actions → Runners → New self-hosted runner**, chọn **Linux** và **x64**. Trang này hiện sẵn các lệnh tải và cấu hình kèm **mã xác thực tạm thời (hết hạn sau khoảng 1 giờ)**. Làm theo trang đó, trong thư mục `~/actions-runner` của máy ảo, với hai điều chỉnh khi chạy `./config.sh`:
- Tên runner: `carrental-vm`.
- Khi hỏi nhãn (labels): nhập `carrental-vm`. Workflow tìm đúng nhãn này.

**3. Cài thành dịch vụ để tự chạy khi máy ảo bật:**

```bash
cd ~/actions-runner
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status        # phải thấy "active (running)"
```

Quay lại trang Runners trên GitHub: runner `carrental-vm` phải ở trạng thái **Idle** (chấm xanh).

**4. (Khuyên dùng) Bắt buộc duyệt tay mỗi lần deploy.** Repo → **Settings → Environments → production → Required reviewers**, thêm chính bạn. Khi đó mỗi lần CI xanh, workflow dừng lại chờ bạn bấm **Approve** rồi mới chạy trên máy ảo. Tắt đi khi bạn đã tin tưởng quy trình.

**5. Kiểm tra cài đặt:** Settings → Actions → General:
- **Fork pull request workflows from outside collaborators**: chọn *Require approval for all outside collaborators*.
- **Workflow permissions**: *Read repository contents permission*.

**6. Thử:** merge một thay đổi nhỏ vào `main`, vào tab **Actions**: sau khi **CI** xanh, workflow **Deploy** chạy. Mở `https://192.168.205.129` để xem bản mới.

### Quay lại bản cũ

Cách sạch nhất: tạo PR **revert** commit gây lỗi, merge vào `main`; CI xanh thì deploy tự đưa bản cũ lên. Lưu ý migration cơ sở dữ liệu **không tự lùi**: bản cũ vẫn chạy được nếu migration mới chỉ thêm bảng hoặc cột. Sao lưu trước khi deploy bản có migration lớn.

### Bảo mật của self-hosted runner (nghiêm túc)

- Runner chạy mã **ngay trên máy ảo** với quyền người dùng `ubuntu` (thuộc nhóm `docker`, gần như root trên máy ảo). Repo công khai nên chỉ mã đã merge vào `main` được chạy ở đây; đừng bao giờ thêm nhãn `carrental-vm` vào job chạy trên Pull Request.
- Giữ máy ảo **tách biệt** khỏi dữ liệu cá nhân trên Windows (đúng như đang làm với VMware).
- Mật khẩu và khóa JWT chỉ nằm trong `~/carrental-config/` trên máy ảo, **không** đưa lên GitHub.
- Bật *Required reviewers* (bước 4) khi mới bắt đầu để có thêm một lớp duyệt thủ công.

### Lỗi thường gặp (CD)

| Triệu chứng | Nguyên nhân và cách xử lý |
| --- | --- |
| Job Deploy cứ ở trạng thái *Queued* | Runner chưa chạy hoặc sai nhãn. Trên máy ảo `sudo ./svc.sh status`; trang Runners phải hiện *Idle* và có nhãn `carrental-vm` |
| `Thiếu .../.env.production` | Chưa làm bước 1 (đặt file ở `~/carrental-config/`) |
| Job đỏ ở bước chờ khỏe lại | Xem phần log in sẵn trong job: thường là cấu hình sai (khóa JWT quá ngắn, mật khẩu DB không khớp volume cũ) |
| Máy ảo tắt hoặc khởi động lại | Runner (đã cài thành dịch vụ) tự chạy lại. Nếu máy ảo tắt lúc đang deploy, chạy lại workflow bằng *Re-run jobs* |
| Deploy bị treo ở bước build | Máy ảo thiếu RAM. Tăng RAM máy ảo lên 6 GB trong cài đặt VMware |
