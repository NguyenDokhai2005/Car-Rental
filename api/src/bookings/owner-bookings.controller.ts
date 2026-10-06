import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { uuidParam } from "../common/pipes/uuid-param.pipe";
import type { Page } from "../vehicles/vehicle.view";
import { BookingTransitionsService } from "./booking-transitions.service";
import type { BookingDetailView } from "./booking.view";
import { BookingsService } from "./bookings.service";
import { ListBookingsQuery } from "./dto/list-bookings.query";
import { RejectBookingDto } from "./dto/reject-booking.dto";

// Đơn trên các xe của chủ xe đang đăng nhập. Chủ xe luôn lấy từ access token; service kiểm tra đơn thuộc xe của người đó
// (đơn trên xe của người khác trả 404, không trả 403, để không lộ sự tồn tại).
@Controller("owner/bookings")
@Roles("owner")
export class OwnerBookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly transitions: BookingTransitionsService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListBookingsQuery): Promise<Page<BookingDetailView>> {
    return this.bookings.listForOwner(user.id, query);
  }

  @HttpCode(200)
  @Post(":id/approve")
  approve(@CurrentUser() user: AuthUser, @Param("id", uuidParam) id: string): Promise<BookingDetailView> {
    return this.transitions.approve(user.id, id);
  }

  @HttpCode(200)
  @Post(":id/reject")
  reject(
    @CurrentUser() user: AuthUser,
    @Param("id", uuidParam) id: string,
    @Body() dto: RejectBookingDto,
  ): Promise<BookingDetailView> {
    return this.transitions.reject(user.id, id, dto.reason);
  }

  // Chủ xe xác nhận đã giao xe. Đơn chỉ thành "đang thuê" khi khách cũng đã xác nhận nhận xe.
  @HttpCode(200)
  @Post(":id/handover")
  handover(@CurrentUser() user: AuthUser, @Param("id", uuidParam) id: string): Promise<BookingDetailView> {
    return this.transitions.handover(user.id, id);
  }

  // Chủ xe xác nhận đã nhận lại xe. Đơn chỉ hoàn tất khi khách cũng đã xác nhận trả xe.
  @HttpCode(200)
  @Post(":id/receive")
  receive(@CurrentUser() user: AuthUser, @Param("id", uuidParam) id: string): Promise<BookingDetailView> {
    return this.transitions.receiveBack(user.id, id);
  }
}
