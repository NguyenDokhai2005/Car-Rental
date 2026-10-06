import { Controller, Get, Query } from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator";
import { ListBookingsQuery } from "../bookings/dto/list-bookings.query";
import type { Page } from "../vehicles/vehicle.view";
import { AdminBooking, AdminBookingsService, LedgerTotals } from "./admin-bookings.service";

@Controller("admin/bookings")
@Roles("admin")
export class AdminBookingsController {
  constructor(private readonly bookings: AdminBookingsService) {}

  @Get()
  list(@Query() query: ListBookingsQuery): Promise<Page<AdminBooking> & { totals: LedgerTotals }> {
    return this.bookings.list(query);
  }
}
