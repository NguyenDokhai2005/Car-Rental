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

**Vai trò thứ tư: `dev` (kỹ thuật vận hành).** Dùng để theo dõi sức khỏe hệ thống, không phải vai trò nghiệp vụ:

- Xem được: trạng thái máy chủ, API, web và CSDL; nhật ký các yêu cầu HTTP gần đây; log của API; lỗi phát sinh trên trình duyệt của người dùng. Xóa được các nhật ký đó.
- **Không** có quyền nghiệp vụ nào: không duyệt xe, không xem ảnh GPLX, không duyệt hồ sơ GPLX, không thao tác trên đơn, không khóa tài khoản. Mọi endpoint `/admin/*`, `/owner/*` và các endpoint của khách đều từ chối `dev` bằng 403.
- **Xem dữ liệu trong các bảng của CSDL, chỉ đọc** (để tra cứu khi gỡ lỗi): `dev` thấy được các dòng dữ liệu, gồm cả dữ liệu khách hàng như họ tên, email, số điện thoại, đơn thuê. Không sửa, không xóa, không chạy được câu SQL tùy ý. Các cột bí mật luôn bị che ngay tại máy chủ (xem mục Dev ở §7), và mỗi lần xem đều được ghi log.
- Ngược lại, `admin` không vào được các endpoint `/dev/*`. Hai vai trò tách hẳn nhau để người vận hành kỹ thuật không chạm vào dữ liệu khách hàng, và người quản trị nghiệp vụ không cần thấy chi tiết kỹ thuật.
- Không đăng ký được qua web hay API; tài khoản `dev` (và `admin`) do người vận hành tạo bằng script trên máy chủ. `admin` khóa được tài khoản `dev`.
- `dev` vẫn xem và sửa được hồ sơ của chính mình (`/me`) như mọi tài khoản. Xem một đơn thuê bất kỳ (`GET /bookings/:id`) thì nhận 404 như người không liên quan.

Quy tắc chung: mọi endpoint kiểm tra quyền **sở hữu** (owner chỉ thấy xe/đơn của mình, khách chỉ thấy đơn của mình), không chỉ kiểm tra vai trò. Một tài khoản có đúng một vai trò; muốn vừa thuê vừa cho thuê thì dùng hai tài khoản (đơn giản hóa MVP).

## 2. Luồng chính

**Đăng xe:** owner tạo xe (trạng thái `pending`) → tải ảnh → admin duyệt (`approved`) hoặc từ chối kèm lý do (`rejected`) → xe `approved` mới hiện công khai. **Mọi thay đổi của owner đều phải được admin duyệt lại:** sửa bất kỳ thông tin nào (kể cả mô tả, thành phố, quận, giá thuê, tỷ lệ cọc), tải thêm ảnh hoặc xóa ảnh trên xe `approved`, `hidden` hay `rejected` đều đưa xe về `pending`, xóa kết quả duyệt cũ (lý do từ chối, người duyệt, thời điểm duyệt). Trong lúc chờ duyệt lại, xe không hiện công khai và không nhận đơn mới; các đơn đã có vẫn giữ nguyên. Gửi lại đúng giá trị cũ không tính là thay đổi. Xe đang `pending` mà sửa tiếp thì vẫn `pending`. Xe chưa có ảnh nào thì không duyệt được.

**Trạng thái xe:** `pending` (chờ duyệt) → `approved` (công khai) hoặc `rejected` (kèm lý do). Owner ẩn xe `approved` thì thành `hidden` (không hiện công khai, không nhận đơn mới, đơn đã có vẫn giữ nguyên) và hiện lại thì về `approved` mà không cần duyệt lại (ẩn và hiện không phải thay đổi nội dung). Xe `hidden` mà bị sửa thì về `pending` như trên, và sau khi được duyệt sẽ thành `approved`. Chỉ xe `approved` mới ẩn được; chỉ xe `hidden` mới hiện lại được.

**Thuê xe:**
1. Khách tìm xe theo thành phố, giá, số chỗ, khoảng ngày.
2. Mở trang xe, chọn `start_at`/`end_at`, hệ thống tính giá và cọc.
3. Khách có GPLX đã xác minh mới được đặt (xem mục 6).
4. Tạo đơn → `pending`, chưa thanh toán. Khách có **15 phút** để thanh toán; trong thời gian đó đơn giữ lịch của xe (`expires_at`). Khách trả một lần **tiền thuê + tiền cọc**.
5. Thanh toán thành công → đơn vẫn `pending` nhưng đã có `paid_at`; chủ xe có **6 giờ** để duyệt hoặc từ chối (`expires_at` = lúc thanh toán + 6 giờ). Cả hai hạn đều không muộn hơn giờ nhận xe.
6. Chủ xe duyệt → `confirmed`. Chủ xe từ chối, hoặc quá 6 giờ không trả lời → hoàn 100% số tiền khách đã trả.
7. **Giao xe cần hai phía xác nhận:** chủ xe bấm "Giao xe", khách bấm "Đã nhận xe" (thứ tự nào cũng được). Đủ cả hai → `in_use`, và chủ xe được ghi nhận **50% tiền thuê**.
8. **Trả xe cũng cần hai phía xác nhận:** khách bấm "Đã trả xe", chủ xe bấm "Đã nhận lại xe". Đủ cả hai → `completed`: chủ xe được ghi nhận 50% tiền thuê còn lại, khách được hoàn toàn bộ tiền cọc. Để tiền không bị treo khi một bên không bấm, đơn `in_use` tự hoàn tất sau 24 giờ kể từ `end_at`.

