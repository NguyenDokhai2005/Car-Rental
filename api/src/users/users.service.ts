import { Injectable } from "@nestjs/common";
import { PasswordService } from "../auth/password.service";
import { ApiError } from "../common/api-error";
import { PrismaService } from "../common/prisma/prisma.service";
import type { ChangePasswordDto } from "./dto/change-password.dto";
import type { UpdateMeDto } from "./dto/update-me.dto";
import { PUBLIC_USER_SELECT, PublicUser } from "./user.view";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: PUBLIC_USER_SELECT });
    if (!user) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy tài khoản.");
    return user;
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<PublicUser> {
    if (dto.fullName === undefined && dto.phone === undefined) {
      throw new ApiError(400, "VALIDATION_ERROR", "Cần cung cấp ít nhất một trường để cập nhật.");
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { fullName: dto.fullName, phone: dto.phone },
      select: PUBLIC_USER_SELECT,
    });
  }

  // Đổi mật khẩu của chính mình. Phải nhập đúng mật khẩu hiện tại: một access token bị lộ không đủ để chiếm tài khoản.
  // Thu hồi mọi refresh token: các thiết bị khác đang đăng nhập (kể cả kẻ đã biết mật khẩu cũ) mất phiên khi access token
  // hiện tại của họ hết hạn; thiết bị này đăng nhập lại bằng mật khẩu mới.
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user || !(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
      throw new ApiError(400, "VALIDATION_ERROR", "Mật khẩu hiện tại không đúng.");
    }
    if (dto.newPassword === dto.currentPassword) {
      throw new ApiError(400, "VALIDATION_ERROR", "Mật khẩu mới phải khác mật khẩu hiện tại.");
    }
    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }
}
