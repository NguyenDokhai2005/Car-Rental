import { Body, Controller, Get, HttpCode, Patch, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UpdateMeDto } from "./dto/update-me.dto";
import { PublicUser } from "./user.view";
import { UsersService } from "./users.service";

// Endpoint "của tôi": luôn lấy id từ access token, không nhận id từ client, nên không thể xem hay sửa hồ sơ người khác.
@Controller("me")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  getMe(@CurrentUser() user: AuthUser): Promise<PublicUser> {
    return this.users.getMe(user.id);
  }

  @Patch()
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto): Promise<PublicUser> {
    return this.users.updateMe(user.id, dto);
  }

  // Giới hạn như đăng nhập: endpoint này cũng kiểm tra mật khẩu, nên cũng là chỗ để dò mật khẩu.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(204)
  @Post("password")
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto): Promise<void> {
    return this.users.changePassword(user.id, dto);
  }
}
