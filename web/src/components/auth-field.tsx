"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";

export function AuthField({
  label,
  icon,
  aside,
  type = "text",
  ...input
}: {
  label: string;
  icon: string;
  aside?: React.ReactNode; // phần nằm bên phải nhãn, ví dụ liên kết "Quên mật khẩu?"
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">) {
  const [shown, setShown] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-space-sm">
        <label htmlFor={input.name} className="text-label-lg text-on-surface">
          {label}
          {input.required && <span className="text-error"> *</span>}
        </label>
        {aside}
      </div>
      <div className="flex h-12 items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md transition-shadow focus-within:ring-2 focus-within:ring-primary/30">
        <Icon name={icon} className="!text-[20px] text-outline" />
        <input
          id={input.name}
          type={isPassword && shown ? "text" : type}
          {...input}
          className="min-w-0 flex-1 bg-transparent text-body-md text-on-surface outline-none placeholder:text-outline"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            aria-pressed={shown}
            className="flex text-on-surface-variant hover:text-on-surface"
          >
            <Icon name={shown ? "visibility_off" : "visibility"} className="!text-[20px]" />
          </button>
        )}
      </div>
    </div>
  );
}
