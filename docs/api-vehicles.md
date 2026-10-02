# API xe và lịch trống

Mã nguồn: `api/src/vehicles/`. Đặc tả: SPEC.md §2 (luồng đăng xe) và §7 (Xe công khai, Xe owner). PLAN Ngày 7.

Chưa có trong phần này (làm ở ngày khác): tải ảnh (Ngày 8), tìm xe và chi tiết xe công khai (Ngày 10 và 11), duyệt xe bởi admin (Ngày 12).

## Endpoint

Mọi endpoint `/owner/...` yêu cầu đăng nhập với vai trò `owner` và chỉ thao tác trên xe của chính mình.

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | `/api/owner/vehicles` | Xe của tôi. Query `status`, `page`, `limit` |
| POST | `/api/owner/vehicles` | Tạo xe, trạng thái `pending` |
| GET | `/api/owner/vehicles/:id` | Chi tiết một xe của tôi |
| PATCH | `/api/owner/vehicles/:id` | Sửa xe (xem luật trạng thái bên dưới) |
| POST | `/api/owner/vehicles/:id/hide` | Ẩn hoặc hiện xe, body `{ "hidden": true }` |
| GET | `/api/owner/vehicles/:id/blocks` | Danh sách lịch chặn |
| POST | `/api/owner/vehicles/:id/blocks` | Chặn lịch `{ startAt, endAt, reason? }` |
| DELETE | `/api/owner/vehicles/:id/blocks/:blockId` | Bỏ chặn |
| GET | `/api/owner/vehicles/:id/calendar?month=YYYY-MM` | Lịch tháng cho chủ xe, có phân biệt `booked` và `blocked` |
| GET | `/api/vehicles/:id/availability?month=YYYY-MM` | **Công khai.** Các khoảng đã bị giữ lịch của xe đã duyệt |

## Trạng thái của xe

```text
            tạo mới
               │
               ▼
           ┌─────────┐   admin duyệt     ┌──────────┐   chủ xe ẩn      ┌────────┐
           │ pending │ ────────────────▶ │ approved │ ───────────────▶ │ hidden │
           └─────────┘                   └──────────┘ ◀─────────────── └────────┘
             ▲    │                          │             chủ xe hiện       │
             │    │ admin từ chối            │ đổi thông tin quan trọng      │
             │    ▼                          │ (về pending)                  │
             │ ┌──────────┐                  ▼                               │
             └─│ rejected │            (về pending) ◀────────────────────────┘
   chủ xe sửa  └──────────┘               đổi thông tin quan trọng
   lại là nộp lại
```

| Chủ xe làm gì | Xe đang | Xe thành |
| --- | --- | --- |
| Sửa **thông tin quan trọng** (biển số, hãng, mẫu, năm, số chỗ, hộp số, nhiên liệu, giá, tỷ lệ cọc) | `approved` hoặc `hidden` | `pending` (admin phải duyệt lại, kết quả duyệt cũ bị xóa) |
| Sửa mô tả, thành phố, quận | `approved` hoặc `hidden` | giữ nguyên |
| Sửa bất kỳ trường nào | `rejected` | `pending` (nộp lại), lý do từ chối bị xóa |
| Sửa | `pending` | giữ `pending` |
| Gửi lại đúng giá trị cũ | bất kỳ | giữ nguyên, không tính là thay đổi |
| Ẩn xe | `approved` | `hidden` |
| Hiện xe | `hidden` | `approved` |
| Ẩn hoặc hiện sai trạng thái (ví dụ ẩn xe `pending`) | | 409 `INVALID_STATE` |

Điểm đáng chú ý:

- Chủ xe **không thể tự duyệt xe**: `status` không nằm trong DTO tạo và sửa, nên gửi lên là bị 400. Xe `pending` cũng không dùng được nút "hiện" để lách bước duyệt.
- Sửa xe dùng điều kiện `status` trong câu `UPDATE` (kiểm tra lạc quan). Nếu admin vừa duyệt hoặc từ chối giữa lúc chủ xe bấm lưu, thao tác của chủ xe trả 409 thay vì ghi đè kết quả của admin.
- Ẩn xe **không hủy** đơn đã có. Xe chỉ ngừng nhận đơn mới.

## Quyền sở hữu

- Mọi truy vấn xe của chủ xe có điều kiện `ownerId` ngay trong câu `WHERE`. Id của chủ xe lấy từ access token, **không bao giờ nhận từ client**.
- Xe của người khác và xe không tồn tại đều trả **404** với cùng nội dung, để không lộ xe nào tồn tại.
- Id sai định dạng UUID cũng trả 404 (không trả 500).
- Lịch chặn thuộc xe khác của cùng chủ xe cũng không xóa được qua đường dẫn của xe này.

## Chặn lịch và chống đặt trùng

Có hai bảng giữ lịch của một xe: `bookings` (đơn) và `vehicle_blocks` (lịch chặn). Ràng buộc `EXCLUDE` của PostgreSQL chỉ chặn chồng lịch **trong một bảng**, không chạy chéo hai bảng. Vì vậy:

