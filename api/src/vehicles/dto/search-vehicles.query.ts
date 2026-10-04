import { FuelType, Transmission } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from "class-validator";
import { splitIntList, splitList, trim } from "../../common/transforms";
import { ISO_DATETIME_MESSAGE, ISO_DATETIME_PATTERN, MAX_PRICE_PER_DAY } from "./vehicle-fields";

export const VEHICLE_SORTS = ["newest", "price_asc", "price_desc"] as const;
export type VehicleSort = (typeof VEHICLE_SORTS)[number];

// Mọi tham số đều tùy chọn. Các quan hệ giữa nhiều tham số (minPrice <= maxPrice, startAt đi cùng endAt, khoảng ngày hợp lệ)
// được kiểm tra trong VehicleSearchService.
export class SearchVehiclesQuery {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: "Thành phố không hợp lệ." })
  @Length(1, 100, { message: "Thành phố phải từ 1 đến 100 ký tự." })
  city?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "minPrice phải là số nguyên đồng." })
  @Min(0, { message: "minPrice không được âm." })
  @Max(MAX_PRICE_PER_DAY, { message: `minPrice tối đa ${MAX_PRICE_PER_DAY}.` })
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "maxPrice phải là số nguyên đồng." })
  @Min(0, { message: "maxPrice không được âm." })
  @Max(MAX_PRICE_PER_DAY, { message: `maxPrice tối đa ${MAX_PRICE_PER_DAY}.` })
  maxPrice?: number;

  @IsOptional()
  @Transform(splitIntList)
  @IsArray({ message: "seats không hợp lệ." })
  @ArrayMaxSize(10, { message: "seats tối đa 10 giá trị." })
  @IsInt({ each: true, message: "seats chỉ nhận số nguyên, ví dụ 5 hoặc 5,7." })
  @Min(2, { each: true, message: "Số chỗ tối thiểu là 2." })
  @Max(16, { each: true, message: "Số chỗ tối đa là 16." })
  seats?: number[];

  @IsOptional()
  @Transform(splitList)
  @IsArray({ message: "fuel không hợp lệ." })
  @ArrayMaxSize(3, { message: "fuel tối đa 3 giá trị." })
  @IsEnum(FuelType, { each: true, message: "fuel chỉ nhận petrol, diesel hoặc electric." })
  fuel?: FuelType[];

  @IsOptional()
  @Transform(splitList)
  @IsArray({ message: "transmission không hợp lệ." })
  @ArrayMaxSize(2, { message: "transmission tối đa 2 giá trị." })
  @IsEnum(Transmission, { each: true, message: "transmission chỉ nhận automatic hoặc manual." })
  transmission?: Transmission[];

  @IsOptional()
  @Matches(ISO_DATETIME_PATTERN, { message: ISO_DATETIME_MESSAGE })
  startAt?: string;

  @IsOptional()
  @Matches(ISO_DATETIME_PATTERN, { message: ISO_DATETIME_MESSAGE })
  endAt?: string;

  @IsOptional()
  @IsIn(VEHICLE_SORTS, { message: "sort chỉ nhận newest, price_asc hoặc price_desc." })
  sort: VehicleSort = "newest";

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
  limit: number = 12;
}
