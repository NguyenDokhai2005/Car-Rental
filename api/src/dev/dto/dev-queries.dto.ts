import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { trim } from "../../common/transforms";

export const LOG_SOURCES = ["server", "browser"] as const;

class LimitQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "limit phải là số nguyên." })
  @Min(1, { message: "limit tối thiểu là 1." })
  @Max(500, { message: "limit tối đa là 500." })
  limit: number = 100;
}

export class ListRequestsQuery extends LimitQuery {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === "true" ? true : value === "false" ? false : value))
  @IsBoolean({ message: "onlyErrors chỉ nhận true hoặc false." })
  onlyErrors?: boolean;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: "q không hợp lệ." })
  @MaxLength(100, { message: "q tối đa 100 ký tự." })
  q?: string;
}

export class ListLogsQuery extends LimitQuery {
  @IsIn(LOG_SOURCES, { message: "source chỉ nhận server hoặc browser." })
  source!: (typeof LOG_SOURCES)[number];

  @IsOptional()
  @IsIn(["log", "warn", "error"], { message: "level chỉ nhận log, warn hoặc error." })
  level?: string;
}

export class ClearLogsQuery {
  @IsIn(LOG_SOURCES, { message: "source chỉ nhận server hoặc browser." })
  source!: (typeof LOG_SOURCES)[number];
}
