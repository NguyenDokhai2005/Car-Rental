import type { VehicleStatus } from "@prisma/client";
import type { OwnerVehicle } from "./vehicle.view";

// Các trường chủ xe được sửa (không gồm status, ownerId, title).
export const EDITABLE_FIELDS = [
  "brand",
  "model",
  "year",
  "plateNumber",
  "seats",
  "transmission",
  "fuel",
  "description",
  "city",
  "district",
  "pricePerDay",
  "depositRate",
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];
export type EditableValues = Pick<OwnerVehicle, EditableField>;

// Đổi một trong các trường này thì xe phải được admin duyệt lại (SPEC §2).
// Mô tả, thành phố, quận thì không.
export const IMPORTANT_FIELDS: ReadonlySet<EditableField> = new Set<EditableField>([
  "plateNumber",
  "brand",
  "model",
  "year",
  "seats",
  "transmission",
  "fuel",
  "pricePerDay",
  "depositRate",
]);

export function buildTitle(vehicle: Pick<OwnerVehicle, "brand" | "model" | "year">): string {
  return `${vehicle.brand} ${vehicle.model} ${vehicle.year}`;
}

// Chỉ giữ những trường có giá trị khác hiện tại. Gửi lại đúng giá trị cũ không tính là thay đổi.
export function diffEditable(current: EditableValues, input: Partial<EditableValues>): Partial<EditableValues> {
  const changes: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    const value = input[field];
    if (value !== undefined && value !== current[field]) changes[field] = value;
  }
  return changes as Partial<EditableValues>;
}

// Trạng thái xe sau khi chủ xe sửa (chỉ gọi khi có ít nhất một thay đổi thật).
export function nextStatusAfterEdit(current: VehicleStatus, changed: EditableField[]): VehicleStatus {
  // Sửa lại xe bị từ chối nghĩa là nộp lại để duyệt.
  if (current === "rejected") return "pending";
  const needsReview = changed.some((field) => IMPORTANT_FIELDS.has(field));
  if ((current === "approved" || current === "hidden") && needsReview) return "pending";
  return current;
}
