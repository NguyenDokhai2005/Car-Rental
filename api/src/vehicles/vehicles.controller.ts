import { Controller, Get, Param, Query } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import { uuidParam } from "../common/pipes/uuid-param.pipe";
import { AvailabilityService } from "./availability.service";
import { MonthQuery } from "./dto/month.query";

// Endpoint công khai của xe. Tìm xe và chi tiết xe sẽ thêm ở PLAN Ngày 10 đến 11.
@Controller("vehicles")
export class VehiclesController {
  constructor(private readonly availability: AvailabilityService) {}

  @Public()
  @Get(":id/availability")
  getAvailability(@Param("id", uuidParam) id: string, @Query() query: MonthQuery) {
    return this.availability.publicAvailability(id, query.month);
  }
}
