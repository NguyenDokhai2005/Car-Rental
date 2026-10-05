# SPEC: Car-Rental

Đặc tả cho MVP. Các giá trị đánh dấu **(đề xuất)** là mặc định tôi chọn, có thể chỉnh trước khi code.

## 1. Vai trò và quyền

| Hành động | Khách (renter) | Chủ xe (owner) | Admin |
| --- | :-: | :-: | :-: |
| Xem/tìm xe đã duyệt (công khai) | ✓ | ✓ | ✓ |
| Đăng ký, đăng nhập, sửa hồ sơ của mình | ✓ | ✓ | ✓ |
| Tải GPLX của mình | ✓ | | |
| Tạo đơn đặt xe | ✓ | | |
| Xem/hủy đơn của mình | ✓ | | |
| Tạo/sửa/ẩn xe của mình, tải ảnh | | ✓ | |
| Quản lý lịch chặn (không cho thuê) của xe mình | | ✓ | |
| Duyệt/từ chối đơn trên xe của mình | | ✓ | |
| Duyệt/từ chối xe | | | ✓ |
| Xác minh GPLX, khóa/mở người dùng | | | ✓ |
| Xem mọi đơn và thanh toán | | | ✓ |

Quy tắc chung: mọi endpoint kiểm tra quyền **sở hữu** (owner chỉ thấy xe/đơn của mình, khách chỉ thấy đơn của mình), không chỉ kiểm tra vai trò. Một tài khoản có đúng một vai trò; muốn vừa thuê vừa cho thuê thì dùng hai tài khoản (đơn giản hóa MVP).

## 2. Luồng chính

**Đăng xe:** owner tạo xe (trạng thái `pending`) → tải ảnh → admin duyệt (`approved`) hoặc từ chối kèm lý do (`rejected`) → xe `approved` mới hiện công khai. **Mọi thay đổi của owner đều phải được admin duyệt lại:** sửa bất kỳ thông tin nào (kể cả mô tả, thành phố, quận, giá thuê, tỷ lệ cọc), tải thêm ảnh hoặc xóa ảnh trên xe `approved`, `hidden` hay `rejected` đều đưa xe về `pending`, xóa kết quả duyệt cũ (lý do từ chối, người duyệt, thời điểm duyệt). Trong lúc chờ duyệt lại, xe không hiện công khai và không nhận đơn mới; các đơn đã có vẫn giữ nguyên. Gửi lại đúng giá trị cũ không tính là thay đổi. Xe đang `pending` mà sửa tiếp thì vẫn `pending`. Xe chưa có ảnh nào thì không duyệt được.

**Trạng thái xe:** `pending` (chờ duyệt) → `approved` (công khai) hoặc `rejected` (kèm lý do). Owner ẩn xe `approved` thì thành `hidden` (không hiện công khai, không nhận đơn mới, đơn đã có vẫn giữ nguyên) và hiện lại thì về `approved` mà không cần duyệt lại (ẩn và hiện không phải thay đổi nội dung). Xe `hidden` mà bị sửa thì về `pending` như trên, và sau khi được duyệt sẽ thành `approved`. Chỉ xe `approved` mới ẩn được; chỉ xe `hidden` mới hiện lại được.

**Thuê xe:**
1. Khách tìm xe theo thành phố, giá, số chỗ, khoảng ngày.
2. Mở trang xe, chọn `start_at`/`end_at`, hệ thống tính giá và cọc.
3. Khách có GPLX đã xác minh mới được đặt (xem mục 6).
4. Tạo đơn → `pending`. Chủ xe có **6 giờ** để duyệt hoặc từ chối; trong thời gian đó đơn giữ lịch của xe (`expires_at` = lúc tạo + 6 giờ, nhưng không muộn hơn giờ nhận xe: đơn chưa được duyệt thì không thể còn chờ khi chuyến đi đã bắt đầu).
5. Owner duyệt → `expires_at` được đặt lại thành 15 phút kể từ lúc duyệt; khách thanh toán cọc trong khoảng đó. Quá một trong hai hạn (6 giờ chờ duyệt, hoặc 15 phút chờ thanh toán) → đơn `expired`, nhả lịch.
6. Thanh toán thành công (qua IPN) → `confirmed`.
7. Nhận xe → `in_use`; trả xe → `completed`. Owner bấm xác nhận nhận/trả (MVP không có check-in tự động).