- Hai lịch chặn chồng nhau: DB từ chối (`vehicle_blocks_no_overlap`), API trả 409 `BLOCK_OVERLAP`.
- Lịch chặn chồng đơn đang giữ lịch (`pending`, `confirmed`, `in_use`): API kiểm tra và trả 409 `BLOCK_CONFLICTS_BOOKING`.
- Để hai request đồng thời (một chặn lịch, một đặt xe) không cùng thấy "chưa có gì" rồi cùng ghi, cả hai phải lấy **khóa theo xe** (`lockVehicle` trong `api/src/common/vehicle-lock.ts`) trước khi kiểm tra bảng còn lại. Khóa tự nhả khi transaction kết thúc.

> **Việc cho PLAN Ngày 13 (tạo đơn):** API tạo đơn **phải** gọi `lockVehicle(tx, vehicleId)` trong transaction, rồi kiểm tra `vehicle_blocks` chồng khoảng thời gian, rồi mới ghi đơn. Có sẵn test chứng minh khóa này cần thiết: bỏ khóa đi thì test "chặn lịch phải đợi transaction đang giữ khóa xe" thất bại.

Đơn kết thúc đúng lúc đơn khác bắt đầu, hay hai lịch chặn nối tiếp, **không** bị coi là chồng (khoảng thời gian nửa mở).

## Lịch trống công khai

`GET /api/vehicles/:id/availability?month=2026-10` trả:

```json
{
  "vehicleId": "…",
  "month": "2026-10",
  "busy": [
    { "startAt": "2026-10-12T02:00:00.000Z", "endAt": "2026-10-14T02:00:00.000Z" }
  ]
}
```

- Gồm đơn đang giữ lịch và lịch chặn của chủ xe, **không phân biệt hai loại** và không lộ người thuê hay lý do chặn.
- Chỉ xe `approved`; xe `pending`, `rejected`, `hidden` hoặc không tồn tại trả 404.
- "Tháng" tính theo **giờ Việt Nam**: `2026-10` là từ 00:00 ngày 1/10 đến trước 00:00 ngày 1/11 theo giờ Việt Nam (UTC+7). Mặc định là tháng hiện tại.
- Trả đủ khoảng thời gian của đơn dù nó bắc qua ranh giới tháng; phía giao diện tự cắt theo ô lịch.
- Giờ trả về luôn là UTC. Giao diện đổi sang `Asia/Ho_Chi_Minh` khi hiển thị.

## Dùng thử

```bash
# Đăng nhập chủ xe (tài khoản mẫu) rồi gán token
TOKEN=$(curl -s -X POST localhost:4000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"chuxe.tran@carrental.test","password":"Password123!"}' | python -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")

# Đăng xe mới
curl -X POST localhost:4000/api/owner/vehicles -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"brand":"Toyota","model":"Vios","year":2022,"plateNumber":"51K-123.99","seats":5,
       "transmission":"automatic","fuel":"petrol","city":"TP. Hồ Chí Minh","district":"Quận 7",
       "pricePerDay":650000,"depositRate":30}'

# Xe của tôi, chỉ xe chờ duyệt
curl "localhost:4000/api/owner/vehicles?status=pending" -H "Authorization: Bearer $TOKEN"

# Chặn lịch (giờ ISO 8601 có múi giờ)
curl -X POST localhost:4000/api/owner/vehicles/<id>/blocks -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"startAt":"2026-12-01T00:00:00+07:00","endAt":"2026-12-03T00:00:00+07:00","reason":"Đi bảo dưỡng"}'

# Lịch trống công khai, không cần token
curl "localhost:4000/api/vehicles/<id>/availability?month=2026-12"
```

## Mã lỗi mới

| Mã | HTTP | Khi nào |
| --- | --- | --- |
| `PLATE_TAKEN` | 409 | Biển số đã có ở xe khác (không phân biệt chữ hoa thường, dấu cách, dấu gạch, dấu chấm) |
| `INVALID_STATE` | 409 | Ẩn hoặc hiện xe sai trạng thái; hoặc xe vừa bị đổi trạng thái khi đang sửa |
| `BLOCK_OVERLAP` | 409 | Lịch chặn chồng lịch chặn khác |
| `BLOCK_CONFLICTS_BOOKING` | 409 | Lịch chặn chồng đơn đang giữ lịch |

## Quy ước dữ liệu

- `title` do hệ thống tạo từ hãng, mẫu, năm (`Toyota Vios 2022`) và tạo lại khi các trường đó đổi; client không gửi được.
- Biển số được lưu ở **dạng chuẩn: chỉ chữ và số, viết hoa**. Người dùng nhập `51k-123.45`, `51K 123.45` hay `51K12345` đều thành `51K12345`, nên cùng một xe không thể đăng hai lần bằng cách viết khác đi. Biển số dài 5 đến 12 ký tự sau khi chuẩn hóa. Nếu cần hiển thị đẹp (`51K-123.45`), giao diện tự định dạng lại; API không trả dạng có dấu.
- Giá là số nguyên đồng, từ 50.000 đến 100.000.000 mỗi ngày. Tỷ lệ cọc là số nguyên 0 đến 100, mặc định 30.
- Thời gian gửi lên phải là ISO 8601 **có múi giờ**. Ngày trần (`2026-12-01`) hay giờ không múi giờ bị từ chối vì không rõ múi giờ.
