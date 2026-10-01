# Car-Rental

Nền tảng marketplace cho thuê xe tự lái: chủ xe cá nhân đăng xe, khách thuê tìm và đặt xe, thanh toán, còn admin kiểm duyệt xe và người dùng.

> **Trạng thái:** đang ở giai đoạn lập kế hoạch, chưa có code. Các lệnh và cấu trúc thư mục bên dưới là dự kiến và sẽ được cập nhật khi dự án thành hình.

## Mục tiêu

- Dự án cá nhân để học và xây một website hoàn chỉnh: frontend, backend, cơ sở dữ liệu, cấu hình server, deploy và public cho mọi người dùng.
- Ràng buộc: hạ tầng chi phí $0 đến khi có MVP, khoảng 10 giờ làm việc mỗi ngày, cơ sở dữ liệu PostgreSQL.
- Sau MVP sẽ bổ sung các tính năng AI (chatbot tư vấn chọn xe, tìm kiếm ngữ nghĩa, gợi ý giá cho chủ xe).

## Vai trò người dùng

| Vai trò | Làm được gì |
| --- | --- |
| Khách thuê (renter) | Tìm và lọc xe, xem chi tiết, đặt xe, thanh toán, xem lịch sử đơn |
| Chủ xe (owner) | Đăng xe kèm ảnh và giá, quản lý lịch trống, duyệt hoặc từ chối đơn |
| Admin | Duyệt xe và người dùng, xem đơn, xác minh giấy phép lái xe thủ công |

## Phạm vi

**MVP (mục tiêu hoàn thành sau khoảng 18 ngày làm việc):**

- Tài khoản 3 vai trò, đăng ký, đăng nhập
- Đăng xe, tải ảnh, admin duyệt xe
- Tìm xe theo thành phố, giá, số chỗ; trang chi tiết xe có SEO
- Đặt xe có chống trùng lịch, giữ chỗ có thời hạn, hủy đơn và hoàn cọc
- Thanh toán sandbox (VNPay hoặc MoMo)
- Trang admin cơ bản, chạy ổn định trên server thật qua HTTPS

**Sau MVP:** đánh giá hai chiều, chat giữa khách và chủ xe, email thông báo, tìm xe trên bản đồ, các tính năng AI.

## Công nghệ

| Thành phần | Lựa chọn |
| --- | --- |
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS |
| Backend | NestJS, TypeScript, Prisma |
| Cơ sở dữ liệu | PostgreSQL (về sau thêm `pgvector` cho AI và `PostGIS` cho bản đồ) |
| Đóng gói | Docker, Docker Compose |
| Web server | Nginx (reverse proxy), HTTPS bằng Let's Encrypt |
| CI/CD | GitHub, GitHub Actions (test, build, deploy qua SSH) |
| Máy chủ | AWS EC2 gói miễn phí; Oracle Cloud Always Free là phương án dự phòng |
| Thanh toán | VNPay hoặc MoMo sandbox |

## Kiến trúc

```text
Trình duyệt
    |
    v
Nginx (HTTPS)  ---- /      --->  Next.js (web)
    |
    +------------- /api   --->  NestJS (api) ---> PostgreSQL
                                     |
                                     +---> Cổng thanh toán sandbox
```

Toàn bộ ứng dụng chạy trên một máy chủ bằng Docker Compose. Ảnh xe lưu trên ổ đĩa của máy chủ qua một lớp `StorageService` để sau này đổi sang S3 dễ dàng. Việc giữ chỗ đơn dùng cột `expires_at` trong PostgreSQL và một job chạy định kỳ, không cần Redis ở giai đoạn MVP.

## Mô hình dữ liệu

Các bảng chính: `users`, `vehicles`, `vehicle_images`, `bookings`, `payments` (và `reviews` sau MVP). Bảng `bookings` là trung tâm, nối khách, xe và các khoản thanh toán.

Chống trùng lịch được giao cho một ràng buộc trong database thay vì code kiểm tra:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    vehicle_id WITH =,
    tstzrange(start_at, end_at) WITH &&
  )
  WHERE (status IN ('pending', 'confirmed', 'in_use'));
```

Khi hai request cùng đặt một xe trong khoảng giờ chồng nhau, request đến sau nhận lỗi vi phạm ràng buộc và API trả mã 409.

## Cấu trúc thư mục (dự kiến)

```text
Car-Rental/
├── web/                 # Next.js
├── api/                 # NestJS + Prisma
│   └── prisma/          # schema và migrations
├── infra/               # docker-compose, cấu hình Nginx, script backup
├── .github/workflows/   # CI/CD
├── CLAUDE.md            # hướng dẫn cho Claude Code
├── SPEC.md              # đặc tả chi tiết (sẽ viết ở Ngày 1)
└── README.md
```

## Lộ trình

| Tuần | Nội dung | Mốc |
| --- | --- | --- |
| 1 | Khung dự án, API nền, đăng nhập, deploy đầu tiên, CI/CD, sao lưu | Web chạy trên HTTPS |
| 2 | Quản lý xe, tải ảnh, tìm kiếm và lọc, trang xe | Đăng và tìm được xe |
| 3 | Đặt xe, chống trùng lịch, thanh toán sandbox, hủy và hoàn cọc | **MVP**: thuê xe trọn luồng trên server thật |
| 4 | Admin, xác minh giấy phép lái xe, bảo mật, kiểm thử, vận hành, ra mắt nhẹ | Sẵn sàng mời người dùng thử |

Lịch chi tiết theo từng ngày nằm trong tài liệu kế hoạch code.

## Chạy dự án (dự kiến)

```bash
docker compose up -d db          # chạy PostgreSQL
pnpm install
pnpm --filter api prisma migrate dev
pnpm dev                         # web và api
```

Các lệnh trên sẽ chạy được sau Ngày 2 của lịch; hãy cập nhật mục này khi khung dự án đã có.

## Quy ước phát triển

- TypeScript strict, không dùng `any`.
- Mỗi endpoint có DTO và validation; lỗi trả theo mẫu `{ code, message }`.
- Tiền lưu bằng số nguyên VND; thời gian lưu UTC (`timestamptz`).
- Mỗi tính năng một nhánh `feat/<tên>`, commit nhỏ, dạng `feat: ...`.
- Không commit `.env`; biến mẫu nằm trong `.env.example`.
- Không sửa migration đã commit; tạo migration mới.

## Lưu ý

- Thanh toán chỉ dùng môi trường sandbox trong giai đoạn MVP; nếu mở cho giao dịch thật cần tìm hiểu giấy phép kinh doanh, bảo hiểm xe và quy định bảo vệ dữ liệu cá nhân.
- Giấy phép lái xe và giấy tờ tùy thân là dữ liệu nhạy cảm: lưu trong kho riêng không công khai, giới hạn quyền đọc.
