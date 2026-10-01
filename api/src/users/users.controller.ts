import { Body, Controller, Get, Patch } from "@nestjs/common";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
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
}
