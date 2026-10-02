import { IsOptional, Matches } from "class-validator";

export class MonthQuery {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "month phải có dạng YYYY-MM, ví dụ 2026-10." })
  month?: string;
}