Quyết định thứ tự thanh toán/duyệt: khách thanh toán **trước**, chủ xe duyệt **sau**. Khách chỉ cần có mặt trên ứng dụng một lần (lúc đặt), không phải quay lại đúng lúc chủ xe duyệt; đổi lại, hệ thống phải hoàn tiền khi chủ xe từ chối hoặc không trả lời. Ứng dụng giữ tiền của khách cho tới khi giao xe và trả xe; trong MVP đây chỉ là số liệu ghi nhận (cổng thanh toán sandbox), không có tiền thật di chuyển.

## 3. Trạng thái đơn (booking)

| Trạng thái | Giữ lịch? | Ý nghĩa |
| --- | :-: | --- |
| `pending` | ✓ | Vừa tạo. Chưa có `paid_at`: chờ khách thanh toán (15 phút). Đã có `paid_at`: chờ chủ xe duyệt (6 giờ). Có `expires_at` |
| `confirmed` | ✓ | Đã thanh toán và chủ xe đã duyệt, chờ giao xe |
| `in_use` | ✓ | Hai bên đã xác nhận giao xe, đang thuê |
| `completed` | | Đã trả xe (hai bên xác nhận, hoặc tự hoàn tất sau 24 giờ kể từ `end_at`) |
| `rejected` | | Chủ xe từ chối, khách được hoàn 100% |
| `cancelled` | | Khách (hoặc admin) hủy |
| `expired` | | Hết hạn: khách không thanh toán trong 15 phút, hoặc chủ xe không trả lời trong 6 giờ (khi đó hoàn 100%) |

Chuyển trạng thái hợp lệ:

```text
pending (chưa thanh toán) -> pending (đã thanh toán)   (khách thanh toán tiền thuê + tiền cọc)
pending (đã thanh toán)   -> confirmed                 (chủ xe duyệt)
pending (đã thanh toán)   -> rejected                  (chủ xe từ chối, hoàn 100%)
pending                   -> cancelled                 (khách hủy, hoàn 100% nếu đã thanh toán)
pending                   -> expired                   (quá expires_at, hoàn 100% nếu đã thanh toán)
confirmed                 -> in_use                    (chủ xe xác nhận giao xe VÀ khách xác nhận nhận xe)
confirmed                 -> cancelled                 (khách/admin hủy, áp dụng chính sách hoàn tiền)
in_use                    -> completed                 (khách xác nhận trả xe VÀ chủ xe xác nhận nhận lại, hoặc quá 24 giờ sau end_at)
```

Mọi chuyển khác trả 409 `INVALID_STATE`. Mỗi lần chuyển trạng thái kiểm tra điều kiện ngay trong câu `UPDATE` (trạng thái hiện tại, hạn giữ chỗ, quyền sở hữu), không đọc trước rồi ghi sau: hai thao tác đồng thời trên cùng một đơn (chủ xe duyệt đúng lúc khách hủy) thì đúng một bên thành công, bên kia nhận 409. Các endpoint của owner chỉ thao tác trên đơn thuộc xe của mình; đơn của xe người khác trả 404. Chỉ các trạng thái `pending`, `confirmed`, `in_use` nằm trong ràng buộc chống trùng lịch.

Để biết đơn `pending` đang chờ khách thanh toán hay chờ chủ xe duyệt, dùng cột `paid_at` (null = chưa thanh toán). Chủ xe chỉ thấy và chỉ duyệt được đơn đã thanh toán. Các lần xác nhận của từng bên nằm ở bốn cột riêng (`owner_handed_over_at`, `renter_received_at`, `renter_returned_at`, `owner_received_back_at`); đơn chỉ đổi trạng thái khi đủ cả hai cột của một cặp.

## 4. Quy tắc nghiệp vụ

