import { Transform } from "class-transformer";
import { IsOptional, IsString, Length, Matches } from "class-validator";
import { normalizePhone, PHONE_MESSAGE, PHONE_PATTERN, trim } from "../../common/transforms";

// Chỉ cho sửa tên và số điện thoại. Email, vai trò, trạng thái không nằm trong DTO nên bị từ chối.
export class UpdateMeDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: "Họ và tên không hợp lệ." })
  @Length(2, 100, { message: "Họ và tên phải từ 2 đến 100 ký tự." })
  fullName?: string;

  @IsOptional()
  @Transform(normalizePhone)
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone?: string;
}
