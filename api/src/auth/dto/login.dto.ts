import { Transform } from "class-transformer";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { normalizeEmail } from "../../common/transforms";

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: "Email không hợp lệ." })
  @MaxLength(254)
  email!: string;

  @IsString({ message: "Mật khẩu không hợp lệ." })
  @MinLength(1, { message: "Vui lòng nhập mật khẩu." })
  @MaxLength(128)
  password!: string;
}