- **Tiền:** số nguyên VND. `total_amount` = tiền thuê = `ngày_thuê × giá_ngày` (ngày thuê làm tròn lên theo 24 giờ). `deposit_amount` = tiền cọc bảo đảm = `tỷ_lệ_cọc_của_xe × total_amount`, làm tròn VND; đây là khoản thu THÊM ngoài tiền thuê, ứng dụng giữ và hoàn lại khi trả xe (tỷ lệ cọc 0% là hợp lệ). Khách trả một lần `total_amount + deposit_amount` (`paid_amount`). Ứng dụng không thu phí trong MVP: chủ xe nhận đủ 100% tiền thuê.
- **Sổ tiền của mỗi đơn** gồm ba số: `paid_amount` (khách đã trả), `refund_amount` (đã hoàn cho khách), `owner_payout_amount` (đã ghi nhận cho chủ xe). CSDL bảo đảm `refund_amount + owner_payout_amount <= paid_amount`: không bao giờ chi ra nhiều hơn số đã thu. Đơn hoàn tất thì tổng hai khoản đúng bằng `paid_amount`. Các lần ghi nhận: giao xe xong → chủ xe +50% tiền thuê (làm tròn xuống); trả xe xong → chủ xe + phần tiền thuê còn lại, khách + toàn bộ tiền cọc.
- **Thời gian:** UTC (`timestamptz`), hiển thị theo `Asia/Ho_Chi_Minh`. Thuê tối thiểu 1 ngày, tối đa 30 ngày **(đề xuất)**; `start_at` phải ở tương lai và không quá 365 ngày kể từ lúc đặt **(đề xuất)**, để không ai giữ một xe cho một ngày quá xa. Số ngày thuê làm tròn lên theo 24 giờ: đúng 24 giờ là 1 ngày, 24 giờ 1 mili giây là 2 ngày.
- **Hết hạn giữ chỗ:** đơn `pending` có `expires_at` đã qua thì không còn giữ lịch, kể cả khi job chưa kịp đổi nó thành `expired`. Mọi chỗ đọc lịch (tìm xe theo ngày, lịch trống) bỏ qua các đơn đó; mọi chỗ ghi lịch (tạo đơn, chủ xe chặn ngày) đổi chúng thành `expired` trước khi kiểm tra. Trạng thái trả cho client cũng vậy: đơn `pending` quá hạn được trả là `expired`, và bộ lọc `status` của danh sách đơn tính theo trạng thái đó. Job chỉ là việc dọn dẹp, lịch và trạng thái đúng không phụ thuộc vào việc job có chạy kịp hay không.
- **Giới hạn đơn chờ:** mỗi khách có tối đa 3 đơn `pending` cùng lúc **(đề xuất)**, để một tài khoản không giữ chỗ hàng loạt nhiều xe. Đủ 3 đơn thì tạo thêm trả 409 `PENDING_LIMIT`.
- **Chống trùng lịch:** ràng buộc `EXCLUDE USING gist` trong DB (xem README). Vi phạm → 409 `BOOKING_OVERLAP`. Lịch chặn của owner cũng là một dòng giữ lịch (bảng `vehicle_blocks`). `EXCLUDE` không chạy chéo hai bảng, nên tạo lịch chặn và tạo đơn đều lấy khóa tư vấn theo xe (`pg_advisory_xact_lock`) rồi kiểm tra bảng còn lại trong cùng transaction.
- **Chính sách hoàn tiền khi khách hủy:** tiền cọc luôn được hoàn 100% (xe chưa được giao). Tiền thuê hoàn theo thời điểm hủy:

| Thời điểm hủy | Hoàn tiền thuê | Chủ xe nhận |
| --- | --- | --- |
| Chủ xe chưa duyệt (đơn còn `pending`) | 100% | 0 |
| Đã `confirmed`, trước giờ nhận ≥ 48 giờ | 100% | 0 |
| Đã `confirmed`, từ 24 đến dưới 48 giờ | 50% | 50% còn lại |
| Đã `confirmed`, dưới 24 giờ | 0% | 100% |
| Chủ xe từ chối, hoặc hết hạn 6 giờ | 100% | 0 |

  Hoàn tiền và ghi nhận cho chủ xe ở sandbox chỉ là số liệu trên đơn (và trạng thái `refunded` trong `payments` khi có cổng thanh toán), không gọi API chuyển tiền thật.
- **Idempotency:** IPN thanh toán xử lý lặp lại nhiều lần vẫn cho kết quả như một lần (khóa theo mã giao dịch).

## 5. Mô hình dữ liệu (tóm tắt)

| Bảng | Trường chính |
| --- | --- |
| `users` | id, email (unique), password_hash, full_name, phone, role (`renter/owner/admin/dev`), status (`active/blocked`), license_status (`none/pending/verified/rejected`), license_number, license_class, license_expires_on, license_front_key, license_back_key, license_reject_reason, license_reviewed_by, license_reviewed_at |
| `refresh_tokens` | id, user_id, token_hash (unique, lưu băm), expires_at, revoked_at |
| `vehicles` | id, owner_id, title, brand, model, year, plate_number (unique), seats, transmission, fuel, description, city, district, price_per_day, deposit_rate (% cọc, mặc định 30), status (`pending/approved/rejected/hidden`), reject_reason, reviewed_by, reviewed_at |
| `vehicle_images` | id, vehicle_id, storage_key, position |
| `vehicle_blocks` | id, vehicle_id, start_at, end_at, reason |
| `bookings` | id, renter_id, vehicle_id, start_at, end_at, status, rental_days, price_per_day (chụp giá lúc đặt), total_amount (tiền thuê), deposit_amount (tiền cọc bảo đảm), expires_at, paid_at, paid_amount, owner_approved_at, reject_reason, owner_handed_over_at, renter_received_at, started_at, renter_returned_at, owner_received_back_at, completed_at, cancelled_at, cancelled_by, refund_amount, owner_payout_amount |
| `payments` | id, booking_id, provider (`vnpay/momo`), txn_ref (unique, mã do hệ thống sinh), provider_txn_id (nullable), amount, status (`created/paid/failed/refunded`), raw_payload, paid_at, refunded_amount, refunded_at |
| `license_access_logs` | id, actor_id, target_user_id, file_key, ip_address, accessed_at |

