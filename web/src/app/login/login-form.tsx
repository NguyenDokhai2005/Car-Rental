"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthField } from "@/components/auth-field";
import { Icon } from "@/components/icon";
import { useAuth } from "@/lib/auth/auth-context";
import { authErrorMessage } from "@/lib/auth/messages";
import { postLoginPath } from "@/lib/auth/redirect";

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(String(form.get("email") ?? "").trim(), String(form.get("password") ?? ""));
      router.replace(postLoginPath(user.role, params.get("next")));
    } catch (e) {
      setError(authErrorMessage(e));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-[448px] flex-col gap-space-md">
      <div className="flex flex-col gap-space-sm">
        <span className="flex w-fit items-center gap-1 rounded-full bg-surface-container-low px-space-sm py-1 text-label-md text-primary">
          <Icon name="lock" className="!text-[14px]" />
          Cổng đăng nhập an toàn
        </span>
        <h1 className="text-headline-lg text-on-surface">Đăng nhập tài khoản</h1>
        <p className="text-body-md text-on-surface-variant">Chào mừng bạn quay lại với AutoRent VN</p>
      </div>

      <AuthField label="Email" icon="alternate_email" name="email" type="email" required autoComplete="email" placeholder="ban@example.com" />
      <AuthField
        label="Mật khẩu"
        icon="key"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        placeholder="Nhập mật khẩu"
        aside={
          <Link href="/forgot-password" className="text-label-md text-primary hover:underline">
            Quên mật khẩu?
          </Link>
        }
      />

      {error && (
        <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex h-[54px] items-center justify-center gap-space-sm rounded-xl bg-primary-container text-title-lg text-on-primary shadow-sm transition-colors hover:bg-primary disabled:opacity-60"
      >
        {submitting ? "Đang đăng nhập..." : "Đăng nhập ngay"}
        {!submitting && <Icon name="arrow_forward" />}
      </button>

      <p className="rounded-xl bg-surface-container-low px-space-md py-space-sm text-center text-body-md text-on-surface-variant">
        Đăng nhập để đặt xe và theo dõi đơn của bạn.
      </p>

      <p className="flex justify-center gap-1.5 text-body-md">
        <span className="text-on-surface-variant">Chưa có tài khoản?</span>
        <Link href="/register" className="font-bold text-primary underline underline-offset-4">
          Đăng ký ngay
        </Link>
      </p>

      <p className="flex items-center justify-center gap-1 text-label-sm text-on-surface-variant">
        <Icon name="shield" filled className="!text-[16px] text-tertiary" />
        Mật khẩu của bạn được mã hóa và không ai xem được.
      </p>
    </form>
  );
}