Quyết định thứ tự duyệt/thanh toán: owner duyệt **trước**, khách trả cọc **sau**, để không phải hoàn tiền khi owner từ chối.

## 3. Trạng thái đơn (booking)

| Trạng thái | Giữ lịch? | Ý nghĩa |
| --- | :-: | --- |
| `pending` | ✓ | Vừa tạo, chờ owner duyệt rồi chờ thanh toán cọc, có `expires_at` |
| `confirmed` | ✓ | Đã duyệt và đã trả cọc |
| `in_use` | ✓ | Đang thuê |
| `completed` | | Đã trả xe |
| `rejected` | | Owner từ chối |
| `cancelled` | | Khách (hoặc admin) hủy |
| `expired` | | Hết hạn giữ chỗ chưa thanh toán |

Chuyển trạng thái hợp lệ:

```text
pending   -> confirmed   (owner đã duyệt + IPN thanh toán thành công)
pending   -> rejected    (owner từ chối)
pending   -> cancelled   (khách hủy)
pending   -> expired     (job quá expires_at)
confirmed -> in_use      (owner xác nhận giao xe)
confirmed -> cancelled   (khách/admin hủy, áp dụng hoàn cọc)
in_use    -> completed   (owner xác nhận nhận lại xe)
```

Mọi chuyển khác trả 409 `INVALID_STATE`. Chỉ các trạng thái `pending`, `confirmed`, `in_use` nằm trong ràng buộc chống trùng lịch.

Để biết đơn `pending` đã được owner duyệt hay chưa, dùng cột `owner_approved_at` (null = chưa duyệt). Thanh toán chỉ được tạo khi `owner_approved_at` khác null.

## 4. Quy tắc nghiệp vụ

- **Tiền:** số nguyên VND. `total = ngày_thuê × giá_ngày` (làm tròn lên theo 24 giờ **(đề xuất)**); `deposit = 30% × total` **(đề xuất)**, làm tròn VND.
- **Thời gian:** UTC (`timestamptz`), hiển thị theo `Asia/Ho_Chi_Minh`. Thuê tối thiểu 1 ngày, tối đa 30 ngày **(đề xuất)**; `start_at` phải ở tương lai và không quá 365 ngày kể từ lúc đặt **(đề xuất)**, để không ai giữ một xe cho một ngày quá xa. Số ngày thuê làm tròn lên theo 24 giờ: đúng 24 giờ là 1 ngày, 24 giờ 1 mili giây là 2 ngày.
- **Hết hạn giữ chỗ:** đơn `pending` có `expires_at` đã qua thì không còn giữ lịch, kể cả khi job chưa kịp đổi nó thành `expired`. Mọi chỗ đọc lịch (tìm xe theo ngày, lịch trống) bỏ qua các đơn đó; mọi chỗ ghi lịch (tạo đơn, chủ xe chặn ngày) đổi chúng thành `expired` trước khi kiểm tra. Trạng thái trả cho client cũng vậy: đơn `pending` quá hạn được trả là `expired`, và bộ lọc `status` của danh sách đơn tính theo trạng thái đó. Job chỉ là việc dọn dẹp, lịch và trạng thái đúng không phụ thuộc vào việc job có chạy kịp hay không.
- **Giới hạn đơn chờ:** mỗi khách có tối đa 3 đơn `pending` cùng lúc **(đề xuất)**, để một tài khoản không giữ chỗ hàng loạt nhiều xe. Đủ 3 đơn thì tạo thêm trả 409 `PENDING_LIMIT`.
- **Chống trùng lịch:** ràng buộc `EXCLUDE USING gist` trong DB (xem README). Vi phạm → 409 `BOOKING_OVERLAP`. Lịch chặn của owner cũng là một dòng giữ lịch (bảng `vehicle_blocks`). `EXCLUDE` không chạy chéo hai bảng, nên tạo lịch chặn và tạo đơn đều lấy khóa tư vấn theo xe (`pg_advisory_xact_lock`) rồi kiểm tra bảng còn lại trong cùng transaction.
- **Chính sách hủy và hoàn cọc (đề xuất):**

| Thời điểm hủy | Hoàn cọc |
| --- | --- |
| Trước giờ nhận ≥ 48 giờ | 100% |
| Từ 24 đến dưới 48 giờ | 50% |
| Dưới 24 giờ | 0% |
| Owner từ chối hoặc hủy | 100% |

  Hoàn cọc ở sandbox chỉ ghi nhận trạng thái `refunded` trong `payments` (không gọi API hoàn tiền thật).
