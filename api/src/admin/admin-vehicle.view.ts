import type { Prisma } from "@prisma/client";

// Trường admin được xem khi duyệt xe. Có thông tin liên hệ chủ xe (admin cần liên lạc khi có vấn đề) nhưng
// không bao giờ có mật khẩu băm, token hay giấy tờ.
export const ADMIN_VEHICLE_SELECT = {
  id: true,
  title: true,
  brand: true,
  model: true,
  year: true,
  plateNumber: true,
  seats: true,
  transmission: true,
  fuel: true,
  description: true,
  city: true,
  district: true,
  pricePerDay: true,
  depositRate: true,
  status: true,
  rejectReason: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, fullName: true, email: true, phone: true } },
  images: { select: { id: true, storageKey: true, position: true }, orderBy: { position: "asc" } },
} satisfies Prisma.VehicleSelect;

export type AdminVehicleRow = Prisma.VehicleGetPayload<{ select: typeof ADMIN_VEHICLE_SELECT }>;

export type AdminVehicle = Omit<AdminVehicleRow, "images"> & {
  images: { id: string; url: string; position: number }[];
};
