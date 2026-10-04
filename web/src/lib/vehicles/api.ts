import { apiFetch } from "@/lib/api/client";

export type VehicleStatus = "pending" | "approved" | "rejected" | "hidden";

// Khớp OwnerVehicle của API (api/src/vehicles/vehicle.view.ts), chỉ các trường giao diện dùng.
export type OwnerVehicle = {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  plateNumber: string;
  seats: number;
  city: string;
  district: string;
  pricePerDay: number;
  depositRate: number;
  status: VehicleStatus;
  rejectReason: string | null;
};

export type VehicleImage = { id: string; url: string; position: number };

export type CreateVehicleInput = {
  brand: string;
  model: string;
  year: number;
  plateNumber: string;
  seats: number;
  transmission: "automatic" | "manual";
  fuel: "petrol" | "diesel" | "electric";
  description?: string;
  city: string;
  district: string;
  pricePerDay: number;
  depositRate: number;
};

export const STATUS_LABELS: Record<VehicleStatus, { label: string; tone: "info" | "warning" | "success" }> = {
  pending: { label: "Chờ duyệt", tone: "warning" },
  approved: { label: "Đang hiển thị", tone: "success" },
  rejected: { label: "Bị từ chối", tone: "warning" },
  hidden: { label: "Đang ẩn", tone: "info" },
};

export function createVehicle(input: CreateVehicleInput): Promise<OwnerVehicle> {
  return apiFetch<OwnerVehicle>("/owner/vehicles", { method: "POST", body: input });
}

export function listOwnerVehicles(): Promise<{ items: OwnerVehicle[]; total: number }> {
  return apiFetch("/owner/vehicles?limit=50");
}

export function listVehicleImages(vehicleId: string): Promise<VehicleImage[]> {
  return apiFetch<VehicleImage[]>(`/owner/vehicles/${vehicleId}/images`);
}

export function uploadVehicleImage(vehicleId: string, file: File): Promise<VehicleImage> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<VehicleImage>(`/owner/vehicles/${vehicleId}/images`, { method: "POST", body: form });
}