- **Idempotency:** IPN thanh toán xử lý lặp lại nhiều lần vẫn cho kết quả như một lần (khóa theo mã giao dịch).

## 5. Mô hình dữ liệu (tóm tắt)

| Bảng | Trường chính |
| --- | --- |
| `users` | id, email (unique), password_hash, full_name, phone, role (`renter/owner/admin`), status (`active/blocked`), license_status (`none/pending/verified/rejected`), license_number, license_class, license_expires_on, license_front_key, license_back_key, license_reject_reason, license_reviewed_by, license_reviewed_at |
| `refresh_tokens` | id, user_id, token_hash (unique, lưu băm), expires_at, revoked_at |
| `vehicles` | id, owner_id, title, brand, model, year, plate_number (unique), seats, transmission, fuel, description, city, district, price_per_day, deposit_rate (% cọc, mặc định 30), status (`pending/approved/rejected/hidden`), reject_reason, reviewed_by, reviewed_at |
| `vehicle_images` | id, vehicle_id, storage_key, position |
| `vehicle_blocks` | id, vehicle_id, start_at, end_at, reason |
| `bookings` | id, renter_id, vehicle_id, start_at, end_at, status, rental_days, price_per_day (chụp giá lúc đặt), total_amount, deposit_amount, expires_at, owner_approved_at, reject_reason, started_at, completed_at, cancelled_at, cancelled_by, refund_amount |
| `payments` | id, booking_id, provider (`vnpay/momo`), txn_ref (unique, mã do hệ thống sinh), provider_txn_id (nullable), amount, status (`created/paid/failed/refunded`), raw_payload, paid_at, refunded_amount, refunded_at |
| `license_access_logs` | id, actor_id, target_user_id, file_key, ip_address, accessed_at |

Thiết kế chi tiết từng bảng (kiểu, ràng buộc, index) nằm trong `api/prisma/schema.prisma` và migration. Ngoài `bookings_no_overlap`, migration còn có: `vehicle_blocks_no_overlap` (EXCLUDE), mỗi đơn chỉ một `payments` trạng thái `paid`, và các CHECK về tiền và thời gian. `reviews` để sau MVP.

Quyết định đã chốt khi thiết kế CSDL: `deposit_rate` là phần trăm theo xe (form đăng xe nhập tỷ lệ, không nhập số tiền); `bookings.expires_at` đặt lại 15 phút khi chủ xe duyệt để khách có thời gian thanh toán; một tài khoản một vai trò; chưa có bảng đánh giá.

## 6. Xác minh GPLX

Khách tải ảnh GPLX → `license_status = pending` → admin xem và duyệt/từ chối thủ công. Chỉ `verified` mới được tạo đơn. File lưu trong thư mục **riêng, không phục vụ công khai**; chỉ API trả file cho chính chủ và admin (kèm ghi log truy cập).

## 7. API

Tiền tố `/api`. JSON. Lỗi: `{ "code": "...", "message": "..." }`. Mã lỗi thường dùng: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `BOOKING_OVERLAP` / `INVALID_STATE` / `EMAIL_TAKEN` / `PLATE_TAKEN` / `BLOCK_OVERLAP` / `BLOCK_CONFLICTS_BOOKING` / `IMAGE_LIMIT` / `PENDING_LIMIT` (409), `LICENSE_NOT_VERIFIED` (403), `PAYLOAD_TOO_LARGE` (413), `INVALID_CREDENTIALS` / `INVALID_REFRESH_TOKEN` (401), `ACCOUNT_BLOCKED` (403), `TOO_MANY_REQUESTS` (429), `INTERNAL_ERROR` (500). Phân trang: `?page=1&limit=20` trả `{ items, total, page, limit }`.

### Auth
| Method | Path | Quyền | Mô tả |
| --- | --- | --- | --- |
| POST | /auth/register | công khai | Đăng ký `{ email, password, fullName, phone, role }`; `role` chỉ nhận `renter` hoặc `owner`. Trả 201 kèm hồ sơ, chưa đăng nhập |
| POST | /auth/login | công khai | `{ email, password }`. Trả `{ accessToken, expiresIn, user }` (access token 15 phút) và đặt refresh token vào cookie httpOnly `refresh_token` (7 ngày, path `/api/auth`) |
| POST | /auth/refresh | cookie | Đổi refresh token lấy access token mới. Mỗi lần dùng, refresh token cũ bị thu hồi và cấp token mới (xoay vòng). Dùng lại token đã thu hồi bị coi là bị lộ: thu hồi mọi refresh token của người dùng |
| POST | /auth/logout | cookie | Thu hồi refresh token trong cookie, xóa cookie. Không cần access token còn hạn; gọi lặp lại vẫn trả 204 |
| GET | /me | đăng nhập | Hồ sơ hiện tại |
| PATCH | /me | đăng nhập | Sửa `fullName`, `phone`. Không sửa được email, role, trạng thái |
| POST | /me/license | renter | Tải GPLX |

