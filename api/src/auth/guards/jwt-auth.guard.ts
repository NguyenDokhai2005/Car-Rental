import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { UserRole } from "@prisma/client";
import { ApiError } from "../../common/api-error";
import { AuthenticatedRequest } from "../../common/decorators/current-user.decorator";
import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator";
import { PrismaService } from "../../common/prisma/prisma.service";

type AccessTokenPayload = { sub: string; role: UserRole };

function unauthorized(): ApiError {
  return new ApiError(401, "UNAUTHORIZED", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
}

// Guard toàn cục: endpoint nào không gắn @Public() đều phải có access token hợp lệ.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = (request.headers.authorization ?? "").split(" ");
    if (scheme !== "Bearer" || !token) throw unauthorized();

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, { algorithms: ["HS256"] });
    } catch {
      throw unauthorized();
    }

    // Đọc lại từ DB để khóa tài khoản hoặc đổi vai trò có hiệu lực ngay, không phải chờ token hết hạn.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, status: true },
    });
    if (!user) throw unauthorized();
    if (user.status === "blocked") {
      throw new ApiError(403, "ACCOUNT_BLOCKED", "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ.");
    }

    request.user = { id: user.id, role: user.role };
    return true;
  }
}
