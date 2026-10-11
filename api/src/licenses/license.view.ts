import type { LicenseStatus, Prisma } from "@prisma/client";
import { licenseVersion } from "./license-rules";

export const LICENSE_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  licenseStatus: true,
  licenseNumber: true,
  licenseClass: true,
  licenseExpiresOn: true,
  licenseFrontKey: true,
  licenseBackKey: true,
  licenseRejectReason: true,
  licenseReviewedAt: true,
} satisfies Prisma.UserSelect;

export type LicenseRow = Prisma.UserGetPayload<{ select: typeof LICENSE_SELECT }>;

// Không có key của file: bên ngoài chỉ biết "có mặt sau hay không" và một `version` đã băm.
export type LicenseView = {
  status: LicenseStatus;
  licenseNumber: string | null;
  licenseClass: string | null;
  licenseExpiresOn: string | null;
  rejectReason: string | null;
  reviewedAt: Date | null;
  hasBack: boolean;
  version: string | null;
};

export type AdminLicenseView = LicenseView & { user: { id: string; fullName: string; email: string; phone: string } };

export function toLicenseView(row: LicenseRow): LicenseView {
  return {
    status: row.licenseStatus,
    licenseNumber: row.licenseNumber,
    licenseClass: row.licenseClass,
    licenseExpiresOn: row.licenseExpiresOn ? row.licenseExpiresOn.toISOString().slice(0, 10) : null,
    rejectReason: row.licenseRejectReason,
    reviewedAt: row.licenseReviewedAt,
    hasBack: row.licenseBackKey !== null,
    version: licenseVersion(row.licenseFrontKey, row.licenseBackKey),
  };
}

export function toAdminLicenseView(row: LicenseRow): AdminLicenseView {
  return { ...toLicenseView(row), user: { id: row.id, fullName: row.fullName, email: row.email, phone: row.phone } };
}