Mật khẩu 8 đến 128 ký tự, băm argon2id. Đăng nhập, đăng ký và refresh có giới hạn tốc độ theo IP. Mặc định mọi endpoint yêu cầu đăng nhập; endpoint công khai phải đánh dấu rõ. Tài khoản `blocked` bị từ chối ngay cả khi access token còn hạn.

### Xe (công khai)
| Method | Path | Mô tả |
| --- | --- | --- |
| GET | /vehicles | Tìm xe công khai, không cần đăng nhập. Query (đều tùy chọn): `city` (chứa chuỗi, không phân biệt hoa thường), `minPrice`, `maxPrice` (đồng mỗi ngày), `seats`, `fuel`, `transmission` (mỗi tham số nhận một hoặc nhiều giá trị cách nhau bằng dấu phẩy, ví dụ `seats=5,7`), `startAt`, `endAt` (ISO 8601 có múi giờ, phải đi cùng nhau, `endAt` sau `startAt` và sau thời điểm hiện tại, tối đa 366 ngày), `sort` (`newest` mặc định, `price_asc`, `price_desc`), `page`, `limit` (mặc định 12, tối đa 50). Chỉ trả xe `approved`; có `startAt`/`endAt` thì loại xe có đơn `pending/confirmed/in_use` hoặc lịch chặn giao với khoảng đó. Tham số lạ hoặc sai trả 400 `VALIDATION_ERROR`. Trả `{ items, total, page, limit }`, mỗi phần tử `{ id, title, brand, model, year, seats, transmission, fuel, city, district, pricePerDay, depositRate, coverUrl }` (`coverUrl` là ảnh `position` nhỏ nhất, hoặc `null`). Không có biển số, thông tin chủ xe hay trạng thái |
| GET | /vehicles/:id | Chi tiết xe công khai: các trường trên cộng `description`, `images` `[{ id, url, position }]` và `owner` `{ fullName }`. Xe không `approved` hoặc id sai trả 404 |
| GET | /vehicles/:id/availability | Các khoảng đã bị giữ lịch theo tháng. Query `month=YYYY-MM` (mặc định tháng hiện tại, tính theo giờ Việt Nam). Trả `{ vehicleId, month, busy: [{ startAt, endAt }] }` gồm đơn `pending/confirmed/in_use` và lịch chặn, không phân biệt loại và không lộ thông tin người thuê. Xe không `approved` trả 404 |

