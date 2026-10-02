import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import type { VehicleBlock } from "@prisma/client";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { uuidParam } from "../common/pipes/uuid-param.pipe";
import { CreateBlockDto } from "./dto/create-block.dto";
import { CreateVehicleDto } from "./dto/create-vehicle.dto";
import { HideVehicleDto } from "./dto/hide-vehicle.dto";
import { ListVehiclesQuery } from "./dto/list-vehicles.query";
import { MonthQuery } from "./dto/month.query";
import { UpdateVehicleDto } from "./dto/update-vehicle.dto";
import { OwnerVehiclesService } from "./owner-vehicles.service";
import type { OwnerBusyPeriod, OwnerVehicle, Page } from "./vehicle.view";

// Chủ xe luôn được xác định bằng access token (@CurrentUser), không nhận ownerId từ client.
@Controller("owner/vehicles")
@Roles("owner")
export class OwnerVehiclesController {
  constructor(private readonly vehicles: OwnerVehiclesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListVehiclesQuery): Promise<Page<OwnerVehicle>> {
    return this.vehicles.list(user.id, query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVehicleDto): Promise<OwnerVehicle> {
    return this.vehicles.create(user.id, dto);
  }

  @Get(":id")
  getOne(@CurrentUser() user: AuthUser, @Param("id", uuidParam) id: string): Promise<OwnerVehicle> {
    return this.vehicles.getOne(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", uuidParam) id: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<OwnerVehicle> {
    return this.vehicles.update(user.id, id, dto);
  }

  @HttpCode(200)
  @Post(":id/hide")
  hide(
    @CurrentUser() user: AuthUser,
    @Param("id", uuidParam) id: string,
    @Body() dto: HideVehicleDto,
  ): Promise<OwnerVehicle> {
    return this.vehicles.setHidden(user.id, id, dto.hidden);
  }

  @Get(":id/blocks")
  listBlocks(@CurrentUser() user: AuthUser, @Param("id", uuidParam) id: string): Promise<VehicleBlock[]> {
    return this.vehicles.listBlocks(user.id, id);
  }

  @Post(":id/blocks")
  createBlock(
    @CurrentUser() user: AuthUser,
    @Param("id", uuidParam) id: string,
    @Body() dto: CreateBlockDto,
  ): Promise<VehicleBlock> {
    return this.vehicles.createBlock(user.id, id, dto);
  }

  @HttpCode(204)
  @Delete(":id/blocks/:blockId")
  deleteBlock(
    @CurrentUser() user: AuthUser,
    @Param("id", uuidParam) id: string,
    @Param("blockId", uuidParam) blockId: string,
  ): Promise<void> {
    return this.vehicles.deleteBlock(user.id, id, blockId);
  }

  @Get(":id/calendar")
  calendar(
    @CurrentUser() user: AuthUser,
    @Param("id", uuidParam) id: string,
    @Query() query: MonthQuery,
  ): Promise<{ vehicleId: string; month: string; busy: OwnerBusyPeriod[] }> {
    return this.vehicles.calendar(user.id, id, query.month);
  }
}
