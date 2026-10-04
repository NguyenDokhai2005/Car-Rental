import { ApiError } from "@/lib/api/client";

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng.",
  ACCOUNT_BLOCKED: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ.",
  EMAIL_TAKEN: "Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.",
  TOO_MANY_REQUESTS: "Bạn thử quá nhiều lần. Vui lòng đợi một lúc rồi thử lại.",
  VALIDATION_ERROR: "Thông tin chưa hợp lệ. Kiểm tra lại các ô đã nhập.",
  NETWORK_ERROR: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.",
};

// Chuyển lỗi của API thành câu tiếng Việt cho người dùng; mã lạ thì dùng câu chung, không lộ chi tiết kỹ thuật.
export function authErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return MESSAGES[error.code] ?? "Đã có lỗi xảy ra. Vui lòng thử lại.";
  }
  return "Đã có lỗi xảy ra. Vui lòng thử lại.";
}
