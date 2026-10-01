"use client";

import { useState } from "react";
import { UploadIcon } from "@/components/icons";

const SIDES = [
  { name: "licenseFront", label: "Tải mặt trước" },
  { name: "licenseBack", label: "Tải mặt sau" },
];

export function LicenseUploads() {
  const [files, setFiles] = useState<Record<string, string>>({});

  return (
    <div className="flex gap-5">
      {SIDES.map((side) => (
        <label
          key={side.name}
          className="flex h-[180px] min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#9db6dd] bg-surface text-primary"
        >
          <UploadIcon />
          <span className="text-[15px] font-semibold">{side.label}</span>
          <span className="max-w-full truncate px-4 text-[13px] text-muted">
            {files[side.name] ?? "JPG hoặc PNG"}
          </span>
          <input
            type="file"
            name={side.name}
            accept="image/jpeg,image/png"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setFiles((prev) => ({ ...prev, [side.name]: file?.name ?? "JPG hoặc PNG" }));
            }}
          />
        </label>
      ))}
    </div>
  );
}
