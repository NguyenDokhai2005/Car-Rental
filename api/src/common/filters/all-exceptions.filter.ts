import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

type ErrorBody = { code: string; message: string };

const STATUS_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: "VALIDATION_ERROR",
  [HttpStatus.UNAUTHORIZED]: "UNAUTHORIZED",
  [HttpStatus.FORBIDDEN]: "FORBIDDEN",
  [HttpStatus.NOT_FOUND]: "NOT_FOUND",
  [HttpStatus.CONFLICT]: "CONFLICT",
  [HttpStatus.PAYLOAD_TOO_LARGE]: "PAYLOAD_TOO_LARGE",
  [HttpStatus.TOO_MANY_REQUESTS]: "TOO_MANY_REQUESTS",
};

const DEFAULT_MESSAGES: Record<number, string> = {
  [HttpStatus.UNAUTHORIZED]: "Bạn cần đăng nhập để thực hiện thao tác này.",
  [HttpStatus.FORBIDDEN]: "Bạn không có quyền thực hiện thao tác này.",
  [HttpStatus.NOT_FOUND]: "Không tìm thấy nội dung yêu cầu.",
  [HttpStatus.TOO_MANY_REQUESTS]: "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.",
  [HttpStatus.PAYLOAD_TOO_LARGE]: "Tệp quá lớn. Mỗi ảnh tối đa 5 MB.",
};

function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return typeof body.code === "string" && typeof body.message === "string";
}

function toErrorBody(status: number, response: string | object): ErrorBody {
  if (isErrorBody(response)) return { code: response.code, message: response.message };

  const code = STATUS_CODES[status] ?? "ERROR";
  const fallback = DEFAULT_MESSAGES[status];
  if (fallback) return { code, message: fallback };

  const raw = typeof response === "string" ? response : (response as { message?: unknown }).message;
  const message = Array.isArray(raw) ? raw.join("; ") : typeof raw === "string" ? raw : "Yêu cầu không hợp lệ.";
  return { code, message };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json(toErrorBody(status, exception.getResponse()));
      return;
    }

    // Lỗi không lường trước: ghi log đầy đủ, nhưng không để lộ chi tiết cho client.
    this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: "INTERNAL_ERROR",
      message: "Lỗi hệ thống. Vui lòng thử lại sau.",
    } satisfies ErrorBody);
  }
}