### Xe (owner)
Mọi endpoint yêu cầu vai trò `owner` và chỉ thao tác trên xe của chính mình; xe của người khác trả 404, không trả 403, để không lộ sự tồn tại.

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | /owner/vehicles | Xe của tôi. Query `status, page, limit` |
| POST | /owner/vehicles | Tạo xe (`pending`). Body: `brand, model, year, plateNumber, seats, transmission, fuel, description?, city, district, pricePerDay, depositRate?` (mặc định 30). `title` do hệ thống tạo từ hãng, mẫu, năm. Biển số lưu ở dạng chuẩn (chỉ chữ và số, viết hoa, ví dụ `51K12345`); trùng trả 409 `PLATE_TAKEN` bất kể cách viết |
| GET | /owner/vehicles/:id | Chi tiết xe của tôi |
| PATCH | /owner/vehicles/:id | Sửa (các trường như khi tạo, đều tùy chọn). Không sửa được `status`. Có ít nhất một trường thật sự thay đổi thì xe về `pending` để duyệt lại (mục 2) |
| GET | /owner/vehicles/:id/images | Ảnh của xe, theo `position` tăng dần (`position` từ 0 đến 9; ảnh `position` 0 là ảnh bìa). Trả `[{ id, url, position }]` |
| POST | /owner/vehicles/:id/images | Tải ảnh (multipart, trường `file`, jpg/png/webp, ≤ 5 MB, ≤ 10 ảnh/xe). Loại file xác định bằng nội dung thật, không tin đuôi file hay `Content-Type`; không phải ảnh hợp lệ trả 400 `VALIDATION_ERROR`, quá 5 MB trả 413 `PAYLOAD_TOO_LARGE`, đã đủ 10 ảnh trả 409 `IMAGE_LIMIT`. Ảnh được giải mã rồi lưu lại dạng WebP, cạnh dài tối đa 1600 px, bỏ metadata (EXIF, vị trí GPS), tên file do hệ thống sinh. Ảnh mới nhận `position` trống nhỏ nhất (xóa ảnh thì ô đó được dùng lại). Tải ảnh lên xe `approved`, `hidden` hoặc `rejected` thì xe về `pending` để duyệt lại (mục 2). Trả 201 `{ id, url, position }` |
| DELETE | /owner/vehicles/:id/images/:imageId | Xóa ảnh (204), xóa cả file trên đĩa. Ảnh không thuộc xe của mình trả 404. Xóa ảnh của xe `approved`, `hidden` hoặc `rejected` thì xe về `pending` để duyệt lại (mục 2) |
| POST | /owner/vehicles/:id/hide | Ẩn/hiện xe. Body `{ hidden: boolean }`. Sai trạng thái trả 409 `INVALID_STATE`; gọi lặp lại vẫn thành công |
| GET | /owner/vehicles/:id/blocks | Danh sách lịch chặn |
| POST | /owner/vehicles/:id/blocks | Chặn lịch. Body `{ startAt, endAt, reason? }` (ISO 8601 có múi giờ). Chồng lịch chặn khác trả 409 `BLOCK_OVERLAP`; chồng đơn đang giữ lịch trả 409 `BLOCK_CONFLICTS_BOOKING` |
| DELETE | /owner/vehicles/:id/blocks/:blockId | Bỏ chặn (204) |
| GET | /owner/vehicles/:id/calendar | Lịch tháng của xe cho chủ xe. Query `month=YYYY-MM`. Như `availability` nhưng có `kind`: `booked` hoặc `blocked` |

### Đơn
| Method | Path | Quyền | Mô tả |
| --- | --- | --- | --- |
| POST | /bookings | renter | Tạo đơn `{ vehicleId, startAt, endAt }` (ISO 8601 có múi giờ). Đơn `pending`, giữ lịch trong lúc chờ chủ xe duyệt: `expires_at` = lúc tạo + 6 giờ, không muộn hơn `startAt`; `rentalDays`, `pricePerDay` (chụp giá lúc đặt), `totalAmount`, `depositAmount` do hệ thống tính (`deposit = round(total × depositRate / 100)`). Lỗi: 400 `VALIDATION_ERROR` (thời gian sai, ngoài 1 đến 30 ngày, `start_at` đã qua hoặc quá 365 ngày), 403 `LICENSE_NOT_VERIFIED` (GPLX chưa được xác minh), 404 (xe không tồn tại hoặc chưa `approved`), 409 `BOOKING_OVERLAP` (trùng đơn đang giữ lịch hoặc lịch chặn của chủ xe), 409 `PENDING_LIMIT`. Trùng đơn khác do ràng buộc `bookings_no_overlap` quyết định, không do kiểm tra bằng code. Gửi lại đúng yêu cầu cũ (cùng khách, cùng xe, cùng `startAt` và `endAt`, đơn còn hạn) thì trả lại đơn đã tạo chứ không tạo đơn mới và không báo trùng lịch, để bấm hai lần hoặc gửi lại sau khi rớt mạng không gây lỗi giả. Có giới hạn tốc độ riêng. Trả 201 |
| GET | /bookings | renter | Đơn của tôi, mới nhất trước. Query `status`, `page`, `limit`. Mỗi đơn kèm `vehicle` `{ id, title, city, district, coverUrl }` |
| GET | /bookings/:id | renter/owner/admin | Chi tiết, kèm `vehicle`. Khách chỉ xem đơn của mình, chủ xe chỉ xem đơn trên xe của mình, admin xem mọi đơn; người khác trả 404, không trả 403. Chủ xe và admin thấy thêm `renter` `{ fullName, phone }` |
| POST | /bookings/:id/cancel | renter | Hủy, trả về số tiền hoàn |
| GET | /owner/bookings | owner | Đơn trên xe của tôi |
| POST | /owner/bookings/:id/approve | owner | Duyệt |
| POST | /owner/bookings/:id/reject | owner | Từ chối `{ reason }` |
| POST | /owner/bookings/:id/start | owner | Giao xe → `in_use` |
| POST | /owner/bookings/:id/complete | owner | Nhận lại xe → `completed` |

