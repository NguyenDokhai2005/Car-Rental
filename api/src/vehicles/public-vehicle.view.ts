import type { Prisma } from "@prisma/client";

// Trường công khai của xe. Cố ý KHÔNG có: biển số, ownerId, trạng thái, lý do từ chối, người duyệt.
// Thêm trường mới vào đây là công bố nó cho mọi người, nên cân nhắc kỹ.
const PUBLIC_FIELDS = {
  id: true,
  title: true,
  brand: true,
  model: true,
  year: true,
  seats: true,
  transmission: true,
  fuel: true,
  city: true,
  district: true,
  pricePerDay: true,
  depositRate: true,
} satisfies Prisma.VehicleSelect;

export const PUBLIC_LIST_SELECT = {
  ...PUBLIC_FIELDS,
  // Danh sách chỉ cần ảnh bìa (position nhỏ nhất), không tải cả 10 ảnh cho mỗi xe.
  images: { select: { storageKey: true }, orderBy: { position: "asc" }, take: 1 },
} satisfies Prisma.VehicleSelect;

export const PUBLIC_DETAIL_SELECT = {
  ...PUBLIC_FIELDS,
  description: true,
  images: { select: { id: true, storageKey: true, position: true }, orderBy: { position: "asc" } },
  // Chỉ tên hiển thị của chủ xe, không email hay số điện thoại.
  owner: { select: { fullName: true } },
} satisfies Prisma.VehicleSelect;

export type PublicListRow = Prisma.VehicleGetPayload<{ select: typeof PUBLIC_LIST_SELECT }>;
export type PublicDetailRow = Prisma.VehicleGetPayload<{ select: typeof PUBLIC_DETAIL_SELECT }>;

type PublicFields = Omit<PublicListRow, "images">;

export type PublicVehicleListItem = PublicFields & { coverUrl: string | null };
export type PublicVehicleDetail = PublicFields & {
  coverUrl: string | null;
  description: string;
  images: { id: string; url: string; position: number }[];
  owner: { fullName: string };
};
