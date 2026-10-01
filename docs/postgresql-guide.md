# Hướng dẫn dùng PostgreSQL cho Car-Rental

Tài liệu này dành cho người mới với PostgreSQL. Cơ sở dữ liệu của dự án chạy trong Docker, quản lý schema bằng Prisma.

## 1. Các khái niệm cần biết

| Từ | Nghĩa |
| --- | --- |
| **PostgreSQL** | Phần mềm cơ sở dữ liệu, chạy như một server riêng và lắng nghe cổng 5432. |
| **Database** | Một "ngăn" dữ liệu trong server. Dự án dùng database `carrental`. |
| **Bảng (table)** | Nơi lưu một loại dữ liệu, ví dụ `users`, `vehicles`, `bookings`. |
| **Migration** | File SQL ghi lại một thay đổi về cấu trúc (thêm bảng, thêm cột). Chạy lần lượt theo thứ tự thời gian. |
| **Prisma** | Công cụ cho code TypeScript đọc/ghi database và quản lý migration. |
| **psql** | Chương trình dòng lệnh để gõ SQL trực tiếp vào PostgreSQL. |

Thông tin kết nối (môi trường dev):

| Mục | Giá trị |
| --- | --- |
| Host | `localhost` |
| Cổng | `5432` |
| Database | `carrental` |
| User / Mật khẩu | `postgres` / `postgres` |
| Chuỗi kết nối | `postgresql://postgres:postgres@localhost:5432/carrental` |

Chuỗi này nằm trong `api/.env` (biến `DATABASE_URL`). File `.env` không được commit; mẫu ở `.env.example` ở thư mục gốc.

## 2. Bật và tắt database

Cần mở **Docker Desktop** trước (đợi biểu tượng cá voi báo "running").

```bash
# từ thư mục gốc dự án
docker compose up -d db        # bật PostgreSQL ở nền
docker compose ps              # xem trạng thái (healthy là sẵn sàng)
docker compose logs -f db      # xem log (Ctrl+C để thoát)
docker compose stop db         # tắt, GIỮ dữ liệu
docker compose down            # tắt và xóa container, vẫn GIỮ dữ liệu
docker compose down -v         # tắt và XÓA LUÔN dữ liệu (không hoàn tác được)
```

Dữ liệu nằm trong một volume của Docker, nên tắt máy hay `stop` không làm mất dữ liệu.

## 3. Lần đầu thiết lập

```bash
docker compose up -d db
pnpm install
cp .env.example api/.env              # chỉ lần đầu; Prisma đọc file này
pnpm --filter api prisma migrate dev  # tạo bảng
pnpm --filter api db:seed             # nạp dữ liệu mẫu
```

Máy chưa có `pnpm` thì thay bằng `npx pnpm@9` (ví dụ `npx pnpm@9 --filter api db:seed`).

### Tài khoản mẫu (mật khẩu chung: `Password123!`)

| Email | Vai trò | Ghi chú |
| --- | --- | --- |
| `admin@carrental.test` | admin | |
| `chuxe.tran@carrental.test` | owner | Có Vios, Accent, CX-5, City, XL7 (chờ duyệt) |
| `chuxe.le@carrental.test` | owner | Có VF 6, Xpander, Seltos, VF 5, Everest, Fortuner (chờ duyệt) |
| `khach.an@carrental.test` | renter | GPLX đã xác minh, có 3 đơn |
| `khach.binh@carrental.test` | renter | GPLX đang chờ admin xác minh |
| `khach.cuong@carrental.test` | renter | Chưa nộp GPLX |

Seed **xóa sạch dữ liệu cũ** rồi nạp lại, và từ chối chạy khi `NODE_ENV=production`.

## 4. Vào xem dữ liệu

### Cách 1: Prisma Studio (dễ nhất, có giao diện web)

```bash
pnpm --filter api prisma:studio
```

Mở http://localhost:5555, bấm từng bảng để xem và sửa dòng.

### Cách 2: psql trong container (gõ SQL)

```bash
docker exec -it carrental-db psql -U postgres -d carrental
```

