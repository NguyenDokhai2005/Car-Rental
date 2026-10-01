import { Transform } from "class-transformer";
import { IsEmail, IsIn, IsString, Length, Matches, MaxLength, MinLength } from "class-validator";
import { UserRole } from "@prisma/client";
import { normalizeEmail, normalizePhone, PHONE_MESSAGE, PHONE_PATTERN, trim } from "../../common/transforms";

export class RegisterDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: "Email không hợp lệ." })
  @MaxLength(254, { message: "Email quá dài." })
  email!: string;

  @IsString({ message: "Mật khẩu không hợp lệ." })
  @MinLength(8, { message: "Mật khẩu phải có ít nhất 8 ký tự." })
  @MaxLength(128, { message: "Mật khẩu tối đa 128 ký tự." })
  password!: string;

  @Transform(trim)
  @IsString({ message: "Họ và tên không hợp lệ." })
  @Length(2, 100, { message: "Họ và tên phải từ 2 đến 100 ký tự." })
  fullName!: string;

  @Transform(normalizePhone)
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  phone!: string;

  // Không cho tự chọn admin khi đăng ký (SPEC §7).
  @IsIn([UserRole.renter, UserRole.owner], { message: "Vai trò chỉ có thể là renter hoặc owner." })
  role!: "renter" | "owner";
}
