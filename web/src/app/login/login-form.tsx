"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { authErrorMessage } from "@/lib/auth/messages";
import { postLoginPath } from "@/lib/auth/redirect";

const INPUT_CLASS =
  "h-[52px] rounded-[10px] border border-[#c5d2e3] px-3.5 text-base placeholder:text-[#8a99ae]";

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
    <form onSubmit={onSubmit} className="flex w-[440px] flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-[34px] font-bold text-ink">Chào mừng trở lại</h1>
        <p className="text-base text-muted">Đăng nhập để đặt xe hoặc quản lý xe của bạn.</p>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="ten@email.com"
          className={INPUT_CLASS}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink">Mật khẩu</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Nhập mật khẩu"
          className={INPUT_CLASS}
        />
      </label>
      <div className="flex justify-end text-sm">
        <Link href="/forgot-password" className="font-semibold text-primary">
          Quên mật khẩu?
        </Link>
      </div>
      {error && (
        <p role="alert" className="rounded-[10px] bg-red-50 px-3.5 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="h-[54px] rounded-xl bg-primary text-base font-semibold text-white disabled:opacity-60"
      >
        {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
      <p className="flex justify-center gap-1.5 text-[15px]">
        <span className="text-muted">Chưa có tài khoản?</span>
        <Link href="/register" className="font-semibold text-primary">
          Đăng ký
        </Link>
      </p>
    </form>
  );
}