Lệnh `\` của psql (không cần dấu chấm phẩy):

| Lệnh | Việc làm |
| --- | --- |
| `\dt` | Liệt kê bảng |
| `\d vehicles` | Xem cột, index, ràng buộc của một bảng |
| `\dT` | Liệt kê kiểu enum |
| `\l` | Liệt kê database |
| `\x` | Bật/tắt hiển thị dạng dọc (dễ đọc khi bảng nhiều cột) |
| `\q` | Thoát |

Câu SQL thì kết thúc bằng dấu `;`.

### Cách 3: phần mềm có giao diện (DBeaver, pgAdmin)

Tạo kết nối PostgreSQL mới với các thông tin ở mục 1.

## 5. SQL thường dùng với dự án

```sql
-- Xe đã duyệt ở TP.HCM, giá dưới 1 triệu, rẻ nhất trước
SELECT title, district, price_per_day
FROM vehicles
WHERE status = 'approved' AND city = 'TP. Hồ Chí Minh' AND price_per_day < 1000000
ORDER BY price_per_day;

-- Đơn của một khách, kèm tên xe
SELECT b.status, v.title, b.start_at, b.end_at, b.total_amount
FROM bookings b
JOIN vehicles v ON v.id = b.vehicle_id
JOIN users u ON u.id = b.renter_id
WHERE u.email = 'khach.an@carrental.test'
ORDER BY b.created_at DESC;

-- Xe còn trống trong khoảng ngày (không có đơn đang giữ lịch và không bị chặn)
SELECT v.title
FROM vehicles v
WHERE v.status = 'approved'
  AND NOT EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.vehicle_id = v.id
      AND b.status IN ('pending', 'confirmed', 'in_use')
      AND tstzrange(b.start_at, b.end_at) && tstzrange('2026-10-12 02:00+00', '2026-10-14 02:00+00')
  )
  AND NOT EXISTS (
    SELECT 1 FROM vehicle_blocks k
    WHERE k.vehicle_id = v.id
      AND tstzrange(k.start_at, k.end_at) && tstzrange('2026-10-12 02:00+00', '2026-10-14 02:00+00')
  );

-- Hàng đợi admin: xe chờ duyệt và GPLX chờ xác minh
SELECT title, created_at FROM vehicles WHERE status = 'pending' ORDER BY created_at;
SELECT full_name, license_number FROM users WHERE license_status = 'pending';

-- Giờ hiển thị theo Việt Nam (DB lưu UTC)
SELECT start_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS start_vn FROM bookings;
```

Lưu ý: trong DB, thời gian luôn là UTC (`timestamptz`) và tiền là số nguyên đồng (650000 nghĩa là 650.000đ).

## 6. Prisma: các lệnh hay dùng

Chạy từ thư mục gốc, thêm `--filter api`:

| Lệnh | Khi nào dùng |
| --- | --- |
| `pnpm --filter api prisma migrate dev --name <ten>` | Sau khi sửa `schema.prisma`: tạo migration mới và áp dụng |
| `pnpm --filter api prisma:deploy` | Chỉ áp dụng migration có sẵn (dùng khi deploy, không tạo mới) |
| `pnpm --filter api prisma:generate` | Sinh lại Prisma Client (thường tự chạy sau migrate) |
| `pnpm --filter api db:seed` | Nạp lại dữ liệu mẫu |
| `pnpm --filter api prisma:studio` | Mở giao diện xem dữ liệu |
| `pnpm --filter api db:reset` | **Xóa toàn bộ database**, chạy lại mọi migration và seed. Chỉ dùng ở dev |

### Quy tắc khi đổi cấu trúc database

1. **Không sửa migration đã commit.** Muốn đổi, tạo migration mới.
2. Thay đổi thông thường (thêm bảng, thêm cột): sửa `api/prisma/schema.prisma` rồi `prisma migrate dev --name mo_ta_ngan`.
3. **`EXCLUDE`, `CHECK` và index có điều kiện** Prisma không diễn đạt được. Tạo migration rỗng bằng `prisma migrate dev --create-only --name <ten>`, mở file `migration.sql` vừa sinh, viết SQL thô vào rồi chạy `prisma migrate dev`. Mẫu: `api/prisma/migrations/20261001093500_init_constraints/migration.sql`.
4. Sau đó kiểm tra Prisma không coi ràng buộc thô là lệch: lệnh `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` phải in ra `This is an empty migration.`

## 7. Những ràng buộc đã có sẵn trong database

Database tự từ chối dữ liệu sai, kể cả khi code có lỗi:

| Ràng buộc | Chặn gì |
| --- | --- |
| `bookings_no_overlap` | Hai đơn đang giữ lịch (`pending`, `confirmed`, `in_use`) của cùng một xe chồng khoảng giờ. Đơn nối tiếp (trả xe lúc 9h, đơn sau nhận lúc 9h) vẫn hợp lệ |
| `vehicle_blocks_no_overlap` | Hai lịch chặn chồng nhau trên cùng một xe |
| `payments_one_paid_per_booking` | Một đơn có hai khoản thanh toán `paid` |
| `UNIQUE(txn_ref)` | Xử lý trùng một giao dịch thanh toán (nền tảng cho IPN idempotent) |
| CHECK về tiền và ngày | Cọc lớn hơn tổng, số chỗ ngoài 2 đến 16, ngày trả trước ngày nhận, từ chối mà không có lý do... |
| Trigger trên `license_access_logs` | Sửa hoặc xóa log truy cập GPLX |

### Bắt lỗi trùng lịch trong code (để trả 409)

Theo quy ước dự án, **không** tự kiểm tra trùng lịch bằng code rồi mới ghi. Cứ ghi, và để database từ chối. Đã kiểm chứng với Prisma 6: lỗi này **không có mã Prisma riêng** (không phải `P2002`). Nó là `PrismaClientUnknownRequestError` với `code` rỗng, nên nhận biết qua nội dung:

```ts
import { Prisma } from "@prisma/client";

