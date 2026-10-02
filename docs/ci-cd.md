# CI/CD với GitHub Actions

PLAN Ngày 6. Hiện đã có **CI** (kiểm tra tự động). **CD** (tự đưa lên máy chủ) làm ở bước sau.

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

## CD: sắp làm

Server của dự án là máy ảo VMware ở nhà, **nằm sau mạng NAT nên GitHub không SSH vào được**. Cách làm đã chọn: cài **self-hosted runner trong máy ảo**; runner tự kết nối ra GitHub, nhận job deploy và chạy `docker compose` ngay trong máy ảo, không phải mở cổng router. Job deploy chỉ chạy khi push vào `main` và sau khi CI xanh. File `.env.production` (mật khẩu DB, khóa JWT) nằm cố định trên máy ảo, không đưa lên GitHub.
