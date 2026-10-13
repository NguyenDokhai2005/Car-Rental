import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

// Tên bảng và cột của PostgreSQL trong dự án này chỉ gồm chữ thường, số và gạch dưới. Chặn mọi thứ khác ngay từ đầu;
// service còn đối chiếu lại với danh mục thật của CSDL.
export const IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;

export class TableRowsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "page phải là số nguyên." })
  @Min(1, { message: "page tối thiểu là 1." })
  @Max(100000, { message: "page quá lớn." })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "limit phải là số nguyên." })
  @Min(1, { message: "limit tối thiểu là 1." })
  @Max(100, { message: "limit tối đa là 100." })
  limit: number = 25;

  @IsOptional()
  @Matches(IDENTIFIER, { message: "sort không phải tên cột hợp lệ." })
  sort?: string;

  @IsOptional()
  @IsIn(["asc", "desc"], { message: "order chỉ nhận asc hoặc desc." })
  order: "asc" | "desc" = "asc";

  @IsOptional()
  @Matches(IDENTIFIER, { message: "filterColumn không phải tên cột hợp lệ." })
  filterColumn?: string;

  @IsOptional()
  @IsString({ message: "filterValue không hợp lệ." })
  @MaxLength(200, { message: "filterValue tối đa 200 ký tự." })
  filterValue?: string;
}