function isBookingOverlap(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientUnknownRequestError &&
    error.message.includes("bookings_no_overlap")
  );
}

try {
  await prisma.booking.create({ data });
} catch (error) {
  if (isBookingOverlap(error)) {
    // trả 409 { code: "BOOKING_OVERLAP", message: "Xe đã có người đặt trong khoảng thời gian này" }
  }
  throw error;
}
```

Mã PostgreSQL của lỗi này là `23P01` (exclusion_violation).

## 8. Sao lưu và khôi phục thủ công

```bash
# Sao lưu ra file
docker exec carrental-db pg_dump -U postgres -Fc carrental > carrental.dump

# Khôi phục vào một database (ví dụ tạo mới carrental_restore)
docker exec carrental-db psql -U postgres -c "CREATE DATABASE carrental_restore;"
docker exec -i carrental-db pg_restore -U postgres -d carrental_restore < carrental.dump
```

Kế hoạch backup tự động hằng ngày nằm ở PLAN.md (Ngày 6).

## 9. Lỗi thường gặp

| Triệu chứng | Nguyên nhân và cách xử lý |
| --- | --- |
| `failed to connect to the docker API` | Docker Desktop chưa chạy. Mở nó rồi thử lại |
| `Can't reach database server at localhost:5432` | Container chưa bật (`docker compose up -d db`) hoặc chưa `healthy` (đợi vài giây) |
| `port is already allocated` khi bật DB | Máy đang có PostgreSQL khác dùng cổng 5432. Tắt nó, hoặc đổi cổng trong `infra/docker-compose.yml` (ví dụ `"5433:5432"`) và sửa `DATABASE_URL` cho khớp |
| `password authentication failed` | `DATABASE_URL` trong `api/.env` khác với `POSTGRES_PASSWORD` trong `infra/docker-compose.yml`. Lưu ý mật khẩu chỉ có tác dụng ở lần tạo volume đầu tiên |
| `Environment variable not found: DATABASE_URL` | Chưa có file `api/.env`. Chạy `cp .env.example api/.env` |
| `conflicting key value violates exclusion constraint "bookings_no_overlap"` | Không phải lỗi hệ thống: có đơn khác đã giữ lịch xe đó. API cần trả 409 |
| `Prisma Migrate detected that it was invoked by Claude Code` | Prisma chặn các lệnh phá dữ liệu (như `migrate reset`) khi do AI chạy. Bạn tự chạy lệnh đó trong terminal của mình |

## 10. Dữ liệu sẽ không mất khi nào

- Tắt máy, tắt Docker, `docker compose stop` hoặc `down`: **dữ liệu còn**.
- `docker compose down -v`, `prisma migrate reset`, `db:seed`: **dữ liệu bị xóa**. Seed và reset chỉ dành cho dev.
