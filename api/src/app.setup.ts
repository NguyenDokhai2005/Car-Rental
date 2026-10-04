import { ConfigService } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { createValidationPipe } from "./common/pipes/validation.pipe";
import { PUBLIC_UPLOAD_PREFIX, uploadRoot } from "./storage/local-disk.storage";

// Dùng chung cho main.ts và test e2e để test chạy đúng cấu hình thật.
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService);

  app.setGlobalPrefix("api");
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS chỉ cho domain khai báo, kèm credentials để trình duyệt gửi cookie refresh token.
  const origins = (config.get<string>("CORS_ORIGIN") ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  // Khi chạy dev (không có Nginx), API tự phục vụ ảnh đã tải lên. Ở production Nginx đọc thẳng volume uploads,
  // API không tham gia để khỏi tốn tài nguyên cho file tĩnh.
  if (config.get("NODE_ENV") !== "production") {
    app.useStaticAssets(uploadRoot(config), { prefix: PUBLIC_UPLOAD_PREFIX });
  }

  // Phía sau Nginx: lấy IP thật của client từ X-Forwarded-For để rate limit đúng người.
  if (config.get("NODE_ENV") === "production") app.set("trust proxy", 1);
}
