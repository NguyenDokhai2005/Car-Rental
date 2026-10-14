import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BookingsModule } from "../bookings/bookings.module";
import { AdminBookingsController } from "./admin-bookings.controller";
import { AdminBookingsService } from "./admin-bookings.service";
import { AdminOverviewController } from "./admin-overview.controller";
import { AdminOverviewService } from "./admin-overview.service";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";
import { AdminVehiclesController } from "./admin-vehicles.controller";
import { AdminVehiclesService } from "./admin-vehicles.service";

@Module({
  imports: [BookingsModule, AuthModule],
  controllers: [AdminOverviewController, AdminVehiclesController, AdminUsersController, AdminBookingsController],
  providers: [AdminOverviewService, AdminVehiclesService, AdminUsersService, AdminBookingsService],
})
export class AdminModule {}
