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

// Mọi thay đổi của chủ xe đều phải được admin duyệt lại (SPEC §2): sửa bất kỳ thông tin nào, tải thêm ảnh hay xóa ảnh.
// Không còn phân biệt trường "quan trọng" và "không quan trọng": mô tả hay ảnh cũng là thứ khách nhìn thấy, nên nếu sửa
// được mà không qua duyệt thì bước duyệt ban đầu mất tác dụng.
//
// Các trạng thái đã có kết quả duyệt. Xe ở một trong các trạng thái này mà bị thay đổi thì về pending và kết quả duyệt cũ
// (lý do từ chối, người duyệt, thời điểm duyệt) bị xóa. Xe đang pending thì không có gì để xóa.
export const REVIEW_RESET_STATUSES: readonly VehicleStatus[] = ["approved", "hidden", "rejected"];

// Dữ liệu ghi vào xe khi nó phải được duyệt lại. Dùng chung cho sửa thông tin và thay đổi ảnh để hai nơi không lệch nhau.
export const BACK_TO_REVIEW = { status: "pending", rejectReason: null, reviewedById: null, reviewedAt: null } as const;

// Xe ở trạng thái này mà bị chủ xe thay đổi thì có phải đưa về pending và xóa kết quả duyệt cũ không.
export function needsReviewReset(current: VehicleStatus): boolean {
  return REVIEW_RESET_STATUSES.includes(current);
}
