# Bộ dữ liệu mẫu

Bộ dữ liệu trong `api/demo-data/` gồm tài khoản đủ ba vai trò và một **danh mục ảnh xe thật**, từ đó script sinh ra hàng nghìn xe không trùng ảnh, không trùng mô tả.

| Thành phần | Nội dung |
| --- | --- |
| `api/demo-data/users.json` | 1 quản trị viên, 6 chủ xe, 12 khách thuê (7 đã xác minh GPLX, 3 chờ duyệt, 1 bị từ chối, 1 chưa gửi) |
| `api/demo-data/catalog.json` | 84 mẫu xe phổ biến ở Việt Nam: hãng, dòng xe, số chỗ, nhiên liệu, giá thuê gốc, các phiên bản (hộp số, hệ số giá), và 1.067 **bộ ảnh**, mỗi bộ là một chiếc xe thật chụp nhiều góc |
| `api/demo-data/photos/` | 1.973 ảnh (≈500 MB), cạnh dài tối đa 1280 px. **Không nằm trong git** (quá nặng); bản đầy đủ hiện có trên máy của người dựng bộ dữ liệu, cần chép tay khi muốn nạp lại |
| `api/demo-data/licenses/` | Hai thẻ giấy phép lái xe **mẫu tự vẽ**, dùng chung cho mọi khách thuê mẫu |
| `api/demo-data/CREDITS.md` | Tác giả, giấy phép và nguồn của từng ảnh xe |
| `api/scripts/import-demo.mjs` | Tạo các tài khoản trong `users.json` |
| `api/scripts/import-bulk-demo.mjs` | Sinh thêm tài khoản, xe (từ `catalog.json`) và đơn thuê |

Tài khoản mẫu có email dạng `demo.admin@autorent.test`, `demo.chuxe<n>@autorent.test`, `demo.khach<n>@autorent.test`.

## Nguồn ảnh và giấy phép

Ảnh xe lấy từ Wikimedia Commons và Flickr, chỉ những ảnh theo giấy phép cho phép dùng lại (CC0, phạm vi công cộng, CC BY, CC BY-SA). Ảnh được lọc tự động (bỏ ảnh nhỏ, ảnh trùng, xe đời trước 2015, xe cảnh sát, taxi, xe đua) rồi duyệt bằng mắt từng bộ. CC BY và CC BY-SA yêu cầu **ghi công tác giả**: phải giữ `CREDITS.md` đi cùng bộ ảnh, và nếu đưa trang web ra công chúng lâu dài thì nên có một trang ghi nguồn ảnh.

Năm sản xuất của xe sinh ra lấy theo năm ghi trong tên ảnh, hoặc năm chụp ảnh nếu tên không ghi; vì vậy đời xe có thể lệch vài năm so với chiếc xe thật trong ảnh.

Ảnh giấy phép lái xe là thẻ mẫu ghi rõ "MẪU THỬ NGHIỆM", không phải giấy tờ của bất kỳ ai.

## Script làm gì

- `import-demo.mjs` tạo các tài khoản mẫu chưa có. Khách thuê mẫu được gắn hồ sơ GPLX đúng trạng thái, ảnh lưu ở kho riêng như ảnh thật. Nhận ra tài khoản theo email, nên chạy lại không tạo trùng.
- `import-bulk-demo.mjs` sinh xe từ `catalog.json`: mỗi xe dùng trọn một bộ ảnh; một bộ ảnh chỉ được dùng lại khi số xe vượt số bộ ảnh (tối đa `BULK_PHOTO_REUSE` lần, mặc định 3) và không bao giờ hai lần trong cùng thành phố. Tiêu đề có phiên bản (ví dụ "Toyota Vios 1.5G CVT 2022"), giá tính theo phiên bản, đời xe và thành phố, mô tả ghép từ nhiều phần nên không xe nào trùng mô tả.
- Cả hai ghi thẳng vào CSDL và thư mục lưu file, không đi qua API. Ảnh được xử lý đúng như API làm (vẽ lại thành WebP, tối đa 1600 px) và mỗi xe có bản sao file riêng.

Mật khẩu lấy từ biến `DEMO_PASSWORD`, dùng chung cho các tài khoản tạo trong lần chạy đó; không đặt thì script sinh mật khẩu ngẫu nhiên và in ra đúng một lần. **Tài khoản quản trị viên mẫu có toàn quyền quản trị**: trên máy chủ thật hãy dùng mật khẩu ngẫu nhiên, và gỡ dữ liệu mẫu trước khi vận hành với người dùng thật.

## Chạy trên máy local

```bash
cd api
DEMO_PASSWORD='Password123!' node scripts/import-demo.mjs
node scripts/import-demo.mjs --remove      # gỡ
```

## Chạy trên máy chủ

Image production không chứa script và bộ ảnh, nên phải chép vào container rồi chạy trong đó (container đã có sẵn `DATABASE_URL`, `UPLOAD_DIR` và `PRIVATE_UPLOAD_DIR`).

