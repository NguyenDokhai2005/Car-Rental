import type { Prisma } from "@prisma/client";

// Chỉ những trường này được trả ra ngoài. Không bao giờ có passwordHash hay khóa file GPLX.
export const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  status: true,
  licenseStatus: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof PUBLIC_USER_SELECT }>;
