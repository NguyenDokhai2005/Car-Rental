import { BookingStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";

export class ListBookingsQuery {
  @IsOptional()
  @IsEnum(BookingStatus, { message: "status không hợp lệ." })
  status?: BookingStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "page phải là số nguyên." })
  @Min(1, { message: "page tối thiểu là 1." })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "limit phải là số nguyên." })
  @Min(1, { message: "limit tối thiểu là 1." })
  @Max(50, { message: "limit tối đa là 50." })
  limit: number = 20;
}
