import { IsString, MaxLength, MinLength } from "class-validator";

export class ChangePasswordDto {
  @IsString({ message: "Mật khẩu hiện tại không hợp lệ." })
  @MinLength(1, { message: "Vui lòng nhập mật khẩu hiện tại." })
  @MaxLength(128, { message: "Mật khẩu tối đa 128 ký tự." })
  currentPassword!: string;

  // Cùng quy tắc với đăng ký (auth/dto/register.dto.ts).
  @IsString({ message: "Mật khẩu mới không hợp lệ." })
  @MinLength(8, { message: "Mật khẩu mới phải có ít nhất 8 ký tự." })
  @MaxLength(128, { message: "Mật khẩu tối đa 128 ký tự." })
  newPassword!: string;
}