Thiết kế chi tiết từng bảng (kiểu, ràng buộc, index) nằm trong `api/prisma/schema.prisma` và migration. Ngoài `bookings_no_overlap`, migration còn có: `vehicle_blocks_no_overlap` (EXCLUDE), mỗi đơn chỉ một `payments` trạng thái `paid`, và các CHECK về tiền và thời gian. `reviews` để sau MVP.

Quyết định đã chốt khi thiết kế CSDL: `deposit_rate` là phần trăm theo xe (form đăng xe nhập tỷ lệ, không nhập số tiền); `bookings.expires_at` là hạn của bước đang chờ (15 phút chờ khách thanh toán, rồi 6 giờ chờ chủ xe duyệt); một tài khoản một vai trò; chưa có bảng đánh giá.

## 6. Xác minh GPLX

Khách tải ảnh GPLX → `license_status = pending` → admin xem và duyệt/từ chối thủ công. Chỉ `verified` mới được tạo đơn. File lưu trong thư mục **riêng, không phục vụ công khai**; chỉ API trả file cho chính chủ và admin (kèm ghi log truy cập).

- **Hồ sơ gồm:** số GPLX (12 chữ số), hạng (`B1`, `B2`, `B`, `C1`, `C`, `D1`, `D2`, `D`, `E`), ngày hết hạn (chưa qua, tính theo giờ Việt Nam), ảnh mặt trước (bắt buộc), ảnh mặt sau (tùy chọn). Ảnh JPG/PNG/WebP, mỗi ảnh tối đa 5 MB; máy chủ vẽ lại thành WebP (bỏ EXIF, vị trí GPS) rồi mới lưu.
- **Gửi lại:** được gửi khi trạng thái là `none`, `pending` hoặc `rejected`; mỗi lần gửi thay toàn bộ hồ sơ cũ (xóa file cũ), đưa trạng thái về `pending` và xóa kết quả duyệt trước đó. Đã `verified` thì không gửi lại được (409 `INVALID_STATE`).
- **Duyệt:** chỉ hồ sơ `pending`. Mỗi hồ sơ có `version` (đổi mỗi lần khách gửi lại); admin phải gửi kèm `version` của hồ sơ mình đã xem khi duyệt. Khách vừa gửi lại thì `version` lệch và việc duyệt bị từ chối (409), để admin không bao giờ duyệt nhầm ảnh mình chưa xem. Từ chối bắt buộc có lý do, khách đọc được.
- **Kho riêng:** thư mục `PRIVATE_UPLOAD_DIR`, khác và không nằm trong `UPLOAD_DIR`; ở production là một volume riêng chỉ gắn vào container API, Nginx không đọc được. API từ chối khởi động nếu hai thư mục lồng nhau. Đường dẫn file không bao giờ trả ra ngoài.
- **Log truy cập:** mỗi lần trả file (cho chính chủ hay admin) ghi một dòng vào `license_access_logs` (ai, của ai, file nào, IP). Ghi log lỗi thì không trả file.

## 7. API

Tiền tố `/api`. JSON. Lỗi: `{ "code": "...", "message": "..." }`. Mã lỗi thường dùng: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `BOOKING_OVERLAP` / `INVALID_STATE` / `EMAIL_TAKEN` / `PLATE_TAKEN` / `BLOCK_OVERLAP` / `BLOCK_CONFLICTS_BOOKING` / `IMAGE_LIMIT` / `PENDING_LIMIT` (409), `LICENSE_NOT_VERIFIED` (403), `PAYLOAD_TOO_LARGE` (413), `INVALID_CREDENTIALS` / `INVALID_REFRESH_TOKEN` (401), `ACCOUNT_BLOCKED` (403), `TOO_MANY_REQUESTS` (429), `INTERNAL_ERROR` (500). Phân trang: `?page=1&limit=20` trả `{ items, total, page, limit }`.

