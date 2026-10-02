import { FuelType, Transmission } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from "class-validator";
import { normalizePlate, trim } from "../../common/transforms";
import {
  MAX_PRICE_PER_DAY,
  MAX_YEAR,
  MIN_PRICE_PER_DAY,
  MIN_YEAR,
  PLATE_MESSAGE,
  PLATE_PATTERN,
} from "./vehicle-fields";

// status, ownerId, title không nằm trong DTO nên client không thể gửi lên: trường lạ bị từ chối.
export class CreateVehicleDto {
  @Transform(trim)
  @IsString({ message: "Hãng xe không hợp lệ." })
  @Length(1, 50, { message: "Hãng xe phải từ 1 đến 50 ký tự." })
  brand!: string;

  @Transform(trim)
  @IsString({ message: "Mẫu xe không hợp lệ." })
  @Length(1, 50, { message: "Mẫu xe phải từ 1 đến 50 ký tự." })
  model!: string;

  @IsInt({ message: "Năm sản xuất phải là số nguyên." })
  @Min(MIN_YEAR, { message: `Năm sản xuất không được nhỏ hơn ${MIN_YEAR}.` })
  @Max(MAX_YEAR, { message: `Năm sản xuất không được lớn hơn ${MAX_YEAR}.` })
  year!: number;

  @Transform(normalizePlate)
  @Matches(PLATE_PATTERN, { message: PLATE_MESSAGE })
  plateNumber!: string;

  @IsInt({ message: "Số chỗ ngồi phải là số nguyên." })
  @Min(2, { message: "Số chỗ ngồi tối thiểu là 2." })
  @Max(16, { message: "Số chỗ ngồi tối đa là 16." })
  seats!: number;

  @IsEnum(Transmission, { message: "Hộp số chỉ nhận automatic hoặc manual." })
  transmission!: Transmission;

  @IsEnum(FuelType, { message: "Nhiên liệu chỉ nhận petrol, diesel hoặc electric." })
  fuel!: FuelType;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: "Mô tả không hợp lệ." })
  @MaxLength(2000, { message: "Mô tả tối đa 2000 ký tự." })
  description?: string;

  @Transform(trim)
  @IsString({ message: "Thành phố không hợp lệ." })
  @Length(1, 100, { message: "Thành phố phải từ 1 đến 100 ký tự." })
  city!: string;

  @Transform(trim)
  @IsString({ message: "Quận hoặc huyện không hợp lệ." })
  @Length(1, 100, { message: "Quận hoặc huyện phải từ 1 đến 100 ký tự." })
  district!: string;

  @IsInt({ message: "Giá mỗi ngày phải là số nguyên đồng." })
  @Min(MIN_PRICE_PER_DAY, { message: `Giá mỗi ngày tối thiểu ${MIN_PRICE_PER_DAY} đồng.` })
  @Max(MAX_PRICE_PER_DAY, { message: `Giá mỗi ngày tối đa ${MAX_PRICE_PER_DAY} đồng.` })
  pricePerDay!: number;

  @IsOptional()
  @IsInt({ message: "Tỷ lệ cọc phải là số nguyên phần trăm." })
  @Min(0, { message: "Tỷ lệ cọc từ 0 đến 100." })
  @Max(100, { message: "Tỷ lệ cọc từ 0 đến 100." })
  depositRate?: number;
}
