import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { uuidParam } from "../common/pipes/uuid-param.pipe";
import type { Page } from "../vehicles/vehicle.view";
import type { AdminUser } from "./admin-user.view";
import { AdminUserDetail, AdminUsersService } from "./admin-users.service";
import { ReasonDto } from "./dto/admin-actions.dto";
import { ListUsersQuery } from "./dto/list-users.query";

@Controller("admin/users")
@Roles("admin")
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: ListUsersQuery): Promise<Page<AdminUser>> {
    return this.users.list(query);
  }

  @Get(":id")
  getDetail(@Param("id", uuidParam) id: string): Promise<AdminUserDetail> {
    return this.users.getDetail(id);
  }

  @HttpCode(200)
  @Post(":id/block")
  block(@CurrentUser() admin: AuthUser, @Param("id", uuidParam) id: string, @Body() dto: ReasonDto): Promise<AdminUser> {
    return this.users.setStatus(admin.id, id, "blocked", dto.reason);
  }

  @HttpCode(200)
  @Post(":id/unblock")
  unblock(@CurrentUser() admin: AuthUser, @Param("id", uuidParam) id: string): Promise<AdminUser> {
    return this.users.setStatus(admin.id, id, "active");
  }

  // Giới hạn chặt: mỗi lần gọi băm một mật khẩu (tốn CPU) và làm một người dùng mất phiên đăng nhập.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post(":id/reset-password")
  resetPassword(@CurrentUser() admin: AuthUser, @Param("id", uuidParam) id: string): Promise<{ temporaryPassword: string }> {
    return this.users.resetPassword(admin.id, id);
  }
}
