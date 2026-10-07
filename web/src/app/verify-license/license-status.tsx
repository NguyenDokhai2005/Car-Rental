"use client";

import { Icon } from "@/components/icon";
import { useAuth } from "@/lib/auth/auth-context";

const STATES = {
  verified: { label: "Đã xác minh", tone: "bg-tertiary-fixed/50 text-on-tertiary-fixed-variant", note: "Bạn đã có thể đặt xe." },
  pending: { label: "Đang chờ duyệt", tone: "bg-primary-fixed text-primary", note: "Chúng tôi sẽ xem và trả lời bạn sớm." },
  none: { label: "Chưa xác minh", tone: "bg-warning-container text-warning", note: "Bạn chưa đặt được xe cho tới khi được duyệt." },
} as const;

export function LicenseStatus() {
  const { status, user } = useAuth();
  if (status !== "authenticated") return null;
  const state = user.licenseStatus === "verified" ? STATES.verified : user.licenseStatus === "pending" ? STATES.pending : STATES.none;

  return (
    <div className="flex items-center gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-card">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary">
        <Icon name="badge" filled className="!text-[28px]" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="flex flex-wrap items-center gap-space-sm">
          <span className="text-label-md tracking-wider text-on-surface uppercase">Trạng thái hồ sơ</span>
          <span className={`rounded-full px-space-sm py-0.5 text-label-md ${state.tone}`}>{state.label}</span>
        </p>
        <p className="text-label-md text-on-surface-variant">{state.note}</p>
      </div>
    </div>
  );
}
