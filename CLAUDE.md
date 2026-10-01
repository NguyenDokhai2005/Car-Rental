# Car-Rental

Marketplace cho thuê xe tự lái (renter, owner, admin). Đọc `README.md` (tổng quan), `SPEC.md` (luồng, trạng thái, API) và `PLAN.md` (lịch) trước khi làm.

## Cấu trúc

- `web/`: Next.js (App Router), TypeScript, Tailwind
- `api/`: NestJS, Prisma, PostgreSQL; schema và migration ở `api/prisma/`
- `infra/`: docker-compose, Nginx, script backup
- `.github/workflows/`: CI/CD

Monorepo pnpm; chạy lệnh theo gói bằng `pnpm --filter web ...` / `pnpm --filter api ...`.

## Lệnh

```bash
docker compose up -d db
pnpm install
pnpm --filter api prisma migrate dev
pnpm dev            # web + api
pnpm lint && pnpm typecheck && pnpm test
```

(Một số lệnh chỉ chạy được sau khi khung dự án có, theo PLAN.md.)

## Quy ước

- TypeScript strict, không dùng `any`.
- Mỗi endpoint có DTO + validation; lỗi trả `{ code, message }`.
- Tiền là số nguyên VND; thời gian UTC (`timestamptz`).
- Kiểm tra quyền sở hữu ở mọi endpoint, không chỉ vai trò.
- Chống trùng lịch do ràng buộc DB `bookings_no_overlap`; bắt lỗi và trả 409, không tự kiểm tra bằng code rồi ghi.
- Không sửa migration đã commit; tạo migration mới. Ràng buộc `EXCLUDE` viết bằng SQL thô trong migration.
- Nhánh `feat/<tên>`, commit nhỏ dạng `feat: ...` / `fix: ...`.
- Không commit `.env`; biến mẫu ở `.env.example`.
- GPLX/giấy tờ lưu kho riêng, không công khai.
- Thanh toán chỉ sandbox; xử lý IPN phải idempotent và xác thực chữ ký.

## Khi làm việc

- Trạng thái đơn và quyền theo `SPEC.md`; nếu cần đổi, sửa SPEC trước rồi mới code.
- Hạ tầng chi phí $0: không thêm dịch vụ trả phí hoặc Redis ở MVP.
