"use client";

import { useState } from "react";

type Props = {
  label: string;
  placeholder: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  children?: React.ReactNode;
};

// Ô nhập lý do bắt buộc cho các thao tác can thiệp của quản trị viên (khóa tài khoản, gỡ xe, hủy đơn). Người bị ảnh hưởng
// đọc được lý do này, nên không cho bấm khi còn để trống.
export function ReasonForm({ label, placeholder, confirmLabel, busy, onConfirm, onCancel, children }: Props) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) onConfirm(trimmed);
      }}
      className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md"
    >
      <label className="flex flex-col gap-1 text-label-lg text-on-surface">
        {label}
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          rows={2}
          required
          placeholder={placeholder}
          className="rounded-xl bg-surface-container-lowest px-space-md py-space-sm text-body-md text-on-surface outline-none placeholder:text-outline focus:ring-2 focus:ring-primary/30"
        />
      </label>
      {children}
      <div className="flex flex-wrap justify-end gap-space-sm">
        <button type="button" onClick={onCancel} className="h-10 rounded-xl bg-surface-container-lowest px-space-md text-label-lg text-on-surface">
          Thôi
        </button>
        <button type="submit" disabled={busy || !trimmed} className="h-10 rounded-xl bg-error px-space-md text-label-lg text-on-error disabled:opacity-50">
          {busy ? "Đang xử lý..." : confirmLabel}
        </button>
      </div>
    </form>
  );
}
