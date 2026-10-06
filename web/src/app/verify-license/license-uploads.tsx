"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";

const SIDES = [
  { name: "licenseFront", icon: "credit_card", label: "Mặt trước GPLX", note: "Thấy rõ ảnh chân dung, họ tên và số giấy phép." },
  { name: "licenseBack", icon: "flip", label: "Mặt sau GPLX", note: "Thấy rõ hạng xe và ngày cấp." },
];

export function LicenseUploads() {
  const [files, setFiles] = useState<Record<string, string>>({});

  return (
    <div className="grid gap-space-md sm:grid-cols-2">
      {SIDES.map((side) => {
        const chosen = files[side.name];
        return (
          <div key={side.name} className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between gap-space-sm">
              <span className="flex items-center gap-space-sm text-label-lg text-on-surface">
                <Icon name={side.icon} className="!text-[18px] text-primary" />
                {side.label}
              </span>
              <span
                className={`rounded-full px-space-sm py-0.5 text-label-sm ${
                  chosen ? "bg-tertiary-fixed/50 text-on-tertiary-fixed-variant" : "bg-error-container text-on-error-container"
                }`}
              >
                {chosen ? "Đã chọn ảnh" : "Chưa chọn"}
              </span>
            </div>
            <label className="flex h-44 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl bg-surface-container-low px-space-md text-center transition-colors hover:bg-surface-container">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary-fixed text-primary">
                <Icon name="cloud_upload" />
              </span>
              <span className="text-label-lg text-primary">{chosen ? "Chọn ảnh khác" : "Chọn ảnh để tải lên"}</span>
              <span className="max-w-full truncate text-label-md text-on-surface-variant">{chosen ?? "JPG hoặc PNG"}</span>
              <input
                type="file"
                name={side.name}
                accept="image/jpeg,image/png"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setFiles((prev) => {
                    const next = { ...prev };
                    if (file) next[side.name] = file.name;
                    else delete next[side.name];
                    return next;
                  });
                }}
              />
            </label>
            <p className="flex items-start gap-1 text-label-md text-on-surface-variant">
              <Icon name="info" className="!text-[16px]" />
              {side.note}
            </p>
          </div>
        );
      })}
    </div>
  );
}
