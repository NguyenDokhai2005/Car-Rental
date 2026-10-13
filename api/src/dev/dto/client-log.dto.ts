import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

// Lỗi do trình duyệt của người dùng gửi về. Ai cũng gọi được endpoint này, nên mọi trường đều có trần độ dài: một yêu cầu
// không thể nhét vào bộ nhớ của API nhiều hơn vài kB.
export class ClientLogDto {
  @IsIn(["error", "warn"], { message: "level chỉ nhận error hoặc warn." })
  level!: "error" | "warn";

  @IsString({ message: "message không hợp lệ." })
  @MinLength(1, { message: "message không được rỗng." })
  @MaxLength(2000, { message: "message tối đa 2000 ký tự." })
  message!: string;

  @IsOptional()
  @IsString({ message: "stack không hợp lệ." })
  @MaxLength(4000, { message: "stack tối đa 4000 ký tự." })
  stack?: string;

  @IsOptional()
  @IsString({ message: "url không hợp lệ." })
  @MaxLength(500, { message: "url tối đa 500 ký tự." })
  url?: string;
}
