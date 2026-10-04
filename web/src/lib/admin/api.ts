import { apiFetch } from "@/lib/api/client";
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
