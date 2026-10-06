import { Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { uuidParam } from "../common/pipes/uuid-param.pipe";
import type { Page } from "../vehicles/vehicle.view";
import type { AdminUser } from "./admin-user.view";
import { AdminUsersService } from "./admin-users.service";
import { ListUsersQuery } from "./dto/list-users.query";

@Controller("admin/users")
@Roles("admin")
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: ListUsersQuery): Promise<Page<AdminUser>> {
    return this.users.list(query);
  }

  @HttpCode(200)
  @Post(":id/block")
  block(@CurrentUser() admin: AuthUser, @Param("id", uuidParam) id: string): Promise<AdminUser> {
    return this.users.setStatus(admin.id, id, "blocked");
  }

  @HttpCode(200)
  @Post(":id/unblock")
  unblock(@CurrentUser() admin: AuthUser, @Param("id", uuidParam) id: string): Promise<AdminUser> {
    return this.users.setStatus(admin.id, id, "active");
  }
}
