# Car-Rental (AutoRent VN)

Nền tảng cho thuê xe tự lái theo mô hình marketplace: chủ xe cá nhân đăng xe, khách tìm và đặt xe trực tuyến, quản trị viên kiểm duyệt xe và giấy phép lái xe. Tên hiển thị trên giao diện là **AutoRent VN**.

Đây là dự án cá nhân để học cách xây một website hoàn chỉnh, từ cơ sở dữ liệu, API, giao diện cho tới máy chủ, CI/CD và vận hành.

> **Trạng thái:** lõi của hệ thống đã chạy trọn luồng thuê xe và được deploy tự động lên hai máy chủ. Thanh toán đang là **giả lập**: không qua cổng thanh toán nào và không có tiền thật.

## Hệ thống làm được gì

| Vai trò | Chức năng |
| --- | --- |
| **Khách thuê** | Tìm và lọc xe theo thành phố, ngày, giá, số chỗ, nhiên liệu, hộp số. Xem lịch trống của xe. Gửi giấy phép lái xe để xác minh. Đặt xe, thanh toán, theo dõi đơn, xác nhận nhận xe và trả xe, hủy đơn |
| **Chủ xe** | Đăng xe kèm ảnh, giá và tỷ lệ cọc. Chặn những ngày bận. Duyệt hoặc từ chối đơn. Xác nhận giao xe và nhận lại xe. Theo dõi thu nhập theo từng đơn |
| **Quản trị viên** | Duyệt xe, duyệt giấy phép lái xe, khóa và mở tài khoản, xem mọi đơn và sổ tiền của nền tảng |

## Luồng thuê xe

```text
Khách đặt xe ──> giữ chỗ 15 phút ──> thanh toán (tiền thuê + tiền cọc)
                                            │
                              chủ xe duyệt trong 6 giờ
                                            │
              giao xe: chủ xe bấm "Giao xe" + khách bấm "Đã nhận xe"
                        └─> chủ xe được ghi nhận 50% tiền thuê
                                            │
              trả xe: khách bấm "Đã trả xe" + chủ xe bấm "Đã nhận lại xe"
                        └─> chủ xe nhận phần còn lại, khách được hoàn tiền cọc
```

Các quy tắc chính:

- **Tiền được giữ hộ.** Khách trả một lần khi đặt; chủ xe chỉ được ghi nhận tiền khi **cả hai bên** cùng xác nhận.
- **Chủ xe từ chối hoặc không trả lời trong 6 giờ:** khách được hoàn toàn bộ.
- **Hủy đơn:** tiền cọc luôn được hoàn. Tiền thuê hoàn 100% nếu hủy trước giờ nhận xe từ 48 giờ, 50% nếu từ 24 đến dưới 48 giờ, 0% nếu dưới 24 giờ.
- **Chỉ khách có giấy phép lái xe đã được duyệt mới đặt được xe.**
- **Mọi thay đổi của chủ xe** (thông tin, giá, ảnh) đưa xe về trạng thái chờ duyệt lại.

Đặc tả đầy đủ về trạng thái đơn, quyền theo vai trò và API nằm trong [SPEC.md](SPEC.md).

## Điểm kỹ thuật đáng chú ý

- **Chống trùng lịch bằng ràng buộc của CSDL**, không bằng mã kiểm tra. PostgreSQL từ chối hai đơn chồng giờ trên cùng một xe, kể cả khi hai yêu cầu tới cùng một lúc; API bắt lỗi đó và trả 409.

  ```sql
  ALTER TABLE bookings
    ADD CONSTRAINT bookings_no_overlap
    EXCLUDE USING gist (vehicle_id WITH =, tstzrange(start_at, end_at) WITH &&)
    WHERE (status IN ('pending', 'confirmed', 'in_use'));
  ```

