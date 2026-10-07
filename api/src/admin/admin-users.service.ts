import { Injectable } from "@nestjs/common";
import type { Prisma, UserStatus } from "@prisma/client";
import { ApiError } from "../common/api-error";
import { PrismaService } from "../common/prisma/prisma.service";
import type { Page } from "../vehicles/vehicle.view";
import { ADMIN_USER_SELECT, AdminUser, toAdminUser } from "./admin-user.view";
import type { ListUsersQuery } from "./dto/list-users.query";

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListUsersQuery): Promise<Page<AdminUser>> {
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.licenseStatus ? { licenseStatus: query.licenseStatus } : {}),
      ...(query.q
        ? {
            OR: [
              { fullName: { contains: query.q, mode: "insensitive" } },
              { email: { contains: query.q, mode: "insensitive" } },
              { phone: { contains: query.q } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: ADMIN_USER_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: rows.map(toAdminUser), total, page: query.page, limit: query.limit };
  }

  // Khóa hoặc mở tài khoản. Guard đọc lại trạng thái người dùng ở mỗi yêu cầu, nên khóa có hiệu lực ngay, không phải chờ
  // access token hết hạn. Điều kiện "không phải admin" nằm trong WHERE của câu UPDATE: dù vai trò vừa bị đổi giữa lúc đọc
  // và lúc ghi, một admin cũng không bao giờ bị khóa.
  async setStatus(adminId: string, userId: string, status: UserStatus): Promise<AdminUser> {
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!target) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy người dùng.");
    if (target.id === adminId) throw new ApiError(409, "INVALID_STATE", "Bạn không thể tự khóa tài khoản của mình.");
    if (target.role === "admin") throw new ApiError(409, "INVALID_STATE", "Không khóa được tài khoản quản trị viên.");

    await this.prisma.user.updateMany({ where: { id: userId, role: { not: "admin" } }, data: { status } });
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: ADMIN_USER_SELECT });
    return toAdminUser(row);
  }
}
