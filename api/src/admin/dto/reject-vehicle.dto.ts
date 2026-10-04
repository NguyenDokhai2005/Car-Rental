import { Transform } from "class-transformer";
import { IsString, Length } from "class-validator";
import { trim } from "../../common/transforms";

export class RejectVehicleDto {
  @Transform(trim)
  @IsString({ message: "Lý do từ chối không hợp lệ." })
  @Length(1, 500, { message: "Lý do từ chối phải từ 1 đến 500 ký tự." })
  reason!: string;
}
