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

**Đăng xe:** owner tạo xe (trạng thái `pending`) → tải ảnh → admin duyệt (`approved`) hoặc từ chối kèm lý do (`rejected`) → xe `approved` mới hiện công khai. Owner sửa xe đã duyệt thì xe về `pending` nếu đổi thông tin quan trọng (biển số, loại xe, giá).

**Thuê xe:**
1. Khách tìm xe theo thành phố, giá, số chỗ, khoảng ngày.
2. Mở trang xe, chọn `start_at`/`end_at`, hệ thống tính giá và cọc.
3. Khách có GPLX đã xác minh mới được đặt (xem mục 6).
4. Tạo đơn → `pending`, giữ chỗ 15 phút **(đề xuất)** bằng `expires_at`.
5. Owner duyệt → `expires_at` được đặt lại thành 15 phút kể từ lúc duyệt; khách thanh toán cọc trong khoảng đó. Quá hạn → đơn `expired`, nhả lịch.
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
- **Thời gian:** UTC (`timestamptz`), hiển thị theo `Asia/Ho_Chi_Minh`. Thuê tối thiểu 1 ngày, tối đa 30 ngày **(đề xuất)**; `start_at` phải ở tương lai.
- **Chống trùng lịch:** ràng buộc `EXCLUDE USING gist` trong DB (xem README). Vi phạm → 409 `BOOKING_OVERLAP`. Lịch chặn của owner cũng là một dòng giữ lịch (đề xuất: bảng `vehicle_blocks`, kiểm tra thêm ở tầng ứng dụng trong cùng transaction).
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

Tiền tố `/api`. JSON. Lỗi: `{ "code": "...", "message": "..." }`. Mã lỗi thường dùng: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `BOOKING_OVERLAP` / `INVALID_STATE` / `EMAIL_TAKEN` (409), `INVALID_CREDENTIALS` / `INVALID_REFRESH_TOKEN` (401), `ACCOUNT_BLOCKED` (403), `TOO_MANY_REQUESTS` (429), `INTERNAL_ERROR` (500). Phân trang: `?page=1&limit=20` trả `{ items, total, page, limit }`.

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
| GET | /vehicles | Tìm: `city, minPrice, maxPrice, seats, startAt, endAt, sort, page, limit`; chỉ xe `approved` và còn trống trong khoảng ngày |
| GET | /vehicles/:id | Chi tiết xe + ảnh |
| GET | /vehicles/:id/availability | Các khoảng đã bị giữ lịch theo tháng |

### Xe (owner)
| Method | Path | Mô tả |
| --- | --- | --- |
| GET | /owner/vehicles | Xe của tôi |
| POST | /owner/vehicles | Tạo xe (`pending`) |
| PATCH | /owner/vehicles/:id | Sửa |
| POST | /owner/vehicles/:id/images | Tải ảnh (multipart, jpg/png/webp, ≤ 5 MB, ≤ 10 ảnh) |
| DELETE | /owner/vehicles/:id/images/:imageId | Xóa ảnh |
| POST | /owner/vehicles/:id/hide | Ẩn/hiện xe |
| POST | /owner/vehicles/:id/blocks | Chặn lịch |
| DELETE | /owner/vehicles/:id/blocks/:blockId | Bỏ chặn |

### Đơn
| Method | Path | Quyền | Mô tả |
| --- | --- | --- | --- |
| POST | /bookings | renter | Tạo đơn `{ vehicleId, startAt, endAt }` |
| GET | /bookings | renter | Đơn của tôi |
| GET | /bookings/:id | renter/owner/admin | Chi tiết (đúng chủ) |
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
| GET | /admin/vehicles?status=pending | Xe chờ duyệt |
| POST | /admin/vehicles/:id/approve · /reject | Duyệt/từ chối xe |
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

## 9. Phi chức năng

- Mật khẩu băm argon2 (hoặc bcrypt), rate limit đăng nhập, CORS giới hạn domain, helmet.
- Ảnh xe lưu qua `StorageService` (ổ đĩa), đổi S3 sau này không sửa nghiệp vụ.
- Trang xe SSR có metadata, `sitemap.xml`, `robots.txt`.
- Thanh toán chỉ sandbox; GPLX là dữ liệu nhạy cảm.

## 10. Câu hỏi còn mở

1. Chấp nhận các mặc định (cọc 30%, giữ chỗ 15 phút, chính sách hoàn cọc) hay đổi?
2. Một tài khoản một vai trò có ổn không, hay cho một người vừa thuê vừa cho thuê?
3. Chọn VNPay hay MoMo làm cổng đầu tiên?
4. Có nhận xe có tài xế/giao xe tận nơi không (hiện tại: không)?
