import { Controller, Get, Param, Query } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import { uuidParam } from "../common/pipes/uuid-param.pipe";
import { AvailabilityService } from "./availability.service";
import { MonthQuery } from "./dto/month.query";
import { SearchVehiclesQuery } from "./dto/search-vehicles.query";
import type { PublicVehicleDetail, PublicVehicleListItem } from "./public-vehicle.view";
import { VehicleSearchService } from "./vehicle-search.service";
import type { Page } from "./vehicle.view";

// Endpoint công khai của xe: tìm kiếm, chi tiết và lịch trống. Không cần đăng nhập, chỉ xe đã duyệt (approved).
@Controller("vehicles")
export class VehiclesController {
  constructor(
    private readonly availability: AvailabilityService,
    private readonly search: VehicleSearchService,
  ) {}

  @Public()
  @Get()
  list(@Query() query: SearchVehiclesQuery): Promise<Page<PublicVehicleListItem>> {
    return this.search.search(query);
  }

  @Public()
  @Get(":id")
  getOne(@Param("id", uuidParam) id: string): Promise<PublicVehicleDetail> {
    return this.search.getOne(id);
  }

  @Public()
  @Get(":id/availability")
  getAvailability(@Param("id", uuidParam) id: string, @Query() query: MonthQuery) {
    return this.availability.publicAvailability(id, query.month);
  }
}
