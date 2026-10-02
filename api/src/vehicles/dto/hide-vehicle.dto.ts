import { IsBoolean } from "class-validator";

export class HideVehicleDto {
  @IsBoolean({ message: "hidden phải là true hoặc false." })
  hidden!: boolean;
}
