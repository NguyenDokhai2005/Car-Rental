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

export { FUEL_LABELS, TRANSMISSION_LABELS } from "./labels";

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

export type VehicleBlock = { id: string; startAt: string; endAt: string; reason: string | null };
export type CalendarBusy = { startAt: string; endAt: string; kind: "booked" | "blocked" };

export function getOwnerVehicle(id: string): Promise<OwnerVehicle> {
  return apiFetch<OwnerVehicle>(`/owner/vehicles/${id}`);
}

export function updateVehicle(id: string, patch: Partial<CreateVehicleInput>): Promise<OwnerVehicle> {
  return apiFetch<OwnerVehicle>(`/owner/vehicles/${id}`, { method: "PATCH", body: patch });
}

export function setVehicleHidden(id: string, hidden: boolean): Promise<OwnerVehicle> {
  return apiFetch<OwnerVehicle>(`/owner/vehicles/${id}/hide`, { method: "POST", body: { hidden } });
}

export function deleteVehicleImage(vehicleId: string, imageId: string): Promise<void> {
  return apiFetch<void>(`/owner/vehicles/${vehicleId}/images/${imageId}`, { method: "DELETE" });
}

export function listBlocks(vehicleId: string): Promise<VehicleBlock[]> {
  return apiFetch<VehicleBlock[]>(`/owner/vehicles/${vehicleId}/blocks`);
}

export function createBlock(
  vehicleId: string,
  block: { startAt: string; endAt: string; reason?: string },
): Promise<VehicleBlock> {
  return apiFetch<VehicleBlock>(`/owner/vehicles/${vehicleId}/blocks`, { method: "POST", body: block });
}

export function deleteBlock(vehicleId: string, blockId: string): Promise<void> {
  return apiFetch<void>(`/owner/vehicles/${vehicleId}/blocks/${blockId}`, { method: "DELETE" });
}

export function getOwnerCalendar(vehicleId: string, month: string): Promise<{ month: string; busy: CalendarBusy[] }> {
  return apiFetch(`/owner/vehicles/${vehicleId}/calendar?month=${month}`);
}
