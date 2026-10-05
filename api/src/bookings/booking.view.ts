import type { Prisma } from "@prisma/client";

// Trường của đơn trả cho client. Cố ý KHÔNG có: renterId, cancelledById (người dùng khác không cần biết).
const BOOKING_FIELDS = {
  id: true,
  vehicleId: true,
  startAt: true,
  endAt: true,
  status: true,
  rentalDays: true,
  pricePerDay: true,
  totalAmount: true,
  depositAmount: true,
  expiresAt: true,
  ownerApprovedAt: true,
  rejectReason: true,
  refundAmount: true,
  createdAt: true,
} satisfies Prisma.BookingSelect;

// Tóm tắt xe kèm theo đơn, đủ để hiện một dòng trong danh sách: không có biển số hay thông tin chủ xe.
const VEHICLE_SUMMARY = {
  id: true,
  title: true,
  city: true,
  district: true,
  images: { select: { storageKey: true }, orderBy: { position: "asc" }, take: 1 },
} satisfies Prisma.VehicleSelect;

export const BOOKING_SELECT = {
  ...BOOKING_FIELDS,
  vehicle: { select: VEHICLE_SUMMARY },
} satisfies Prisma.BookingSelect;

// Dùng cho trang chi tiết: cần biết ai là khách và ai là chủ xe để quyết định ai được xem, và thông tin liên hệ khách
// cho chủ xe/admin. renterId và ownerId chỉ dùng nội bộ để kiểm tra quyền, không trả ra ngoài.
export const BOOKING_DETAIL_SELECT = {
  ...BOOKING_FIELDS,
  renterId: true,
  vehicle: { select: { ...VEHICLE_SUMMARY, ownerId: true } },
  renter: { select: { fullName: true, phone: true } },
} satisfies Prisma.BookingSelect;

export type BookingRow = Prisma.BookingGetPayload<{ select: typeof BOOKING_SELECT }>;
export type BookingDetailRow = Prisma.BookingGetPayload<{ select: typeof BOOKING_DETAIL_SELECT }>;

export type BookingVehicle = { id: string; title: string; city: string; district: string; coverUrl: string | null };

export type BookingView = Omit<BookingRow, "vehicle"> & { vehicle: BookingVehicle };
export type BookingDetailView = BookingView & { renter?: { fullName: string; phone: string } };
