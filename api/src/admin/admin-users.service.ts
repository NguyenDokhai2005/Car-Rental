import { randomInt } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { BookingStatus, Prisma, UserStatus, VehicleStatus } from "@prisma/client";
import { PasswordService } from "../auth/password.service";
import { ApiError } from "../common/api-error";
import { effectiveBookingStatus } from "../common/booking-holds";
import { PrismaService } from "../common/prisma/prisma.service";
import type { Page } from "../vehicles/vehicle.view";
import { recordAdminAction } from "./admin-actions";
import { ADMIN_USER_SELECT, AdminUser, toAdminUser } from "./admin-user.view";
import type { ListUsersQuery } from "./dto/list-users.query";

export type AdminUserDetail = AdminUser & {
  blockReason: string | null;
  vehicles: { id: string; title: string; plateNumber: string; status: VehicleStatus }[];
  bookings: { id: string; status: BookingStatus; startAt: Date; endAt: Date; totalAmount: number; vehicleTitle: string }[];
  actions: { action: string; reason: string | null; adminName: string; createdAt: Date }[];
};

// Bỏ các ký tự dễ đọc nhầm (0/O, 1/l/I): admin phải đọc mật khẩu này cho người dùng qua điện thoại hoặc tin nhắn.
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const TEMPORARY_PASSWORD_LENGTH = 14;

function temporaryPassword(): string {
  return Array.from({ length: TEMPORARY_PASSWORD_LENGTH }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join("");
}

function notFound(): ApiError {
  return new ApiError(404, "NOT_FOUND", "Không tìm thấy người dùng.");
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

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

  async getDetail(userId: string): Promise<AdminUserDetail> {
    const now = new Date();
    const [user, vehicles, bookings, actions] = await this.prisma.$transaction([
      this.prisma.user.findUnique({ where: { id: userId }, select: ADMIN_USER_SELECT }),
      this.prisma.vehicle.findMany({
        where: { ownerId: userId },
        select: { id: true, title: true, plateNumber: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      this.prisma.booking.findMany({
        where: { renterId: userId },
        select: { id: true, status: true, expiresAt: true, startAt: true, endAt: true, totalAmount: true, vehicle: { select: { title: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      this.prisma.adminAction.findMany({
        where: { targetUserId: userId },
        select: { action: true, reason: true, createdAt: true, admin: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);
    if (!user) throw notFound();

    return {
      ...toAdminUser(user),
      blockReason: user.status === "blocked" ? (actions.find((entry) => entry.action === "user.block")?.reason ?? null) : null,
      vehicles,
      bookings: bookings.map(({ vehicle, expiresAt, status, ...booking }) => ({
        ...booking,
        status: effectiveBookingStatus(status, expiresAt, now),
        vehicleTitle: vehicle.title,
      })),
      actions: actions.map(({ admin, ...entry }) => ({ ...entry, adminName: admin.fullName })),
    };
  }

  // Người mà admin này được phép can thiệp: không phải chính mình, không phải admin khác.
  private async findTarget(adminId: string, userId: string, verb: string): Promise<void> {
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!target) throw notFound();
    if (target.id === adminId) throw new ApiError(409, "INVALID_STATE", `Bạn không thể tự ${verb} tài khoản của mình.`);
    if (target.role === "admin") throw new ApiError(409, "INVALID_STATE", `Không ${verb} được tài khoản quản trị viên.`);
  }

  // Khóa hoặc mở tài khoản. Guard đọc lại trạng thái người dùng ở mỗi yêu cầu, nên khóa có hiệu lực ngay, không phải chờ
  // access token hết hạn. Điều kiện "không phải admin" và "trạng thái đang khác" nằm trong WHERE của câu UPDATE: một admin
  // không bao giờ bị khóa dù vai trò vừa đổi, và gọi lặp lại không ghi thêm dòng nhật ký nào.
  async setStatus(adminId: string, userId: string, status: UserStatus, reason?: string): Promise<AdminUser> {
    await this.findTarget(adminId, userId, status === "blocked" ? "khóa" : "mở khóa");

    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({ where: { id: userId, role: { not: "admin" }, status: { not: status } }, data: { status } });
      if (changed.count === 0) return;
      await recordAdminAction(tx, { adminId, action: status === "blocked" ? "user.block" : "user.unblock", target: { userId }, reason });
    });
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: ADMIN_USER_SELECT });
    return toAdminUser(row);
  }

  // Đặt lại mật khẩu cho người quên mật khẩu (hệ thống chưa gửi được email). Mật khẩu tạm chỉ trả về đúng lần này, không
  // lưu ở đâu ngoài dạng băm. Thu hồi mọi phiên đăng nhập: nếu lý do đặt lại là tài khoản bị người khác dùng, họ bị đẩy ra ngay.
  async resetPassword(adminId: string, userId: string): Promise<{ temporaryPassword: string }> {
    await this.findTarget(adminId, userId, "đặt lại mật khẩu");

    const password = temporaryPassword();
    const passwordHash = await this.passwords.hash(password);
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({ where: { id: userId, role: { not: "admin" } }, data: { passwordHash } });
      if (changed.count === 0) throw new ApiError(409, "INVALID_STATE", "Tài khoản vừa được cập nhật. Vui lòng tải lại và thử lại.");
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await recordAdminAction(tx, { adminId, action: "user.reset_password", target: { userId } });
    });
    return { temporaryPassword: password };
  }
}
