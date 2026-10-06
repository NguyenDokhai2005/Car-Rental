import { Module } from "@nestjs/common";
import { BookingExpiryJob } from "./booking-expiry.job";
import { BookingPresenter } from "./booking-presenter";
import { BookingTransitionsService } from "./booking-transitions.service";
import { BookingsController } from "./bookings.controller";
import { BookingsService } from "./bookings.service";
import { OwnerBookingsController } from "./owner-bookings.controller";

@Module({
  controllers: [BookingsController, OwnerBookingsController],
  providers: [BookingsService, BookingTransitionsService, BookingPresenter, BookingExpiryJob],
  exports: [BookingPresenter],
})
export class BookingsModule {}
