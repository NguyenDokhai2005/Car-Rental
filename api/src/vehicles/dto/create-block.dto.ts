import { Transform } from "class-transformer";
import { IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { trim } from "../../common/transforms";
import { ISO_DATETIME_MESSAGE, ISO_DATETIME_PATTERN } from "./vehicle-fields";

export class CreateBlockDto {
  @Matches(ISO_DATETIME_PATTERN, { message: ISO_DATETIME_MESSAGE })
  startAt!: string;

  @Matches(ISO_DATETIME_PATTERN, { message: ISO_DATETIME_MESSAGE })
  endAt!: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: "Lý do không hợp lệ." })
  @MaxLength(200, { message: "Lý do tối đa 200 ký tự." })
  reason?: string;
}
