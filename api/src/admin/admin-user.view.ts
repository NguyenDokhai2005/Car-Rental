import type { Prisma } from "@prisma/client";
import { PUBLIC_USER_SELECT, PublicUser } from "../users/user.view";

// Dùng lại đúng danh sách trường công khai của người dùng, nên mật khẩu và khóa file GPLX không thể lọt ra đây.
export const ADMIN_USER_SELECT = {
  ...PUBLIC_USER_SELECT,
  _count: { select: { vehicles: true, bookings: true } },
} satisfies Prisma.UserSelect;

export type AdminUserRow = Prisma.UserGetPayload<{ select: typeof ADMIN_USER_SELECT }>;

export type AdminUser = PublicUser & { vehicleCount: number; bookingCount: number };

export function toAdminUser({ _count, ...user }: AdminUserRow): AdminUser {
  return { ...user, vehicleCount: _count.vehicles, bookingCount: _count.bookings };
}