- **Chuyển trạng thái đơn an toàn khi có tranh chấp.** Mỗi thao tác (thanh toán, duyệt, hủy, giao xe, trả xe) là một câu `UPDATE` có điều kiện, nên hai người bấm cùng lúc thì chỉ một bên thắng và tiền không bao giờ bị tính hai lần. Gọi lặp lại cho cùng kết quả.
- **Giữ chỗ có thời hạn không cần Redis:** cột `expires_at` và một job chạy mỗi phút.
- **Ảnh giấy phép lái xe là dữ liệu riêng tư.** Lưu ở kho tách biệt mà Nginx không đọc được, chỉ trả qua API cho chính chủ và quản trị viên, mỗi lần đọc đều ghi log.
- **Ảnh tải lên được vẽ lại thành WebP** trước khi lưu, vừa kiểm tra file có thật là ảnh, vừa loại bỏ EXIF và vị trí GPS.
- **Phiên đăng nhập:** access token 15 phút chỉ nằm trong bộ nhớ trình duyệt; refresh token trong cookie `httpOnly`, xoay vòng mỗi lần dùng. Mật khẩu băm bằng argon2id.
- **Phân quyền ở API:** mọi endpoint mặc định yêu cầu đăng nhập, kiểm tra cả vai trò lẫn quyền sở hữu. Có test tự liệt kê toàn bộ route và kiểm tra từng cái.

## Công nghệ

| Thành phần | Lựa chọn |
| --- | --- |
| Giao diện | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| API | NestJS 11, TypeScript, Prisma 6 |
| Cơ sở dữ liệu | PostgreSQL 16 |
| Đóng gói | Docker, Docker Compose |
| Web server | Nginx (reverse proxy, HTTPS) |
| CI/CD | GitHub Actions với runner tự host trên từng máy chủ |
| Kiểm thử | Jest và Supertest (API), Vitest (web), Playwright (E2E) |

## Kiến trúc

```text
Trình duyệt
    │ HTTPS
    ▼
  Nginx ──── /          ──> Next.js (web)
    │
    ├─────── /api       ──> NestJS (api) ──> PostgreSQL
    │                            │
    └─────── /uploads   ──> ảnh xe (volume công khai, chỉ đọc)
                                 │
                                 └──> ảnh giấy phép lái xe (volume riêng, chỉ API đọc được)
```

Toàn bộ chạy trên một máy chủ bằng Docker Compose. Web và API chung một tên miền, nên trình duyệt không cần CORS cho các lời gọi thông thường.

## Cấu trúc thư mục

```text
Car-Rental/
├── web/                  Next.js: trang, thành phần giao diện, test E2E (web/e2e)
├── api/                  NestJS: auth, users, vehicles, bookings, licenses, admin
│   └── prisma/           schema, migration, dữ liệu mẫu (seed)
├── infra/                docker-compose production, Nginx, script deploy, sao lưu, giám sát
├── docs/                 hướng dẫn deploy, CI/CD, sao lưu, runbook vận hành
├── .github/workflows/    CI (kiểm tra mỗi PR) và CD (deploy khi vào main)
├── SPEC.md               đặc tả: luồng, trạng thái, quyền, API
└── PLAN.md               kế hoạch theo ngày
```

## Chạy trên máy của bạn

Cần: Node.js 20 trở lên, pnpm 9, Docker.

```bash
cp .env.example api/.env                    # chỉ lần đầu
docker compose up -d db                     # PostgreSQL
pnpm install
pnpm --filter api prisma migrate dev        # tạo bảng
pnpm --filter api prisma db seed            # dữ liệu mẫu
pnpm dev                                    # web ở cổng 3000, API ở cổng 4000
```

Mở <http://localhost:3000>. Dữ liệu mẫu có sẵn các tài khoản sau, mật khẩu chung là `Password123!` (chỉ dùng cho môi trường local):

