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

// Mọi trường đều tùy chọn; ít nhất một trường phải có (kiểm tra trong service).
// Không có status: trạng thái chỉ đổi theo luật ở vehicle-rules.ts hoặc qua endpoint hide và admin.
export class UpdateVehicleDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: "Hãng xe không hợp lệ." })
  @Length(1, 50, { message: "Hãng xe phải từ 1 đến 50 ký tự." })
  brand?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: "Mẫu xe không hợp lệ." })
  @Length(1, 50, { message: "Mẫu xe phải từ 1 đến 50 ký tự." })
  model?: string;

  @IsOptional()
  @IsInt({ message: "Năm sản xuất phải là số nguyên." })
  @Min(MIN_YEAR, { message: `Năm sản xuất không được nhỏ hơn ${MIN_YEAR}.` })
  @Max(MAX_YEAR, { message: `Năm sản xuất không được lớn hơn ${MAX_YEAR}.` })
  year?: number;

  @IsOptional()
  @Transform(normalizePlate)
  @Matches(PLATE_PATTERN, { message: PLATE_MESSAGE })
  plateNumber?: string;

  @IsOptional()
  @IsInt({ message: "Số chỗ ngồi phải là số nguyên." })
  @Min(2, { message: "Số chỗ ngồi tối thiểu là 2." })
  @Max(16, { message: "Số chỗ ngồi tối đa là 16." })
  seats?: number;

  @IsOptional()
  @IsEnum(Transmission, { message: "Hộp số chỉ nhận automatic hoặc manual." })
  transmission?: Transmission;

  @IsOptional()
  @IsEnum(FuelType, { message: "Nhiên liệu chỉ nhận petrol, diesel hoặc electric." })
  fuel?: FuelType;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: "Mô tả không hợp lệ." })
  @MaxLength(2000, { message: "Mô tả tối đa 2000 ký tự." })
  description?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: "Thành phố không hợp lệ." })
  @Length(1, 100, { message: "Thành phố phải từ 1 đến 100 ký tự." })
  city?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: "Quận hoặc huyện không hợp lệ." })
  @Length(1, 100, { message: "Quận hoặc huyện phải từ 1 đến 100 ký tự." })
  district?: string;

  @IsOptional()
  @IsInt({ message: "Giá mỗi ngày phải là số nguyên đồng." })
  @Min(MIN_PRICE_PER_DAY, { message: `Giá mỗi ngày tối thiểu ${MIN_PRICE_PER_DAY} đồng.` })
  @Max(MAX_PRICE_PER_DAY, { message: `Giá mỗi ngày tối đa ${MAX_PRICE_PER_DAY} đồng.` })
  pricePerDay?: number;

  @IsOptional()
  @IsInt({ message: "Tỷ lệ cọc phải là số nguyên phần trăm." })
  @Min(0, { message: "Tỷ lệ cọc từ 0 đến 100." })
  @Max(100, { message: "Tỷ lệ cọc từ 0 đến 100." })
  depositRate?: number;
}
