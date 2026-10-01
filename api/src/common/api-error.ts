import { HttpException } from "@nestjs/common";

// Mọi lỗi nghiệp vụ trả theo mẫu { code, message } (CLAUDE.md, SPEC §7).
export class ApiError extends HttpException {
  constructor(status: number, code: string, message: string) {
    super({ code, message }, status);
  }
}
