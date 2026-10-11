import { createHash } from "node:crypto";

export const LICENSE_CLASSES = ["B1", "B2", "B", "C1", "C", "D1", "D2", "D", "E"] as const;
export type LicenseClass = (typeof LICENSE_CLASSES)[number];

export const LICENSE_NUMBER_PATTERN = /^\d{12}$/;

export const LICENSE_SIDES = ["front", "back"] as const;
export type LicenseSide = (typeof LICENSE_SIDES)[number];

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

// Ngày hôm nay theo giờ Việt Nam, dạng yyyy-mm-dd.
export function vnToday(now: Date = new Date()): string {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

// yyyy-mm-dd có thật (không nhận 2026-02-31) và chưa qua.
export function isValidFutureDate(value: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== value) return false;
  return value >= vnToday(now);
}

// Dấu nhận biết một lần gửi hồ sơ. Key của file là UUID sinh mới mỗi lần gửi, nên băm key là đủ để biết hồ sơ có đổi
// hay không mà không phải để lộ key (đường dẫn file) ra ngoài.
export function licenseVersion(frontKey: string | null, backKey: string | null): string | null {
  if (!frontKey) return null;
  return createHash("sha256").update(`${frontKey}|${backKey ?? ""}`).digest("hex").slice(0, 32);
}