### Thanh toán
| Method | Path | Quyền | Mô tả |
| --- | --- | --- | --- |
| POST | /bookings/:id/pay | renter | Tạo giao dịch, trả `paymentUrl` |
| GET | /payments/vnpay/return | công khai | Người dùng quay về, chỉ để hiển thị |
| GET | /payments/vnpay/ipn | cổng thanh toán | Nguồn sự thật: xác thực chữ ký, idempotent, cập nhật payment và booking |

(MoMo tương tự; hai cổng đi qua một interface `PaymentProvider`.)

### Admin
| Method | Path | Mô tả |
| --- | --- | --- |
| GET | /admin/vehicles | Danh sách xe, chỉ admin. Query `status` (tùy chọn), `page`, `limit`. Mỗi xe kèm `owner` `{ id, fullName, email, phone }` và `images` `[{ id, url, position }]`. `status=pending` sắp theo cũ nhất trước (hàng đợi duyệt), các trạng thái khác mới nhất trước |
| POST | /admin/vehicles/:id/approve | Duyệt xe: chỉ `pending` thành `approved`, ghi người duyệt và thời điểm duyệt, xóa lý do từ chối cũ. Xe chưa có ảnh nào, hoặc đang ở trạng thái khác, trả 409 `INVALID_STATE`. Gọi lặp lại trên xe đã `approved` vẫn thành công. Trả xe theo dạng của danh sách |
| POST | /admin/vehicles/:id/reject | Từ chối xe. Body `{ reason }` (bắt buộc, 1 đến 500 ký tự). Chỉ `pending` thành `rejected`; trạng thái khác trả 409 `INVALID_STATE`. Gọi lặp lại trên xe đã `rejected` vẫn thành công và giữ lý do đầu tiên |
| GET | /admin/users | Danh sách, lọc theo `licenseStatus` |
| GET | /admin/users/:id/license | Xem file GPLX (có log) |
| POST | /admin/users/:id/license/verify · /reject | Xác minh GPLX |
| POST | /admin/users/:id/block · /unblock | Khóa/mở |
| GET | /admin/bookings | Mọi đơn |

## 8. Tác vụ nền

| Job | Chu kỳ | Việc |
| --- | --- | --- |
| Hết hạn giữ chỗ | mỗi phút | `pending` có `expires_at < now()` → `expired` |
| Sao lưu DB | hằng ngày | `pg_dump`, giữ 7 bản |
| Sao lưu bù | mỗi giờ (04 đến 23 giờ) | Nếu hôm nay chưa có bản sao lưu (máy tắt hoặc tạm dừng lúc 03:00) thì sao lưu DB, ảnh và thử khôi phục ngay |
| Sao lưu ảnh xe | hằng ngày, sau bản DB | `tar` volume `uploads`, giữ 7 bản; thử khôi phục hằng tuần và đối chiếu với DB |

## 9. Phi chức năng

- Mật khẩu băm argon2 (hoặc bcrypt), rate limit đăng nhập, CORS giới hạn domain, helmet.
- Ảnh xe lưu qua `StorageService` (ổ đĩa), đổi S3 sau này không sửa nghiệp vụ. CSDL chỉ lưu `storage_key` (ví dụ `vehicles/<vehicleId>/<uuid>.webp`), không lưu URL; URL công khai là `/uploads/<storage_key>` do Nginx phục vụ từ volume `uploads`.
- Trang xe SSR có metadata, `sitemap.xml`, `robots.txt`.
- Thanh toán chỉ sandbox; GPLX là dữ liệu nhạy cảm.

## 10. Câu hỏi còn mở

1. Chấp nhận các mặc định (cọc 30%, chính sách hoàn cọc) hay đổi? Thời hạn đã chốt: chủ xe có 6 giờ để duyệt đơn, khách có 15 phút để thanh toán sau khi được duyệt.
2. ~~Một tài khoản một vai trò~~ — đã chốt: một tài khoản một vai trò; sau đăng nhập chủ xe vào `/owner`, quản trị vào `/admin`, khách quay lại trang đang đứng trước khi đăng nhập.
3. Chọn VNPay hay MoMo làm cổng đầu tiên?
4. Có nhận xe có tài xế/giao xe tận nơi không (hiện tại: không)?
