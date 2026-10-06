import { Module } from "@nestjs/common";
import { BookingsModule } from "../bookings/bookings.module";
import { AdminBookingsController } from "./admin-bookings.controller";
import { AdminBookingsService } from "./admin-bookings.service";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";
import { AdminVehiclesController } from "./admin-vehicles.controller";
import { AdminVehiclesService } from "./admin-vehicles.service";

@Module({
  imports: [BookingsModule],
  controllers: [AdminVehiclesController, AdminUsersController, AdminBookingsController],
  providers: [AdminVehiclesService, AdminUsersService, AdminBookingsService],
})
export class AdminModule {}
