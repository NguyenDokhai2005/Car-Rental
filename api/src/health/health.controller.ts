import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import { PrismaService } from "../common/prisma/prisma.service";

// Cho công cụ giám sát hỏi "hệ thống còn sống không". Công khai nên chỉ trả đúng một chữ trạng thái, không kèm phiên bản,
// thời gian chạy hay chi tiết lỗi.
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check(): Promise<{ status: "ok" }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ code: "UNAVAILABLE", message: "Hệ thống tạm thời chưa sẵn sàng." });
    }
    return { status: "ok" };
  }
}
