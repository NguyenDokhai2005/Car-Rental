// Hằng số kiểm tra dùng chung cho DTO tạo và sửa xe.
export const MIN_YEAR = 1990;
export const MAX_YEAR = new Date().getFullYear() + 1;

export const MIN_PRICE_PER_DAY = 50_000;
// Số tiền khách trả cho một đơn = tiền thuê (giá ngày x tối đa 30 ngày) + tiền cọc (tối đa 100% tiền thuê), và phải vừa cột
// INTEGER 32 bit của CSDL (tối đa 2.147.483.647). 35 triệu x 30 x 2 = 2,1 tỷ vẫn vừa; giá cao hơn thì tràn số và đặt xe sẽ lỗi
// 500. Có test canh quan hệ này (booking-rules.spec.ts).
export const MAX_PRICE_PER_DAY = 35_000_000;
// Giới hạn của BỘ LỌC giá khi tìm xe: chỉ cần vừa số nguyên 32 bit. Cố ý KHÔNG dùng giá trần của xe: khách gõ "đến 100 triệu"
// là muốn không giới hạn, không phải gửi sai dữ liệu.
export const MAX_PRICE_FILTER = 2_147_483_647;

// Áp dụng sau khi chuẩn hóa (chỉ còn chữ và số, viết hoa): "51K12345", "30A12345".
export const PLATE_PATTERN = /^[A-Z0-9]{5,12}$/;
export const PLATE_MESSAGE = "Biển số không hợp lệ (ví dụ 51K-123.45 hoặc 51K12345).";

// ISO 8601 đầy đủ giờ và múi giờ, ví dụ 2026-10-12T09:00:00+07:00 hoặc 2026-10-12T02:00:00Z.
// Ngày trần "2026-10-12" bị từ chối vì không rõ múi giờ.
export const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
export const ISO_DATETIME_MESSAGE = "Thời gian phải theo ISO 8601 có múi giờ, ví dụ 2026-10-12T09:00:00+07:00.";
