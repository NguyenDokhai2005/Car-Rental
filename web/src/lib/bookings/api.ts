import { apiFetch } from "@/lib/api/client";
import type { Booking, OwnerAction, OwnerBooking, RenterAction } from "./rules";

type Page<T> = { items: T[]; total: number; page: number; limit: number };

// ---- Khách thuê ----

export function createBooking(input: { vehicleId: string; startAt: string; endAt: string }): Promise<Booking> {
  return apiFetch<Booking>("/bookings", { method: "POST", body: input });
}

export function listMyBookings(): Promise<Page<Booking>> {
  return apiFetch<Page<Booking>>("/bookings?limit=50");
}

export function getBooking(id: string): Promise<Booking> {
  return apiFetch<Booking>(`/bookings/${encodeURIComponent(id)}`);
}

// Tên hành động của khách trùng với đoạn cuối của đường dẫn API: POST /bookings/:id/pay|cancel|pickup|return.
export function renterAction(id: string, action: RenterAction): Promise<Booking> {
  return apiFetch<Booking>(`/bookings/${encodeURIComponent(id)}/${action}`, { method: "POST" });
}

// ---- Chủ xe ----

export function listOwnerBookings(): Promise<Page<OwnerBooking>> {
  return apiFetch<Page<OwnerBooking>>("/owner/bookings?limit=50");
}

// POST /owner/bookings/:id/approve|reject|handover|receive. Chỉ "reject" cần lý do.
export function ownerAction(id: string, action: OwnerAction, reason?: string): Promise<OwnerBooking> {
  return apiFetch<OwnerBooking>(`/owner/bookings/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    body: action === "reject" ? { reason } : undefined,
  });
}
