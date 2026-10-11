import { apiFetch, apiFetchBlob } from "@/lib/api/client";
import type { AuthUser } from "@/lib/auth/types";

export const LICENSE_CLASSES = ["B1", "B2", "B", "C1", "C", "D1", "D2", "D", "E"] as const;
export const LICENSE_NUMBER_PATTERN = /^\d{12}$/;
export const MAX_LICENSE_IMAGE_BYTES = 5 * 1024 * 1024;
export const LICENSE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type LicenseSide = "front" | "back";

// Khớp LicenseView của API (api/src/licenses/license.view.ts).
export type License = {
  status: AuthUser["licenseStatus"];
  licenseNumber: string | null;
  licenseClass: string | null;
  licenseExpiresOn: string | null; // yyyy-mm-dd
  rejectReason: string | null;
  reviewedAt: string | null;
  hasBack: boolean;
  version: string | null;
};

export type AdminLicense = License & { user: { id: string; fullName: string; email: string; phone: string } };

export type LicenseInput = { licenseNumber: string; licenseClass: string; licenseExpiresOn: string; front: File; back: File | null };

// ---- Khách thuê ----

export function getMyLicense(): Promise<License> {
  return apiFetch<License>("/me/license");
}

export function submitLicense(input: LicenseInput): Promise<License> {
  const form = new FormData();
  form.append("licenseNumber", input.licenseNumber);
  form.append("licenseClass", input.licenseClass);
  form.append("licenseExpiresOn", input.licenseExpiresOn);
  form.append("front", input.front);
  if (input.back) form.append("back", input.back);
  return apiFetch<License>("/me/license", { method: "POST", body: form });
}

export function myLicenseImagePath(side: LicenseSide): string {
  return `/me/license/${side}`;
}

// ---- Admin ----

export function getUserLicense(userId: string): Promise<AdminLicense> {
  return apiFetch<AdminLicense>(`/admin/users/${encodeURIComponent(userId)}/license`);
}

export function userLicenseImagePath(userId: string, side: LicenseSide): string {
  return `/admin/users/${encodeURIComponent(userId)}/license/${side}`;
}

export function verifyLicense(userId: string, version: string): Promise<AdminLicense> {
  return apiFetch<AdminLicense>(`/admin/users/${encodeURIComponent(userId)}/license/verify`, { method: "POST", body: { version } });
}

export function rejectLicense(userId: string, reason: string): Promise<AdminLicense> {
  return apiFetch<AdminLicense>(`/admin/users/${encodeURIComponent(userId)}/license/reject`, { method: "POST", body: { reason } });
}

export function fetchLicenseImage(path: string): Promise<Blob> {
  return apiFetchBlob(path);
}

// ---- Kiểm tra trước khi gửi (API kiểm tra lại; đây chỉ để báo sớm cho người dùng) ----

export function licenseImageProblem(file: File, label: string): string | null {
  if (!LICENSE_IMAGE_TYPES.includes(file.type)) return `${label}: chỉ nhận ảnh JPG, PNG hoặc WebP.`;
  if (file.size > MAX_LICENSE_IMAGE_BYTES) return `${label}: ảnh tối đa 5 MB.`;
  return null;
}

export function licenseFormProblem(input: { licenseNumber: string; licenseExpiresOn: string; front: File | null; back: File | null }, today: string): string | null {
  if (!LICENSE_NUMBER_PATTERN.test(input.licenseNumber.replace(/\s+/g, ""))) return "Số giấy phép lái xe gồm đúng 12 chữ số.";
  if (!input.licenseExpiresOn) return "Hãy chọn ngày hết hạn ghi trên giấy phép.";
  if (input.licenseExpiresOn < today) return "Giấy phép lái xe đã hết hạn nên không dùng để xác minh được.";
  if (!input.front) return "Hãy chọn ảnh mặt trước giấy phép lái xe.";
  return licenseImageProblem(input.front, "Mặt trước") ?? (input.back ? licenseImageProblem(input.back, "Mặt sau") : null);
}

// "2032-10-15" thành "15/10/2032".
export function formatLicenseDate(value: string | null): string {
  return value ? value.split("-").reverse().join("/") : "";
}