### Auth
| Method | Path | Quyền | Mô tả |
| --- | --- | --- | --- |
| POST | /auth/register | công khai | Đăng ký `{ email, password, fullName, phone, role }`; `role` chỉ nhận `renter` hoặc `owner`. Trả 201 kèm hồ sơ, chưa đăng nhập |
| POST | /auth/login | công khai | `{ email, password }`. Trả `{ accessToken, expiresIn, user }` (access token 15 phút) và đặt refresh token vào cookie httpOnly `refresh_token` (7 ngày, path `/api/auth`) |
| POST | /auth/refresh | cookie | Đổi refresh token lấy access token mới. Mỗi lần dùng, refresh token cũ bị thu hồi và cấp token mới (xoay vòng). Dùng lại token đã thu hồi bị coi là bị lộ: thu hồi mọi refresh token của người dùng |
| POST | /auth/logout | cookie | Thu hồi refresh token trong cookie, xóa cookie. Không cần access token còn hạn; gọi lặp lại vẫn trả 204 |
| GET | /health | công khai | Cho công cụ giám sát: trả `{ status: "ok" }` khi API chạy và truy vấn được CSDL, ngược lại 503 `UNAVAILABLE`. Không trả chi tiết nào khác |
| GET | /me | đăng nhập | Hồ sơ hiện tại |
| PATCH | /me | đăng nhập | Sửa `fullName`, `phone`. Không sửa được email, role, trạng thái |
| GET | /me/license | renter | Hồ sơ GPLX của mình: `{ status, licenseNumber, licenseClass, licenseExpiresOn, rejectReason, reviewedAt, hasBack, version }` (chưa gửi thì các trường là `null`) |
| POST | /me/license | renter | Gửi hồ sơ GPLX, `multipart/form-data`: `licenseNumber`, `licenseClass`, `licenseExpiresOn` (`yyyy-mm-dd`), file `front` (bắt buộc), file `back` (tùy chọn). Trả hồ sơ theo dạng của GET. Quy tắc ở mục 6 |
| GET | /me/license/:side | renter | Ảnh GPLX của chính mình, `side` là `front` hoặc `back`. Trả `image/webp`, `Cache-Control: private, no-store`. Không có ảnh trả 404 |

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
| POST | /bookings | renter | Tạo đơn `{ vehicleId, startAt, endAt }` (ISO 8601 có múi giờ). Đơn `pending` chưa thanh toán, giữ lịch 15 phút chờ khách trả tiền (`expires_at`, không muộn hơn `startAt`). `rentalDays`, `pricePerDay` (chụp giá lúc đặt), `totalAmount`, `depositAmount` do hệ thống tính; `payableAmount` = `totalAmount + depositAmount` là số khách phải trả. Lỗi: 400 `VALIDATION_ERROR` (thời gian sai, ngoài 1 đến 30 ngày, `start_at` đã qua hoặc quá 365 ngày), 403 `LICENSE_NOT_VERIFIED`, 404 (xe không tồn tại hoặc chưa `approved`), 409 `BOOKING_OVERLAP` (trùng đơn đang giữ lịch hoặc lịch chặn), 409 `PENDING_LIMIT`. Trùng đơn khác do ràng buộc `bookings_no_overlap` quyết định, không do kiểm tra bằng code. Gửi lại đúng yêu cầu cũ (cùng khách, xe, `startAt`, `endAt`, đơn còn hạn) thì trả lại đơn đã tạo. Có giới hạn tốc độ riêng. Trả 201 |
| GET | /bookings | renter | Đơn của tôi, mới nhất trước. Query `status`, `page`, `limit`. Mỗi đơn kèm `vehicle` `{ id, title, city, district, coverUrl }` |
| GET | /bookings/:id | renter/owner/admin | Chi tiết, kèm `vehicle`. Khách chỉ xem đơn của mình, chủ xe chỉ xem đơn trên xe của mình, admin xem mọi đơn; người khác trả 404, không trả 403. Chủ xe và admin thấy thêm `renter` `{ fullName, phone }` và `ownerPayoutAmount` |
| POST | /bookings/:id/pay | renter | Thanh toán `payableAmount` cho đơn `pending` chưa thanh toán và còn hạn. Thành công: ghi `paid_at`, `paid_amount`, đặt `expires_at` = lúc thanh toán + 6 giờ (không muộn hơn `startAt`) cho chủ xe duyệt. Gọi lặp lại trên đơn đã thanh toán vẫn thành công và không thu lần hai. Trạng thái khác hoặc đơn quá hạn trả 409 `INVALID_STATE`. Body tùy chọn `{ scenario }` để giả lập kết quả (xem mục Thanh toán); kịch bản thất bại trả 402 `PAYMENT_FAILED` và đơn không đổi |
| POST | /bookings/:id/cancel | renter | Hủy đơn `pending` còn hạn hoặc `confirmed`. Tiền hoàn theo chính sách ở mục 4, ghi vào `refundAmount`; phần tiền thuê không hoàn ghi cho chủ xe. Ghi `cancelled_at`, `cancelled_by`. Gọi lặp lại trên đơn đã hủy vẫn thành công và không tính lại tiền. Trạng thái khác trả 409 `INVALID_STATE` |
| POST | /bookings/:id/pickup | renter | Khách xác nhận **đã nhận xe**. Đơn phải `confirmed` và trong khung giờ giao xe (từ 1 giờ trước `startAt` đến trước `endAt`). Ghi `renter_received_at`. Khi chủ xe cũng đã xác nhận giao xe thì đơn thành `in_use` và chủ xe được ghi nhận 50% tiền thuê. Gọi lặp lại vẫn thành công |
| POST | /bookings/:id/return | renter | Khách xác nhận **đã trả xe**. Đơn phải `in_use`. Ghi `renter_returned_at`. Khi chủ xe cũng đã xác nhận nhận lại xe thì đơn thành `completed`: chủ xe được ghi nhận phần tiền thuê còn lại, khách được hoàn tiền cọc. Gọi lặp lại vẫn thành công |
| GET | /owner/bookings | owner | Đơn trên các xe của tôi, mới nhất trước. Chỉ gồm đơn khách đã thanh toán (đơn chưa thanh toán chưa phải là yêu cầu thật). Query `status`, `page`, `limit`. Mỗi đơn kèm `vehicle`, `renter` `{ fullName, phone }` và `ownerPayoutAmount` |
| POST | /owner/bookings/:id/approve | owner | Duyệt đơn `pending` đã thanh toán và còn hạn → `confirmed`, ghi `owner_approved_at`. Đơn chưa thanh toán, quá hạn hoặc ở trạng thái khác trả 409 `INVALID_STATE`. Gọi lặp lại trên đơn đã `confirmed` vẫn thành công |
| POST | /owner/bookings/:id/reject | owner | Từ chối đơn `pending` đã thanh toán và còn hạn. Body `{ reason }` (bắt buộc, 1 đến 500 ký tự). → `rejected`, hoàn 100% cho khách. Gọi lặp lại trên đơn đã từ chối vẫn thành công và giữ lý do đầu tiên. Trạng thái khác trả 409 `INVALID_STATE` |
| POST | /owner/bookings/:id/handover | owner | Chủ xe xác nhận **đã giao xe**. Điều kiện và kết quả như `/bookings/:id/pickup`, ghi `owner_handed_over_at` |
| POST | /owner/bookings/:id/receive | owner | Chủ xe xác nhận **đã nhận lại xe**. Điều kiện và kết quả như `/bookings/:id/return`, ghi `owner_received_back_at` |

