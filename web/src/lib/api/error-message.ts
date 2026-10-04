import { ApiError } from "./client";

// Câu báo lỗi cho người dùng: lỗi do API trả về đã là tiếng Việt, mọi lỗi khác dùng câu chung (không lộ chi tiết kỹ thuật).
export function apiErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Đã có lỗi xảy ra. Vui lòng thử lại.";
}
