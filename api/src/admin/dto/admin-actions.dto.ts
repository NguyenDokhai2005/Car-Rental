import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from "class-validator";
import { trim } from "../../common/transforms";
import { ListVehiclesQuery } from "../../vehicles/dto/list-vehicles.query";

// Lý do bắt buộc cho các thao tác can thiệp (khóa tài khoản, gỡ xe). Người bị ảnh hưởng đọc được lý do này.
export class ReasonDto {
  @Transform(trim)
  @IsString({ message: "Lý do không hợp lệ." })
  @Length(1, 500, { message: "Lý do phải từ 1 đến 500 ký tự." })
  reason!: string;
}

export class CancelBookingDto extends ReasonDto {
  @IsInt({ message: "rentalRefundPercent phải là số nguyên." })
  @Min(0, { message: "rentalRefundPercent tối thiểu là 0." })
  @Max(100, { message: "rentalRefundPercent tối đa là 100." })
  rentalRefundPercent!: number;
}

export class ListAdminVehiclesQuery extends ListVehiclesQuery {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: "q không hợp lệ." })
  @MaxLength(100, { message: "q tối đa 100 ký tự." })
  q?: string;
}

export const OVERVIEW_DAYS = [7, 30, 90] as const;

export class OverviewQuery {
  @IsOptional()
  @Type(() => Number)
  @IsIn(OVERVIEW_DAYS, { message: "days chỉ nhận 7, 30 hoặc 90." })
  days: (typeof OVERVIEW_DAYS)[number] = 30;
}
