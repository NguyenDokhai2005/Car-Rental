import type { Prisma } from "@prisma/client";

// Trường chủ xe được xem trên xe của mình. Không có ownerId, reviewedBy.
export const OWNER_VEHICLE_SELECT = {
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
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VehicleSelect;

export type OwnerVehicle = Prisma.VehicleGetPayload<{ select: typeof OWNER_VEHICLE_SELECT }>;

export type Page<T> = { items: T[]; total: number; page: number; limit: number };

export type BusyPeriod = { startAt: Date; endAt: Date };
export type OwnerBusyPeriod = BusyPeriod & { kind: "booked" | "blocked" };
