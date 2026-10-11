import { Module } from "@nestjs/common";
import { AdminLicensesController } from "./admin-licenses.controller";
import { LicensesService } from "./licenses.service";
import { MeLicenseController } from "./me-license.controller";

@Module({
  controllers: [MeLicenseController, AdminLicensesController],
  providers: [LicensesService],
})
export class LicensesModule {}
