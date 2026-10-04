import { Module } from "@nestjs/common";
import { AdminVehiclesController } from "./admin-vehicles.controller";
import { AdminVehiclesService } from "./admin-vehicles.service";

@Module({
  controllers: [AdminVehiclesController],
  providers: [AdminVehiclesService],
})
export class AdminModule {}