```bash
# Trên máy của bạn
cd api && tar -czf /tmp/demo-data.tgz demo-data scripts/import-demo.mjs scripts/import-bulk-demo.mjs
scp /tmp/demo-data.tgz cloud:/tmp/

# Trên máy chủ
cd ~/car-rental
COMPOSE="docker compose -f infra/docker-compose.prod.yml --env-file $HOME/carrental-config/.env.production"
ID=$($COMPOSE ps -q api)
mkdir -p /tmp/demo && tar -xzf /tmp/demo-data.tgz -C /tmp/demo
docker exec -u root "$ID" mkdir -p /app/scripts
docker cp /tmp/demo/demo-data "$ID":/app/demo-data
docker cp /tmp/demo/scripts/import-demo.mjs "$ID":/app/scripts/import-demo.mjs
docker exec -w /app "$ID" node scripts/import-demo.mjs            # thêm --remove để gỡ
docker exec -u root "$ID" rm -rf /app/demo-data /app/scripts      # dọn
rm -rf /tmp/demo /tmp/demo-data.tgz
```

Mỗi lần deploy tạo lại container, nên các file chép vào sẽ mất; dữ liệu đã nhập thì vẫn còn vì nằm trong CSDL và các volume.

Trên server cloud, mật khẩu của lần nhập hiện tại được lưu ở `~/carrental-config/demo-accounts.txt` (chỉ user `deploy` đọc được).

## Bộ dữ liệu cỡ lớn

`api/scripts/import-bulk-demo.mjs` mở rộng bộ mẫu ở trên thành dữ liệu cỡ lớn để trình diễn và thử tải. Chạy **sau** `import-demo.mjs`, theo đúng cách chép vào container như trên (chép thêm file script này).

```bash
DEMO_PASSWORD='<mật khẩu chung>' node scripts/import-bulk-demo.mjs     # mặc định 5.000 tài khoản, 1.000 xe, 20.000 đơn
BULK_USERS=500 BULK_VEHICLES=1000 BULK_BOOKINGS=6000 DEMO_PASSWORD='Password123!' node scripts/import-bulk-demo.mjs   # cỡ nhỏ cho máy local
node scripts/import-bulk-demo.mjs --remove-all                          # xóa toàn bộ dữ liệu mẫu, cả bộ gốc
```

- **Mật khẩu:** `DEMO_PASSWORD` được đặt cho **mọi** tài khoản `@autorent.test`, kể cả tài khoản đã có từ trước, nên tất cả dùng chung một mật khẩu.
- **Tài khoản:** 1 quản trị viên, 500 chủ xe (`demo.chuxe1..500`), 4.499 khách thuê (`demo.khach1..4499`; khoảng 80% đã xác minh GPLX, còn lại chờ duyệt, bị từ chối hoặc chưa gửi).
- **Xe:** sinh từ `catalog.json` ra 12 thành phố (lệch về các thành phố lớn). Với 1.000 xe, mỗi xe một bộ ảnh riêng, không ảnh nào dùng lại. Khoảng 94% đã duyệt; còn lại chờ duyệt, bị ẩn hoặc bị từ chối. Xe và đơn chỉ được nạp một lần: muốn đổi số lượng thì `--remove-all` rồi nạp lại.
- **Đơn:** đủ mọi trạng thái (hoàn tất, đã xác nhận, đang thuê, chờ chủ xe duyệt, đã hủy, bị từ chối, hết hạn), số tiền khớp các ràng buộc sổ tiền của CSDL, và không đơn nào chồng lịch.
- **Chạy lại:** chỉ nạp phần tài khoản còn thiếu; xe và đơn chỉ nạp một lần.
- **Dung lượng ở cỡ mặc định:** ảnh xe sau khi chuyển sang WebP khoảng 370 MB (đo ở local với 1.000 xe), ảnh GPLX mẫu khoảng 0,2 GB. Sao lưu ảnh hằng ngày giữ 7 bản nhân dung lượng này lên 7 lần.
- **Thời gian:** ở máy local, 1.000 xe mất khoảng 3,5 phút (chủ yếu là chuyển ảnh sang WebP); trên máy chủ 1 vCPU sẽ lâu hơn.

Cỡ mặc định được chọn theo kết quả đo trên server 1 vCPU, 1,6 GB RAM, đĩa 60 GB: ở mức này mọi trang vẫn phản hồi dưới 50 ms.

## Gỡ dữ liệu mẫu

`--remove` xóa các xe mẫu **chưa có đơn nào** cùng ảnh của chúng, rồi xóa các tài khoản mẫu không còn dữ liệu liên quan. Những thứ sau được giữ lại, vì CSDL không cho xóa:

- Xe đã có đơn thuê, và chủ của những xe đó.
- Khách đã có đơn thuê.
- Tài khoản đã xuất hiện trong nhật ký xem giấy phép lái xe (nhật ký chỉ cho thêm dòng, không cho xóa).