Quy tắc chung của các endpoint đổi trạng thái: sai trạng thái trả 409 `INVALID_STATE`; đơn không phải của mình (hoặc không thuộc xe của mình) trả 404; mỗi bên chỉ ghi được xác nhận của chính mình, không xác nhận thay bên kia.

### Thanh toán
**Quyết định 2026-10-11:** tạm chưa tích hợp cổng VNPay/MoMo. `POST /bookings/:id/pay` là **thanh toán giả lập**: không qua cổng nào, không có tiền thật. Body tùy chọn `{ scenario }`:

| `scenario` | Kết quả |
| --- | --- |
| `success` (mặc định) | Ghi nhận đã thanh toán ngay |
| `insufficient_funds` | 402 `PAYMENT_FAILED`: tài khoản không đủ số dư |
| `cancelled` | 402 `PAYMENT_FAILED`: khách hủy giao dịch tại cổng |
| `gateway_timeout` | 402 `PAYMENT_FAILED`: cổng thanh toán không phản hồi |

Kịch bản thất bại dùng để thử luồng lỗi: đơn giữ nguyên (`pending`, chưa thanh toán, hạn giữ chỗ 15 phút **không** được gia hạn), khách thanh toán lại được cho tới khi hết hạn. Các kiểm tra quyền và trạng thái chạy trước: đơn của người khác vẫn 404, đơn hết hạn vẫn 409, và đơn đã thanh toán vẫn trả thành công dù gửi kịch bản thất bại (không "hoàn tác" được một lần thanh toán). `scenario` lạ trả 400.

Khi có cổng thật, endpoint này sẽ tạo giao dịch và trả `paymentUrl`, còn việc ghi nhận đã thanh toán chuyển sang IPN; phần còn lại của luồng không đổi. Các endpoint dưới đây là thiết kế cho lúc đó, **chưa được viết**:

| Method | Path | Quyền | Mô tả |
| --- | --- | --- | --- |
| GET | /payments/vnpay/return | công khai | Người dùng quay về, chỉ để hiển thị |
| GET | /payments/vnpay/ipn | cổng thanh toán | Nguồn sự thật: xác thực chữ ký, idempotent, cập nhật payment và booking |

(MoMo tương tự; hai cổng đi qua một interface `PaymentProvider`.)

### Admin
| Method | Path | Mô tả |
| --- | --- | --- |
| GET | /admin/vehicles | Danh sách xe, chỉ admin. Query `status` (tùy chọn), `page`, `limit`. Mỗi xe kèm `owner` `{ id, fullName, email, phone }` và `images` `[{ id, url, position }]`. `status=pending` sắp theo cũ nhất trước (hàng đợi duyệt), các trạng thái khác mới nhất trước |
| POST | /admin/vehicles/:id/approve | Duyệt xe: chỉ `pending` thành `approved`, ghi người duyệt và thời điểm duyệt, xóa lý do từ chối cũ. Xe chưa có ảnh nào, hoặc đang ở trạng thái khác, trả 409 `INVALID_STATE`. Gọi lặp lại trên xe đã `approved` vẫn thành công. Trả xe theo dạng của danh sách |
| POST | /admin/vehicles/:id/reject | Từ chối xe. Body `{ reason }` (bắt buộc, 1 đến 500 ký tự). Chỉ `pending` thành `rejected`; trạng thái khác trả 409 `INVALID_STATE`. Gọi lặp lại trên xe đã `rejected` vẫn thành công và giữ lý do đầu tiên |
| GET | /admin/users | Danh sách người dùng, chỉ admin, mới nhất trước. Query tùy chọn: `role`, `status`, `licenseStatus`, `q` (tìm trong họ tên, email, số điện thoại; tối đa 100 ký tự), `page`, `limit`. Mỗi người gồm các trường công khai (không có mật khẩu hay khóa file GPLX) kèm `vehicleCount` và `bookingCount` |
| GET | /admin/users/:id/license | Hồ sơ GPLX của một người dùng, theo dạng của `GET /me/license` kèm `user` `{ id, fullName, email, phone }` |
| GET | /admin/users/:id/license/:side | Ảnh GPLX (`front` hoặc `back`), có ghi log truy cập. Trả như `GET /me/license/:side` |
| POST | /admin/users/:id/license/verify | Duyệt hồ sơ `pending`. Body `{ version }` (bắt buộc). Sai `version` hoặc trạng thái khác `pending` trả 409 `INVALID_STATE`; gọi lặp lại trên hồ sơ đã `verified` cùng `version` vẫn thành công. Ghi người duyệt và thời điểm duyệt |
| POST | /admin/users/:id/license/reject | Từ chối hồ sơ `pending`. Body `{ reason }` (bắt buộc, 1 đến 500 ký tự). Trạng thái khác `pending` trả 409 `INVALID_STATE`; gọi lặp lại trên hồ sơ đã `rejected` vẫn thành công và giữ lý do đầu tiên |
| POST | /admin/users/:id/block · /unblock | Khóa hoặc mở tài khoản, trả người dùng theo dạng của danh sách. Gọi lặp lại vẫn thành công. Không khóa được chính mình hay admin khác: trả 409 `INVALID_STATE`. Tài khoản bị khóa bị từ chối ở mọi yêu cầu kế tiếp (guard đọc lại trạng thái mỗi lần), không cần chờ token hết hạn. Đơn đang có của người bị khóa giữ nguyên |
| GET | /admin/bookings | Mọi đơn, chỉ admin, mới nhất trước. Query `status` (tùy chọn, tính theo trạng thái hiệu lực), `page`, `limit`. Mỗi đơn theo dạng chi tiết của chủ xe (`renter`, `ownerPayoutAmount`) kèm `owner` `{ fullName, phone }`. Phản hồi có thêm `totals` `{ paidAmount, refundAmount, ownerPayoutAmount, heldAmount }` cộng trên **toàn bộ** đơn (không theo bộ lọc hay trang): `heldAmount = paidAmount - refundAmount - ownerPayoutAmount` là số tiền nền tảng đang giữ hộ |

