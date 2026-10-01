# Kế hoạch thực hiện Car-Rental

Nguồn: README.md. Mốc: MVP sau 18 ngày làm việc (~10 giờ/ngày), chi phí hạ tầng $0, PostgreSQL.
Lịch theo ngày dưới đây do tôi suy ra từ lộ trình 4 tuần trong README; chỉnh lại nếu bạn có bản kế hoạch gốc.

## Nguyên tắc

- Làm theo lát cắt dọc (DB → API → UI) cho từng tính năng, deploy sớm và deploy liên tục.
- Rủi ro cao làm sớm: deploy lên server thật (Ngày 3–5), chống trùng lịch và thanh toán (Tuần 3).
- Mỗi tính năng một nhánh `feat/<tên>`, commit nhỏ, CI xanh mới merge.

## Tuần 1: Khung dự án, đăng nhập, deploy đầu tiên

| Ngày | Công việc | Kết quả kiểm tra được |
| --- | --- | --- |
| 1 | Viết `SPEC.md` (luồng, trạng thái booking, quyền theo vai trò, API); `CLAUDE.md`; tạo repo, monorepo pnpm | SPEC được chốt |
| 2 | Khung `web` (Next.js + Tailwind), `api` (NestJS + Prisma), `docker-compose` cho Postgres, `.env.example` | `pnpm dev` chạy cả hai |
| 3 | Schema Prisma: users, vehicles, vehicle_images, bookings, payments; migration đầu; seed dữ liệu mẫu | Migrate chạy sạch |
| 4 | Auth: đăng ký, đăng nhập, JWT (access + refresh), phân quyền 3 vai trò (guard), DTO + validation, lỗi `{ code, message }` | Đăng nhập được, sai quyền trả 403 |
| 5 | Dựng server (AWS EC2 free; dự phòng Oracle), Docker Compose production, Nginx, HTTPS Let's Encrypt, domain | Web chạy trên HTTPS |
| 6 | GitHub Actions: test, build, deploy qua SSH; sao lưu Postgres định kỳ (cron + `pg_dump`), thử khôi phục | Push là deploy; restore thử thành công |

## Tuần 2: Xe, ảnh, tìm kiếm

| Ngày | Công việc |
| --- | --- |
| 7 | API xe: owner tạo/sửa/ẩn xe, trạng thái `pending/approved/rejected`; lịch trống của xe |
| 8 | Tải ảnh: `StorageService` (ổ đĩa), giới hạn loại/kích thước, resize, phục vụ qua Nginx |
| 9 | UI chủ xe: form đăng xe, danh sách xe của tôi, upload ảnh |
| 10 | API tìm kiếm: lọc thành phố, khoảng giá, số chỗ, khoảng ngày trống; phân trang; index DB |
| 11 | UI khách: trang chủ, trang tìm kiếm + bộ lọc, trang chi tiết xe (SSR, metadata SEO, sitemap) |
| 12 | Duyệt xe cơ bản (API admin), polish, kiểm thử luồng đăng và tìm xe trên server thật |

Mốc: đăng được xe, tìm được xe.

## Tuần 3: Đặt xe và thanh toán (MVP)

| Ngày | Công việc |
| --- | --- |
| 13 | Ràng buộc `bookings_no_overlap` (btree_gist) bằng migration SQL thô; API tạo booking, bắt lỗi vi phạm → 409; test đua 2 request đồng thời |
| 14 | Giữ chỗ: `expires_at` + job định kỳ nhả đơn hết hạn; máy trạng thái booking (pending → confirmed → in_use → completed/cancelled); chủ xe duyệt/từ chối |
| 15 | Thanh toán sandbox VNPay/MoMo: tạo giao dịch, redirect, return URL |
| 16 | IPN/webhook: xác thực chữ ký, idempotent, cập nhật `payments` và booking |
| 17 | Hủy đơn và hoàn cọc theo chính sách (ghi trong SPEC); UI đặt xe, thanh toán, lịch sử đơn |
| 18 | Kiểm thử trọn luồng trên server thật, sửa lỗi |

Mốc: **MVP**, thuê xe trọn luồng trên HTTPS.

## Tuần 4: Admin, bảo mật, vận hành, ra mắt

| Ngày | Công việc |
| --- | --- |
| 19 | Trang admin: duyệt xe/người dùng, xem đơn, khóa tài khoản |
| 20 | Xác minh GPLX thủ công: upload vào kho riêng (không công khai), giới hạn quyền đọc, ghi log truy cập |
| 21 | Bảo mật: rate limit, CORS, helmet, kiểm tra quyền sở hữu mọi endpoint, rà soát secrets |
| 22 | Kiểm thử: unit/integration cho booking, payment, auth; E2E vài luồng chính (Playwright) |
| 23 | Vận hành: log, giám sát uptime, cảnh báo, kiểm tra backup, tài liệu runbook |
| 24 | Ra mắt nhẹ: mời người dùng thử, thu phản hồi, sửa lỗi |

(Tuần 4 gồm 6 ngày nên tổng là 24 ngày; 18 ngày đầu là MVP, phần còn lại là hoàn thiện. Ngày 6 và 12 có dư để làm bù trễ.)

## Rủi ro chính

| Rủi ro | Biện pháp |
| --- | --- |
| Free tier AWS hết hạn hoặc RAM thấp | Theo dõi tài khoản; thêm swap; Oracle Always Free dự phòng |
| Đăng ký VNPay/MoMo sandbox chậm | Đăng ký ngay Ngày 1; có adapter thanh toán giả để không bị chặn |
| Race condition đặt xe | Dựa vào ràng buộc DB, có test đồng thời |
| Mất dữ liệu | Backup tự động + thử restore ở Ngày 6 |
| Lộ GPLX/giấy tờ | Kho riêng, quyền đọc hẹp, không đưa vào URL công khai |
| Trễ lịch | Cắt phạm vi UI trước, giữ nguyên lõi booking/payment |

## Sau MVP (backlog)

Đánh giá hai chiều → email thông báo → chat → bản đồ (PostGIS) → AI (chatbot tư vấn, tìm kiếm ngữ nghĩa với pgvector, gợi ý giá).

## Việc cần làm ngay

1. Đăng ký tài khoản sandbox VNPay/MoMo, AWS, domain.
2. Ngày 1: viết SPEC.md, chốt chính sách hủy/hoàn cọc và máy trạng thái booking.
