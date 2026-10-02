import type { BookingStatus } from "@prisma/client";

// Các trạng thái đơn đang giữ lịch xe (SPEC §3). Khớp điều kiện WHERE của bookings_no_overlap.
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ["pending", "confirmed", "in_use"];
