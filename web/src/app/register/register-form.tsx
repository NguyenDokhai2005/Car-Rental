"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthField } from "@/components/auth-field";
import { Icon } from "@/components/icon";
import { useAuth } from "@/lib/auth/auth-context";
import { authErrorMessage } from "@/lib/auth/messages";
import { postLoginPath } from "@/lib/auth/redirect";

const ROLES = [
  { id: "renter", icon: "directions_car", title: "Khách thuê xe" },
  { id: "owner", icon: "key", title: "Chủ xe cho thuê" },
] as const;

const MIN_PASSWORD = 8;

export function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<"renter" | "owner">("renter");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !agreed) return;
    const form = new FormData(event.currentTarget);
    const field = (name: string) => String(form.get(name) ?? "");
    if (field("password") !== field("confirmPassword")) {
      setError("Hai ô mật khẩu chưa giống nhau.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const user = await register({
        fullName: field("fullName").trim(),
        email: field("email").trim(),
        phone: field("phone").trim(),
        password: field("password"),
        role,
      });
      router.replace(postLoginPath(user.role, null));
    } catch (e) {
      setError(authErrorMessage(e));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-space-md">
      <div className="flex flex-wrap items-end justify-between gap-space-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-lg text-on-surface">Tạo tài khoản AutoRent</h1>
          <p className="text-body-md text-on-surface-variant">Đăng ký chỉ mất chưa đầy 2 phút</p>
        </div>
        <p className="flex gap-1.5 text-body-md">
          <span className="text-on-surface-variant">Đã có tài khoản?</span>
          <Link href="/login" className="font-bold text-primary hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>

      <fieldset>
        <legend className="sr-only">Bạn đăng ký với vai trò nào?</legend>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-container-low p-1">
          {ROLES.map((r) => {
            const selected = role === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                aria-pressed={selected}
                className={`flex h-10 items-center justify-center gap-space-sm rounded-lg text-label-lg transition-colors ${
                  selected ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <Icon name={r.icon} className="!text-[18px]" />
                {r.title}
              </button>
            );
          })}
        </div>
        <p className="mt-space-sm text-label-md text-on-surface-variant">
          Mỗi tài khoản có một vai trò. Muốn dùng cả hai, hãy đăng ký thêm tài khoản bằng email khác.
        </p>
      </fieldset>

      <div className="grid gap-space-md sm:grid-cols-2">
        <AuthField label="Họ và tên đầy đủ" icon="person" name="fullName" required autoComplete="name" placeholder="Nguyễn Văn An" />
        <AuthField label="Số điện thoại" icon="call" name="phone" type="tel" required autoComplete="tel" placeholder="0912 839 291" />
      </div>
      <AuthField label="Địa chỉ Email" icon="mail" name="email" type="email" required autoComplete="email" placeholder="nguyenvanan@gmail.com" />
      <div className="grid gap-space-md sm:grid-cols-2">
        <AuthField
          label="Mật khẩu"
          icon="lock"
          name="password"
          type="password"
          required
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
          placeholder={`Tối thiểu ${MIN_PASSWORD} ký tự`}
        />
        <AuthField
          label="Xác nhận mật khẩu"
          icon="verified_user"
          name="confirmPassword"
          type="password"
          required
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu"
        />
      </div>

      <label className="flex items-start gap-space-sm text-body-md text-on-surface-variant">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 size-4 shrink-0 accent-primary"
        />
        <span>
          Tôi đồng ý với{" "}
          <Link href="/terms" className="font-semibold text-primary hover:underline">
            Điều khoản dịch vụ
          </Link>{" "}
          và{" "}
          <Link href="/terms#huy-don" className="font-semibold text-primary hover:underline">
            Chính sách hủy, hoàn tiền
          </Link>{" "}
          của AutoRent VN.<span className="text-error"> *</span>
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!agreed || submitting}
        className="flex h-12 items-center justify-center gap-space-sm rounded-xl bg-primary text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container disabled:opacity-50"
      >
        {submitting ? "Đang tạo tài khoản..." : "Đăng ký tài khoản"}
        {!submitting && <Icon name="arrow_forward" className="!text-[18px]" />}
      </button>

      <p className="flex items-center justify-center gap-1 text-label-sm text-on-surface-variant">
        <Icon name="verified_user" className="!text-[16px] text-tertiary" />
        Mật khẩu của bạn được mã hóa và không ai xem được.
      </p>
    </form>
  );
}
