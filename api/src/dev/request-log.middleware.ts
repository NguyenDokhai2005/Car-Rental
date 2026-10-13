import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import type { AuthUser } from "../common/decorators/current-user.decorator";
import { ObservabilityService } from "./observability.service";

// Không ghi các yêu cầu của chính việc theo dõi, nếu không trang dev tự làm đầy nhật ký mỗi lần tải lại.
const SKIPPED = [/^\/api\/health$/, /^\/api\/dev(\/|$)/];

// Ghi mỗi yêu cầu HTTP vào nhật ký trong bộ nhớ khi phản hồi đã gửi xong. Chỉ ghi siêu dữ liệu: KHÔNG ghi query string,
// body, header Authorization hay cookie (SPEC §7, mục Dev), nên token và dữ liệu người dùng không bao giờ nằm trong nhật ký.
@Injectable()
export class RequestLogMiddleware implements NestMiddleware {
  constructor(private readonly observability: ObservabilityService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const started = process.hrtime.bigint();
    // originalUrl là đường dẫn đầy đủ lúc yêu cầu tới; cắt bỏ phần query string ngay từ đầu.
    const path = req.originalUrl.split("?")[0].slice(0, 300);
    if (SKIPPED.some((pattern) => pattern.test(path))) {
      next();
      return;
    }

    res.on("finish", () => {
      // Guard gắn người dùng vào request SAU middleware này, nên phải đọc ở đây (lúc phản hồi xong) mới có.
      const user = (req as Request & { user?: AuthUser }).user;
      const route = req.route as { path?: unknown } | undefined;
      this.observability.recordRequest({
        at: new Date().toISOString(),
        method: req.method,
        path,
        route: typeof route?.path === "string" ? `${req.baseUrl}${route.path}` : null,
        status: res.statusCode,
        durationMs: Math.round(Number(process.hrtime.bigint() - started) / 1e6),
        ip: req.ip ?? null,
        userId: user?.id ?? null,
        role: user?.role ?? null,
      });
    });
    next();
  }
}
