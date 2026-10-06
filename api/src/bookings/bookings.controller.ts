import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { uuidParam } from "../common/pipes/uuid-param.pipe";
import type { Page } from "../vehicles/vehicle.view";
import { BookingTransitionsService } from "./booking-transitions.service";
import type { BookingDetailView, BookingView } from "./booking.view";
import { BookingsService } from "./bookings.service";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { ListBookingsQuery } from "./dto/list-bookings.query";

// Người thực hiện luôn lấy từ access token (@CurrentUser), không nhận renterId từ client.
@Controller("bookings")
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly transitions: BookingTransitionsService,
  ) {}

  // Giới hạn tốc độ riêng, chặt hơn mặc định: tạo đơn giữ lịch của xe nên không để ai gửi hàng loạt.
  @Post()
  @Roles("renter")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto): Promise<BookingView> {
    return this.bookings.create(user.id, dto);
  }

  @Get()
  @Roles("renter")
  list(@CurrentUser() user: AuthUser, @Query() query: ListBookingsQuery): Promise<Page<BookingView>> {
    return this.bookings.list(user.id, query);
  }

  // Thanh toán tiền thuê + tiền cọc cho đơn vừa tạo. Hiện là thanh toán tức thì (SPEC §7); khi có cổng thanh toán, endpoint này
  // sẽ tạo giao dịch và việc ghi nhận chuyển sang IPN.
  @HttpCode(200)
  @Post(":id/pay")
  @Roles("renter")
  pay(@CurrentUser() user: AuthUser, @Param("id", uuidParam) id: string): Promise<BookingDetailView> {
    return this.transitions.pay(user.id, id);
  }

  // Khách hủy đơn của chính mình. Số tiền hoàn nằm trong refundAmount của kết quả.
  @HttpCode(200)
  @Post(":id/cancel")
  @Roles("renter")
  cancel(@CurrentUser() user: AuthUser, @Param("id", uuidParam) id: string): Promise<BookingDetailView> {
    return this.transitions.cancel(user.id, id);
  }

  // Khách xác nhận đã nhận xe. Đơn chỉ thành "đang thuê" khi chủ xe cũng đã xác nhận giao xe.
  @HttpCode(200)
  @Post(":id/pickup")
  @Roles("renter")
  pickup(@CurrentUser() user: AuthUser, @Param("id", uuidParam) id: string): Promise<BookingDetailView> {
    return this.transitions.pickup(user.id, id);
  }

  // Khách xác nhận đã trả xe. Đơn chỉ hoàn tất khi chủ xe cũng đã xác nhận nhận lại xe.
  @HttpCode(200)
  @Post(":id/return")
  @Roles("renter")
  returnVehicle(@CurrentUser() user: AuthUser, @Param("id", uuidParam) id: string): Promise<BookingDetailView> {
    return this.transitions.returnVehicle(user.id, id);
  }

  // Khách, chủ xe và admin đều gọi được; ai được xem đơn nào do service quyết định (kiểm tra quyền sở hữu, không chỉ vai trò).
  @Get(":id")
  getOne(@CurrentUser() user: AuthUser, @Param("id", uuidParam) id: string): Promise<BookingDetailView> {
    return this.bookings.getOne(user, id);
  }
}
