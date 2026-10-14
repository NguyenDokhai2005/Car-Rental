import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { uuidParam } from "../common/pipes/uuid-param.pipe";
import { ListBookingsQuery } from "../bookings/dto/list-bookings.query";
import type { Page } from "../vehicles/vehicle.view";
import { AdminBooking, AdminBookingsService, LedgerTotals } from "./admin-bookings.service";
import { CancelBookingDto } from "./dto/admin-actions.dto";

@Controller("admin/bookings")
@Roles("admin")
export class AdminBookingsController {
  constructor(private readonly bookings: AdminBookingsService) {}

  @Get()
  list(@Query() query: ListBookingsQuery): Promise<Page<AdminBooking> & { totals: LedgerTotals }> {
    return this.bookings.list(query);
  }

  @HttpCode(200)
  @Post(":id/cancel")
  cancel(@CurrentUser() admin: AuthUser, @Param("id", uuidParam) id: string, @Body() dto: CancelBookingDto): Promise<AdminBooking> {
    return this.bookings.cancel(admin.id, id, dto.reason, dto.rentalRefundPercent);
  }
}
