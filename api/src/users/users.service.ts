import { Injectable } from "@nestjs/common";
import { ApiError } from "../common/api-error";
import { PrismaService } from "../common/prisma/prisma.service";
import type { UpdateMeDto } from "./dto/update-me.dto";
import { PUBLIC_USER_SELECT, PublicUser } from "./user.view";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
}
