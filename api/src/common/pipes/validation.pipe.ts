import { ValidationError, ValidationPipe } from "@nestjs/common";
import { ApiError } from "../api-error";

function collectMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...collectMessages(error.children ?? []),
  ]);
}

// Chỉ nhận đúng các trường khai báo trong DTO; trường lạ (ví dụ "role" khi sửa hồ sơ) bị từ chối.
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new ApiError(400, "VALIDATION_ERROR", collectMessages(errors).join("; ") || "Dữ liệu không hợp lệ."),
  });
}
