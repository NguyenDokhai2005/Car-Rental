import { Module } from "@nestjs/common";
import { AvailabilityService } from "./availability.service";
import { OwnerVehiclesController } from "./owner-vehicles.controller";
import { OwnerVehiclesService } from "./owner-vehicles.service";
import { VehicleImagesService } from "./vehicle-images.service";
import { VehicleSearchService } from "./vehicle-search.service";
import { VehiclesController } from "./vehicles.controller";

@Module({
  controllers: [OwnerVehiclesController, VehiclesController],
  providers: [OwnerVehiclesService, VehicleImagesService, VehicleSearchService, AvailabilityService],
  exports: [AvailabilityService],
})
export class VehiclesModule {}