| Vai trò | Email |
| --- | --- |
| Quản trị viên | `admin@carrental.test` |
| Chủ xe | `chuxe.tran@carrental.test`, `chuxe.le@carrental.test` |
| Khách thuê (giấy phép đã duyệt) | `khach.an@carrental.test` |
| Khách thuê (giấy phép chờ duyệt) | `khach.binh@carrental.test` |
| Khách thuê (chưa gửi giấy phép) | `khach.cuong@carrental.test` |

### Thử thanh toán

Trang thanh toán có mục "Chọn kết quả muốn thử": thành công, không đủ số dư, hủy giao dịch, hoặc cổng không phản hồi. Ba kịch bản sau trả lỗi và giữ nguyên đơn, để thử luồng thanh toán thất bại rồi thanh toán lại.

## Kiểm thử

```bash
pnpm lint && pnpm typecheck && pnpm test    # lint, kiểm tra kiểu, test đơn vị và tích hợp
pnpm --filter web e2e                       # test E2E trên Chrome thật
```

- Test của API chạy trên một CSDL thử riêng, nên không đụng tới dữ liệu đang dùng để phát triển.
- Trước khi chạy E2E hãy **tắt `pnpm dev`**: Playwright tự khởi động API với giới hạn tốc độ được tắt, vì bộ test đăng nhập nhiều lần liên tiếp. E2E dùng CSDL phát triển và cần dữ liệu mẫu.

## Deploy và vận hành

Mỗi lần merge vào `main`, GitHub Actions chạy CI rồi deploy song song lên hai máy chủ (một máy ảo VMware và một server cloud). Hai máy độc lập: một máy lỗi không chặn máy còn lại.

| Tài liệu | Nội dung |
| --- | --- |
| [docs/ci-cd.md](docs/ci-cd.md) | CI, CD và cách cài runner |
| [docs/deploy-cloud.md](docs/deploy-cloud.md), [docs/deploy-vmware.md](docs/deploy-vmware.md) | Dựng máy chủ từ đầu |
| [docs/backup.md](docs/backup.md) | Sao lưu tự động và khôi phục |
| [docs/runbook.md](docs/runbook.md) | Giám sát, cảnh báo và xử lý sự cố |

## Giới hạn hiện tại

- **Thanh toán là giả lập.** Chưa tích hợp VNPay hay MoMo; sổ tiền chỉ là số liệu theo dõi.
- **Chưa có đặt lại mật khẩu**, vì hệ thống chưa gửi email hay tin nhắn.
- **Chưa có đánh giá, chat và bản đồ.**
- **Ảnh giấy phép lái xe chưa nằm trong bản sao lưu tự động.**

Hướng phát triển tiếp: đánh giá hai chiều, email thông báo, chat giữa khách và chủ xe, tìm xe trên bản đồ, và các tính năng AI (tư vấn chọn xe, tìm kiếm ngữ nghĩa, gợi ý giá).

## Quy ước phát triển

- TypeScript strict, không dùng `any`.
- Mỗi endpoint có DTO và validation; lỗi trả theo mẫu `{ code, message }`.
- Tiền là số nguyên VND; thời gian lưu UTC (`timestamptz`).
- Kiểm tra quyền sở hữu ở mọi endpoint, không chỉ vai trò.
- Không sửa migration đã commit; tạo migration mới.
- Sửa [SPEC.md](SPEC.md) trước khi đổi trạng thái đơn hay quyền, rồi mới sửa mã.
- Mỗi tính năng một nhánh `feat/<tên>`, commit nhỏ, CI xanh mới merge.
- Không commit `.env`; biến mẫu nằm trong `.env.example`.

## Lưu ý pháp lý

Dự án chỉ dùng cho mục đích học tập và thử nghiệm. Muốn vận hành với giao dịch thật cần tìm hiểu về giấy phép kinh doanh, bảo hiểm xe và quy định bảo vệ dữ liệu cá nhân, đặc biệt với giấy phép lái xe của người dùng.
