import { Transform } from "class-transformer";
import { IsString, Length, Matches } from "class-validator";
import { trim } from "../../common/transforms";

export class VerifyLicenseDto {
  @IsString({ message: "Thiếu version của hồ sơ." })
  @Matches(/^[0-9a-f]{32}$/, { message: "version của hồ sơ không hợp lệ." })
  version!: string;
}

export class RejectLicenseDto {
  @Transform(trim)
  @IsString({ message: "Lý do từ chối không hợp lệ." })
  @Length(1, 500, { message: "Lý do từ chối phải từ 1 đến 500 ký tự." })
  reason!: string;
}