### Dev (vận hành kỹ thuật)

Chỉ vai trò `dev`, trừ `POST /client-logs` là công khai.

| Method | Path | Mô tả |
| --- | --- | --- |
| GET | /dev/status | Ảnh chụp hiện trạng: `api` (thời gian chạy, bộ nhớ, độ trễ vòng lặp sự kiện, số yêu cầu và tỷ lệ lỗi 5 phút gần nhất), `server` (số CPU, tải trung bình, RAM, giới hạn RAM của container, đĩa của thư mục lưu ảnh), `database` (phiên bản, kích thước, số kết nối, số dòng và kích thước từng bảng, số migration đã áp dụng, độ trễ ping), `web` (mã trạng thái và độ trễ khi API gọi tới máy chủ web). Mỗi phần tự báo `ok: false` nếu không lấy được, không làm hỏng cả phản hồi |
| GET | /dev/metrics | Lịch sử chỉ số để vẽ biểu đồ đường: `{ intervalSeconds, samples }`, mẫu cũ nhất trước. Mỗi mẫu có thời điểm, % CPU, % RAM đã dùng, bộ nhớ của API (RSS, heap), độ trễ vòng lặp sự kiện, số yêu cầu và số lỗi 4xx, 5xx trong chu kỳ, thời gian xử lý trung bình và p95, độ trễ truy vấn thử CSDL, số kết nối CSDL, thời gian phản hồi của máy chủ web. Chỉ số nào không đo được ở mẫu đó thì là `null` |
| GET | /dev/requests | Các yêu cầu HTTP gần đây, mới nhất trước. Query tùy chọn: `limit` (1 đến 500, mặc định 100), `onlyErrors` (`true` chỉ lấy mã từ 400 trở lên), `q` (lọc theo đường dẫn). Kèm `stats`: theo từng route có số lượt, số lỗi 4xx và 5xx, thời gian trung bình, p95, lớn nhất |
| DELETE | /dev/requests | Xóa nhật ký yêu cầu. Trả 204 |
| GET | /dev/database/tables | Danh sách bảng của CSDL: tên, số dòng ước lượng, kích thước, và các cột (tên, kiểu, cho phép null, có bị che hay không) |
| GET | /dev/database/tables/:table/rows | Các dòng của một bảng, chỉ đọc. Query tùy chọn: `page` (mặc định 1), `limit` (1 đến 100, mặc định 25), `sort` (tên cột) và `order` (`asc`/`desc`), `filterColumn` + `filterValue` (lọc các dòng có cột đó bằng đúng giá trị). Trả `{ columns, items, total, page, limit }`; mọi giá trị ở dạng chữ, cắt còn 300 ký tự. Bảng hoặc cột không tồn tại trả 404 `NOT_FOUND`; lọc hay sắp xếp theo cột bị che trả 400 `VALIDATION_ERROR` |
| GET | /dev/logs | Dòng log gần đây, mới nhất trước. Query `source`: `server` (log của API) hoặc `browser` (lỗi do trình duyệt người dùng gửi về); tùy chọn `level`, `limit` (1 đến 500, mặc định 100) |
| DELETE | /dev/logs | Xóa log của một `source` (bắt buộc). Trả 204 |
| POST | /client-logs | **Công khai.** Trang web gửi lỗi JavaScript xảy ra trên trình duyệt: `{ level, message, stack?, url? }`, `level` là `error` hoặc `warn`; `message` tối đa 2.000 ký tự, `stack` tối đa 4.000, `url` tối đa 500. Giới hạn 20 lần mỗi phút cho mỗi IP. Trả 204 |

