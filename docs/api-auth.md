# API xác thực

Mã nguồn: `api/src/auth/`, `api/src/users/`, `api/src/common/`. Đặc tả: SPEC.md §7 (mục Auth).

## Chạy thử

```bash
docker compose up -d db                 # PostgreSQL
pnpm --filter api db:seed               # tài khoản mẫu (mật khẩu Password123!)
pnpm --filter api dev                   # API ở http://localhost:4000/api
pnpm --filter api test                  # 52 test; tự tạo database carrental_test
```

Cần `api/.env` có `DATABASE_URL`, `JWT_ACCESS_SECRET` (xem `.env.example`). Thiếu là API từ chối khởi động. Ở production, secret phải dài ít nhất 32 ký tự và không chứa `change-me`.

## Luồng sử dụng

```bash
# 1. Đăng ký (role chỉ nhận renter hoặc owner)
curl -X POST localhost:4000/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"a@x.com","password":"MatKhau123","fullName":"Nguyễn Văn A","phone":"0901234567","role":"renter"}'

# 2. Đăng nhập: nhận accessToken trong body, refresh token nằm trong cookie httpOnly
curl -c cookies.txt -X POST localhost:4000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"a@x.com","password":"MatKhau123"}'

# 3. Gọi API cần đăng nhập
curl localhost:4000/api/me -H "Authorization: Bearer <accessToken>"

# 4. Access token hết hạn sau 15 phút: đổi bằng cookie (cookie được xoay vòng)
curl -b cookies.txt -c cookies.txt -X POST localhost:4000/api/auth/refresh

# 5. Đăng xuất
curl -b cookies.txt -X POST localhost:4000/api/auth/logout
```

Phía web: lưu `accessToken` trong bộ nhớ (biến JS), **không** lưu vào localStorage; khi gặp 401 thì gọi `/auth/refresh` một lần rồi thử lại. Trình duyệt tự gửi cookie refresh nếu `fetch` có `credentials: "include"`.

## Quyết định thiết kế

| Vấn đề | Cách làm | Lý do |
| --- | --- | --- |
| Lưu mật khẩu | argon2id (19 MiB, 2 vòng) | Khuyến nghị tối thiểu của OWASP |
| Access token | JWT HS256, 15 phút, chứa `sub` và `role` | Ngắn hạn để hạn chế thiệt hại khi lộ |
| Refresh token | Chuỗi ngẫu nhiên 32 byte, DB chỉ lưu SHA-256, cookie httpOnly, SameSite=Lax, 7 ngày | JavaScript không đọc được; lộ DB không dùng lại được |
| Xoay vòng | Mỗi refresh token dùng một lần. Dùng lại token cũ thì thu hồi mọi phiên | Phát hiện token bị đánh cắp |
| Tài khoản bị khóa | Guard đọc lại DB mỗi request | Khóa có hiệu lực ngay, không đợi token hết hạn |
| Vai trò | Lấy từ DB, không tin `role` trong token | Đổi vai trò có hiệu lực ngay |
| Đăng nhập sai | Cùng một thông báo cho sai email và sai mật khẩu; có băm giả để thời gian phản hồi như nhau | Không lộ email nào đã đăng ký |
| Rate limit | Đăng nhập 5/phút, đăng ký 10/phút, refresh 30/phút, còn lại 120/phút, theo IP | Chống dò mật khẩu |
| Body | Chỉ nhận trường khai báo trong DTO; trường lạ bị 400 | Không thể tự gán `role`, `status`, `licenseStatus` |

Hạn chế đã biết: hai tab trình duyệt cùng gọi `/auth/refresh` một lúc có thể làm tab chậm hơn bị coi là dùng lại token và đăng xuất mọi phiên. Phía web nên chỉ có một nơi gọi refresh.

## Cách bảo vệ endpoint mới

Mặc định mọi endpoint **yêu cầu đăng nhập**. Chỉ khi cần công khai mới phải đánh dấu.

```ts
@Controller("owner/vehicles")
export class OwnerVehiclesController {
  @Get()                                  // đăng nhập mới vào được
  @Roles("owner")                         // và phải là chủ xe
  list(@CurrentUser() user: AuthUser) {
    return this.vehicles.listOwnedBy(user.id);   // luôn lọc theo user.id từ token
  }

  @Public()                               // công khai, ví dụ tìm xe
  @Get("/vehicles")
  search() { /* ... */ }
}
```

Quy tắc theo CLAUDE.md: kiểm tra vai trò chưa đủ, mọi endpoint theo tài nguyên phải kiểm tra **quyền sở hữu**. Ví dụ `PATCH /owner/vehicles/:id` phải tìm xe với điều kiện `{ id, ownerId: user.id }` và trả 404 nếu không thấy, không nhận `ownerId` từ client.

## Mã lỗi

| Mã | HTTP | Khi nào |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Dữ liệu sai định dạng hoặc có trường lạ |
| `UNAUTHORIZED` | 401 | Thiếu, sai hoặc hết hạn access token |
| `INVALID_CREDENTIALS` | 401 | Sai email hoặc mật khẩu |
| `INVALID_REFRESH_TOKEN` | 401 | Thiếu, sai, hết hạn hoặc đã dùng refresh token |
| `ACCOUNT_BLOCKED` | 403 | Tài khoản bị khóa |
| `FORBIDDEN` | 403 | Sai vai trò |
| `EMAIL_TAKEN` | 409 | Email đã đăng ký |
| `TOO_MANY_REQUESTS` | 429 | Vượt giới hạn tốc độ |
| `INTERNAL_ERROR` | 500 | Lỗi không lường trước (chi tiết chỉ nằm trong log) |

## Chưa làm

- Quên mật khẩu, đổi mật khẩu, xác minh email (cần gửi email, sau MVP).
- Tải GPLX `POST /me/license` (PLAN Ngày 20).
- Giới hạn khóa tài khoản sau nhiều lần đăng nhập sai (hiện chỉ có rate limit theo IP).
