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

export type VehicleFilters = { status?: VehicleStatus; q?: string; page?: number };

export function listVehicles(filters: VehicleFilters = {}): Promise<Page<AdminVehicle>> {
  return apiFetch(`/admin/vehicles?${toQuery({ limit: ADMIN_PAGE_SIZE, ...filters })}`);
}

// Gỡ xe đã duyệt hoặc đang ẩn: xe thành "bị từ chối" kèm lý do, chủ xe sửa rồi gửi duyệt lại.
export function takedownVehicle(id: string, reason: string): Promise<AdminVehicle> {
  return apiFetch<AdminVehicle>(`/admin/vehicles/${id}/takedown`, { method: "POST", body: { reason } });
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

export type UserFilters = {
  q?: string;
  role?: Role;
  status?: AuthUser["status"];
  licenseStatus?: AuthUser["licenseStatus"];
  page?: number;
  limit?: number;
};

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

// Khóa phải kèm lý do (API từ chối nếu thiếu); mở khóa thì không cần.
export function setUserBlocked(id: string, blocked: boolean, reason?: string): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${encodeURIComponent(id)}/${blocked ? "block" : "unblock"}`, { method: "POST", body: blocked ? { reason } : undefined });
}

export type AdminActionName = "user.block" | "user.unblock" | "user.reset_password" | "vehicle.takedown" | "booking.cancel";

// Khớp AdminUserDetail của API (api/src/admin/admin-users.service.ts).
export type AdminUserDetail = AdminUser & {
  blockReason: string | null;
  vehicles: { id: string; title: string; plateNumber: string; status: VehicleStatus }[];
  bookings: { id: string; status: BookingStatus; startAt: string; endAt: string; totalAmount: number; vehicleTitle: string }[];
  actions: { action: AdminActionName; reason: string | null; adminName: string; createdAt: string }[];
};

export function getUserDetail(id: string): Promise<AdminUserDetail> {
  return apiFetch(`/admin/users/${encodeURIComponent(id)}`);
}

// Mật khẩu tạm chỉ được trả về đúng một lần này.
export function resetUserPassword(id: string): Promise<{ temporaryPassword: string }> {
  return apiFetch(`/admin/users/${encodeURIComponent(id)}/reset-password`, { method: "POST" });
}

// ---- Đơn thuê và sổ tiền ----

export type AdminBooking = OwnerBooking & { owner: { fullName: string; phone: string } };

export type LedgerTotals = { paidAmount: number; refundAmount: number; ownerPayoutAmount: number; heldAmount: number };

export function listAllBookings(filters: { status?: BookingStatus; page?: number } = {}): Promise<Page<AdminBooking> & { totals: LedgerTotals }> {
  return apiFetch(`/admin/bookings?${toQuery({ limit: ADMIN_PAGE_SIZE, ...filters })}`);
}

// Cách chia tiền khi admin hủy đơn, giống hệt API (api/src/bookings/booking-rules.ts) để xem trước số tiền trước khi bấm.
// API mới là nơi quyết định; đây chỉ là bản xem trước.
export function previewAdminCancel(booking: { paidAt: string | null; totalAmount: number; depositAmount: number }, rentalRefundPercent: number): { refundAmount: number; ownerPayoutAmount: number } {
  if (!booking.paidAt) return { refundAmount: 0, ownerPayoutAmount: 0 };
  const rentalRefund = Math.round((booking.totalAmount * rentalRefundPercent) / 100);
  return { refundAmount: booking.depositAmount + rentalRefund, ownerPayoutAmount: booking.totalAmount - rentalRefund };
}

export function cancelBooking(id: string, reason: string, rentalRefundPercent: number): Promise<AdminBooking> {
  return apiFetch<AdminBooking>(`/admin/bookings/${id}/cancel`, { method: "POST", body: { reason, rentalRefundPercent } });
}

// ---- Tổng quan ----

export type OverviewDay = { date: string; newUsers: number; newVehicles: number; bookingsCreated: number; bookingsPaid: number; bookingsCompleted: number; paidAmount: number };

// Khớp Overview của API (api/src/admin/admin-overview.service.ts). null: không có dữ liệu để tính.
export type Overview = {
  days: number;
  queues: { pendingVehicles: number; pendingLicenses: number; awaitingOwnerApproval: number; inUse: number };
  totals: { users: Partial<Record<Role, number>>; vehicles: Partial<Record<VehicleStatus, number>>; bookings: number } & LedgerTotals;
  series: OverviewDay[];
  performance: {
    created: number;
    paid: number;
    approved: number;
    completed: number;
    cancelled: number;
    rejected: number;
    expired: number;
    avgOwnerResponseHours: number | null;
    avgVehicleReviewHours: number | null;
    avgBookingValue: number | null;
    avgRentalDays: number | null;
    utilizationPercent: number | null;
    topCities: { city: string; bookings: number; paidAmount: number }[];
  };
};

export const OVERVIEW_RANGES = [7, 30, 90] as const;
export type OverviewRange = (typeof OVERVIEW_RANGES)[number];

export function getOverview(days: OverviewRange): Promise<Overview> {
  return apiFetch(`/admin/overview?days=${days}`);
}
