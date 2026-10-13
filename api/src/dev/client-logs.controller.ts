import { Body, Controller, Headers, HttpCode, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { Public } from "../common/decorators/public.decorator";
import { ClientLogDto } from "./dto/client-log.dto";
import { ObservabilityService } from "./observability.service";

@Controller("client-logs")
export class ClientLogsController {
  constructor(private readonly observability: ObservabilityService) {}

  // Công khai vì lỗi có thể xảy ra trước khi người dùng đăng nhập. Giới hạn chặt để không ai dùng endpoint này làm đầy
  // nhật ký; nội dung nhận về là dữ liệu không tin cậy và chỉ được hiển thị dạng chữ.
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(204)
  @Post()
  report(@Body() dto: ClientLogDto, @Headers("user-agent") userAgent: string | undefined, @Req() req: Request): void {
    this.observability.recordLog("browser", {
      at: new Date().toISOString(),
      level: dto.level,
      message: dto.message,
      stack: dto.stack,
      url: dto.url,
      userAgent: userAgent?.slice(0, 300),
      ip: req.ip ?? null,
    });
  }
}
