"use client";

import Link from "next/link";
import { useState } from "react";

const ROLES = [
  { id: "renter", title: "Thuê xe", note: "Tìm và đặt xe cho chuyến đi" },
  { id: "owner", title: "Cho thuê xe", note: "Đăng xe và nhận đơn" },
];

const FIELDS = [
  { name: "fullName", label: "Họ và tên", type: "text", placeholder: "Nguyễn Văn A", autoComplete: "name" },
  { name: "email", label: "Email", type: "email", placeholder: "ten@email.com", autoComplete: "email" },
  { name: "phone", label: "Số điện thoại", type: "tel", placeholder: "09xx xxx xxx", autoComplete: "tel" },
  { name: "password", label: "Mật khẩu", type: "password", placeholder: "Tối thiểu 8 ký tự", autoComplete: "new-password" },
];

export function RegisterForm() {
  const [role, setRole] = useState("renter");
  const [agreed, setAgreed] = useState(false);

  return (
    <form action="/login" className="flex w-[440px] flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-[34px] font-bold text-ink">Tạo tài khoản</h1>
        <p className="text-base text-muted">
          Bạn có thể vừa thuê xe vừa cho thuê xe cùng một tài khoản.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-ink">Bạn muốn làm gì trước?</legend>
        <div className="flex gap-3">
          {ROLES.map((r) => {
            const selected = role === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                aria-pressed={selected}
                className={`flex min-w-0 flex-1 flex-col gap-1 rounded-xl px-4 py-3.5 text-left ${
                  selected ? "border-2 border-primary bg-primary-50" : "border border-[#c5d2e3] bg-white"
                }`}
              >
                <span className="flex items-center gap-2.5 text-base font-semibold text-ink">
                  <span
                    className={`size-5 shrink-0 rounded-full bg-white ${
                      selected ? "border-[6px] border-primary" : "border-2 border-[#c5d2e3]"
                    }`}
                  />
                  {r.title}
                </span>
                <span className="text-[13px] text-muted">{r.note}</span>
              </button>
            );
          })}
        </div>
        <input type="hidden" name="role" value={role} />
      </fieldset>

      {FIELDS.map((f) => (
        <label key={f.name} className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">{f.label}</span>
          <input
            name={f.name}
            type={f.type}
            placeholder={f.placeholder}
            autoComplete={f.autoComplete}
            required
            minLength={f.name === "password" ? 8 : undefined}
            className="h-[52px] rounded-[10px] border border-[#c5d2e3] bg-white px-3.5 text-base placeholder:text-[#8a99ae]"
          />
        </label>
      ))}

      <label className="flex items-center gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="size-5 shrink-0 accent-primary"
        />
        Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật.
      </label>

      <button
        type="submit"
        disabled={!agreed}
        className="h-[54px] rounded-xl bg-primary text-base font-semibold text-white disabled:opacity-50"
      >
        Đăng ký
      </button>

      <p className="flex justify-center gap-1.5 text-[15px]">
        <span className="text-muted">Đã có tài khoản?</span>
        <Link href="/login" className="font-semibold text-primary">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