Quy tắc của nhật ký:

- **Lưu trong bộ nhớ của tiến trình API**, không ghi vào CSDL và không dùng Redis: giữ 2.000 yêu cầu, 1.000 dòng log máy chủ và 500 dòng log trình duyệt gần nhất, cũ hơn thì bỏ. Khởi động lại API (mỗi lần deploy) là mất. Log đầy đủ lâu dài vẫn nằm ở `docker logs`.
- **Không ghi nội dung nhạy cảm:** nhật ký yêu cầu chỉ có thời điểm, phương thức, đường dẫn **không kèm query string**, mẫu route, mã trạng thái, thời gian xử lý, IP, id và vai trò người gọi. Không bao giờ ghi body, header `Authorization`, cookie hay mật khẩu.
- **Xem dữ liệu bảng:**
  - Chỉ đọc: truy vấn chạy trong giao dịch `READ ONLY`, giới hạn 5 giây. Tên bảng và tên cột phải khớp danh mục của CSDL; không nhận câu SQL từ người dùng.
  - **Cột bị che** (giá trị được thay bằng `••••••` ngay trong câu truy vấn, không bao giờ rời CSDL; `null` vẫn là `null`): `users.password_hash`, `users.license_number`, `users.license_front_key`, `users.license_back_key`, `refresh_tokens.token_hash`, `license_access_logs.file_key`, `payments.raw_payload`, và mọi cột có tên chứa `password`, `secret`, `token` hoặc `hash` (để cột bí mật thêm sau này mặc định cũng bị che). Không lọc hay sắp xếp được theo cột bị che, vì làm vậy sẽ dò ra được giá trị.
  - Mỗi lần xem ghi một dòng log: ai xem, bảng nào, trang nào, có lọc theo cột nào (không ghi giá trị lọc).
- **Nội dung do trình duyệt gửi về là dữ liệu không tin cậy** (ai cũng gọi được endpoint này): bị cắt theo giới hạn độ dài, chỉ hiển thị dạng chữ, không bao giờ được diễn giải thành HTML hay lệnh.
- **Lịch sử chỉ số:** API tự lấy một mẫu mỗi 10 giây và giữ 360 mẫu gần nhất (1 giờ), cũng trong bộ nhớ. Mỗi mẫu tốn một truy vấn nhỏ vào CSDL và một lần gọi thử máy chủ web.
- Các yêu cầu tới `/health` và `/dev/*` không được ghi vào nhật ký yêu cầu, để việc theo dõi không tự làm đầy nhật ký.

## 8. Tác vụ nền

| Job | Chu kỳ | Việc |
| --- | --- | --- |
| Hết hạn giữ chỗ | mỗi phút | `pending` có `expires_at < now()` → `expired`; đơn đã thanh toán thì hoàn 100% (`refund_amount = paid_amount`) |
| Tự hoàn tất đơn | mỗi phút | `in_use` đã quá `end_at` 24 giờ mà chưa đủ hai xác nhận trả xe → `completed`, ghi nhận tiền như khi trả xe |
| Sao lưu DB | hằng ngày | `pg_dump`, giữ 7 bản |
| Sao lưu bù | mỗi giờ (04 đến 23 giờ) | Nếu hôm nay chưa có bản sao lưu (máy tắt hoặc tạm dừng lúc 03:00) thì sao lưu DB, ảnh và thử khôi phục ngay |
| Sao lưu ảnh xe | hằng ngày, sau bản DB | `tar` volume `uploads`, giữ 7 bản; thử khôi phục hằng tuần và đối chiếu với DB |

## 9. Phi chức năng

- Mật khẩu băm argon2 (hoặc bcrypt), rate limit đăng nhập, CORS giới hạn domain, helmet.
- Ảnh xe lưu qua `StorageService` (ổ đĩa), đổi S3 sau này không sửa nghiệp vụ. CSDL chỉ lưu `storage_key` (ví dụ `vehicles/<vehicleId>/<uuid>.webp`), không lưu URL; URL công khai là `/uploads/<storage_key>` do Nginx phục vụ từ volume `uploads`.
- Trang xe SSR có metadata, `sitemap.xml`, `robots.txt`.
- Thanh toán chỉ sandbox; GPLX là dữ liệu nhạy cảm.

## 10. Câu hỏi còn mở

1. Chấp nhận các mặc định (cọc 30%, chính sách hoàn cọc) hay đổi? Đã chốt: khách trả tiền thuê + tiền cọc trong 15 phút sau khi đặt; chủ xe có 6 giờ để duyệt đơn đã thanh toán; giao xe và trả xe cần hai phía xác nhận; chủ xe nhận 50% tiền thuê khi giao xe và 50% khi trả xe; tiền cọc do ứng dụng giữ và hoàn khi trả xe. Xử lý tranh chấp về tình trạng xe và trường hợp một bên không đến để sau MVP.
2. ~~Một tài khoản một vai trò~~ — đã chốt: một tài khoản một vai trò; sau đăng nhập chủ xe vào `/owner`, quản trị vào `/admin`, khách quay lại trang đang đứng trước khi đăng nhập.
3. Chọn VNPay hay MoMo làm cổng đầu tiên?
4. Có nhận xe có tài xế/giao xe tận nơi không (hiện tại: không)?
