// Hằng số kiểm tra dùng chung cho DTO tạo và sửa xe.
export const MIN_YEAR = 1990;
export const MAX_YEAR = new Date().getFullYear() + 1;

export const MIN_PRICE_PER_DAY = 50_000;
export const MAX_PRICE_PER_DAY = 100_000_000;

// Áp dụng sau khi chuẩn hóa (chỉ còn chữ và số, viết hoa): "51K12345", "30A12345".
export const PLATE_PATTERN = /^[A-Z0-9]{5,12}$/;
export const PLATE_MESSAGE = "Biển số không hợp lệ (ví dụ 51K-123.45 hoặc 51K12345).";

// ISO 8601 đầy đủ giờ và múi giờ, ví dụ 2026-10-12T09:00:00+07:00 hoặc 2026-10-12T02:00:00Z.
// Ngày trần "2026-10-12" bị từ chối vì không rõ múi giờ.
export const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
export const ISO_DATETIME_MESSAGE = "Thời gian phải theo ISO 8601 có múi giờ, ví dụ 2026-10-12T09:00:00+07:00.";
