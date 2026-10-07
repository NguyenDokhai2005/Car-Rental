import { LicenseStatus, UserRole, UserStatus } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { trim } from "../../common/transforms";

export class ListUsersQuery {
  @IsOptional()
  @IsEnum(UserRole, { message: "role chỉ nhận renter, owner hoặc admin." })
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus, { message: "status chỉ nhận active hoặc blocked." })
  status?: UserStatus;

  @IsOptional()
  @IsEnum(LicenseStatus, { message: "licenseStatus chỉ nhận none, pending, verified hoặc rejected." })
  licenseStatus?: LicenseStatus;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: "q không hợp lệ." })
  @MaxLength(100, { message: "q tối đa 100 ký tự." })
  q?: string;

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
