import { Module } from "@nestjs/common";
import { AvailabilityService } from "./availability.service";
import { OwnerVehiclesController } from "./owner-vehicles.controller";
import { OwnerVehiclesService } from "./owner-vehicles.service";
import { VehiclesController } from "./vehicles.controller";

@Module({
  controllers: [OwnerVehiclesController, VehiclesController],
  providers: [OwnerVehiclesService, AvailabilityService],
  exports: [AvailabilityService],
})
export class VehiclesModule {}
