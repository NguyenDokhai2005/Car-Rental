import { ParseUUIDPipe } from "@nestjs/common";
import { ApiError } from "../api-error";

// Id không phải UUID trả 404 như id không tồn tại: không để lộ khác biệt, và không để Prisma ném lỗi 500.
export const uuidParam = new ParseUUIDPipe({
  exceptionFactory: () => new ApiError(404, "NOT_FOUND", "Không tìm thấy nội dung yêu cầu."),
});
