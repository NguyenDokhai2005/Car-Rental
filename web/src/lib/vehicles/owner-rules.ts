import type { CreateVehicleInput, OwnerVehicle } from "./api";

// Các trường chủ xe được sửa (khớp EDITABLE_FIELDS của API, api/src/vehicles/vehicle-rules.ts).
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
] as const satisfies readonly (keyof CreateVehicleInput)[];

export type EditableField = (typeof EDITABLE_FIELDS)[number];

export const FIELD_LABELS: Record<EditableField, string> = {
  brand: "hãng xe",
  model: "mẫu xe",
  year: "năm sản xuất",
  plateNumber: "biển số",
  seats: "số chỗ",
  transmission: "hộp số",
  fuel: "nhiên liệu",
  description: "mô tả",
  city: "thành phố",
  district: "quận hoặc huyện",
  pricePerDay: "giá thuê",
  depositRate: "tỷ lệ cọc",
};

function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Chỉ giữ trường có giá trị khác hiện tại. Biển số so sánh theo dạng chuẩn ("51k-123.45" và "51K12345" là một).
export function changedFields(
  current: Pick<OwnerVehicle, EditableField>,
  input: Partial<CreateVehicleInput>,
): Partial<CreateVehicleInput> {
  const changes: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    const value = input[field];
    if (value === undefined) continue;
    const before = current[field];
    const same = field === "plateNumber" ? normalizePlate(String(value)) === before : value === before;
    if (!same) changes[field] = value;
  }
  return changes as Partial<CreateVehicleInput>;
}

// Mọi thay đổi của chủ xe đều phải được admin duyệt lại (SPEC §2), không phân biệt trường nào. Hàm này trả về các trường
// đã đổi sẽ khiến xe rời trạng thái hiện tại để về "Chờ duyệt": tất cả, trừ khi xe vốn đang chờ duyệt.
// API là nơi quyết định thật sự; bản sao này chỉ để cảnh báo trước khi người dùng bấm lưu.
export function reviewTriggers(status: OwnerVehicle["status"], changed: EditableField[]): EditableField[] {
  return status === "pending" ? [] : changed;
}

// Thêm hoặc xóa ảnh trên xe ở trạng thái này có đưa xe về "Chờ duyệt" không. Dùng để hỏi xác nhận trước khi đổi ảnh.
export function photoChangeNeedsReview(status: OwnerVehicle["status"]): boolean {
  return status !== "pending";
}

const VN = "+07:00";
const DAY_MS = 24 * 60 * 60 * 1000;

function dayAfter(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
}

// Chặn theo ngày nguyên: từ 00:00 ngày bắt đầu đến hết ngày kết thúc (tức 00:00 ngày kế tiếp), giờ Việt Nam.
export function dayRangeToBlock(startDate: string, endDate: string): { startAt: string; endAt: string } | null {
  const valid = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
  if (!valid(startDate) || !valid(endDate) || endDate < startDate) return null;
  return { startAt: `${startDate}T00:00:00${VN}`, endAt: `${dayAfter(endDate)}T00:00:00${VN}` };
}

// Hiển thị một khoảng chặn theo ngày Việt Nam: [start, end) với end là 00:00 thì ngày cuối là ngày trước đó.
export function describeBlock(startAt: string, endAt: string): string {
  const fmt = (ms: number) =>
    new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(ms));
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  const endsAtMidnight = new Date(end + 7 * 60 * 60 * 1000).getUTCHours() === 0 && new Date(end + 7 * 60 * 60 * 1000).getUTCMinutes() === 0;
  const lastDay = endsAtMidnight ? end - 1 : end;
  const a = fmt(start);
  const b = fmt(lastDay);
  return a === b ? a : `${a} đến ${b}`;
}
