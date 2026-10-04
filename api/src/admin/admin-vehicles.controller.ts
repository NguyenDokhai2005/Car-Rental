import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { uuidParam } from "../common/pipes/uuid-param.pipe";
import { ListVehiclesQuery } from "../vehicles/dto/list-vehicles.query";
import type { Page } from "../vehicles/vehicle.view";
import { AdminVehiclesService } from "./admin-vehicles.service";
import type { AdminVehicle } from "./admin-vehicle.view";
import { RejectVehicleDto } from "./dto/reject-vehicle.dto";

// Chỉ admin. Admin xem được xe của mọi chủ xe nên không có kiểm tra sở hữu; người thực hiện luôn lấy từ access token.
@Controller("admin/vehicles")
@Roles("admin")
export class AdminVehiclesController {
  constructor(private readonly vehicles: AdminVehiclesService) {}

  @Get()
  list(@Query() query: ListVehiclesQuery): Promise<Page<AdminVehicle>> {
    return this.vehicles.list(query);
  }

  @HttpCode(200)
  @Post(":id/approve")
  approve(@CurrentUser() admin: AuthUser, @Param("id", uuidParam) id: string): Promise<AdminVehicle> {
    return this.vehicles.approve(admin.id, id);
  }

  @HttpCode(200)
  @Post(":id/reject")
  reject(
    @CurrentUser() admin: AuthUser,
    @Param("id", uuidParam) id: string,
    @Body() dto: RejectVehicleDto,
  ): Promise<AdminVehicle> {
    return this.vehicles.reject(admin.id, id, dto.reason);
  }
}
