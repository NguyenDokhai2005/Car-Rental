import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@prisma/client";
import { ApiError } from "../../common/api-error";
import { AuthenticatedRequest } from "../../common/decorators/current-user.decorator";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";

// Chạy sau JwtAuthGuard. Endpoint không gắn @Roles() thì mọi người dùng đã đăng nhập đều vào được.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user || !required.includes(user.role)) {
      throw new ApiError(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
    }
    return true;
  }
}
