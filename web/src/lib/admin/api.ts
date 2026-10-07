import { apiFetch } from "@/lib/api/client";
import type { AuthUser, Role } from "@/lib/auth/types";
import type { BookingStatus, OwnerBooking } from "@/lib/bookings/rules";
import type { CreateVehicleInput, VehicleImage, VehicleStatus } from "@/lib/vehicles/api";

// Khớp AdminVehicle của API (api/src/admin/admin-vehicle.view.ts).
export type AdminVehicle = {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  plateNumber: string;
  seats: number;
  transmission: CreateVehicleInput["transmission"];
  fuel: CreateVehicleInput["fuel"];
  description: string;
  city: string;
  district: string;
  pricePerDay: number;
  depositRate: number;
  status: VehicleStatus;
  rejectReason: string | null;
  updatedAt: string;
  owner: { id: string; fullName: string; email: string; phone: string };
  images: VehicleImage[];
};

export function listPendingVehicles(): Promise<{ items: AdminVehicle[]; total: number }> {
  return apiFetch("/admin/vehicles?status=pending&limit=50");
}

export function approveVehicle(id: string): Promise<AdminVehicle> {
  return apiFetch<AdminVehicle>(`/admin/vehicles/${id}/approve`, { method: "POST" });
}

export function rejectVehicle(id: string, reason: string): Promise<AdminVehicle> {
  return apiFetch<AdminVehicle>(`/admin/vehicles/${id}/reject`, { method: "POST", body: { reason } });
}

// ---- Người dùng ----

// Khớp AdminUser của API (api/src/admin/admin-user.view.ts).
export type AdminUser = AuthUser & { vehicleCount: number; bookingCount: number };

export type UserFilters = { q?: string; role?: Role; status?: AuthUser["status"]; page?: number; limit?: number };

export type Page<T> = { items: T[]; total: number; page: number; limit: number };

export const ADMIN_PAGE_SIZE = 20;

function toQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return query.toString();
}

export function listUsers(filters: UserFilters = {}): Promise<Page<AdminUser>> {
  return apiFetch(`/admin/users?${toQuery({ limit: ADMIN_PAGE_SIZE, ...filters })}`);
}

export function setUserBlocked(id: string, blocked: boolean): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${encodeURIComponent(id)}/${blocked ? "block" : "unblock"}`, { method: "POST" });
}

// ---- Đơn thuê và sổ tiền ----

export type AdminBooking = OwnerBooking & { owner: { fullName: string; phone: string } };

export type LedgerTotals = { paidAmount: number; refundAmount: number; ownerPayoutAmount: number; heldAmount: number };

export function listAllBookings(filters: { status?: BookingStatus; page?: number } = {}): Promise<Page<AdminBooking> & { totals: LedgerTotals }> {
  return apiFetch(`/admin/bookings?${toQuery({ limit: ADMIN_PAGE_SIZE, ...filters })}`);
}
