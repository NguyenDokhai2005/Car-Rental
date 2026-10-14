"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/error-message";

const INPUT = "h-11 rounded-xl bg-surface-container-lowest px-space-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/30";

export function ChangePasswordForm() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== String(form.get("confirmPassword") ?? "")) {
      setError("Mật khẩu nhập lại không khớp.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/me/password", { method: "POST", body: { currentPassword, newPassword } });
      // API đã thu hồi mọi phiên đăng nhập của tài khoản, kể cả phiên này: đưa người dùng về trang đăng nhập ngay, thay vì để
      // họ bị văng ra giữa chừng vài phút sau. Tải lại cả trang (không chuyển trang trong ứng dụng) để access token đang giữ
      // trong bộ nhớ bị bỏ đi, và để trang hồ sơ không kịp tự chuyển hướng sang /login?next=... khi thấy phiên đã mất.
      await apiFetch("/auth/logout", { method: "POST", auth: false }).catch(() => undefined);
      window.location.assign("/login?changed=1");
    } catch (e) {
      setError(apiErrorMessage(e));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
      <p className="text-title-lg text-on-surface">Đổi mật khẩu</p>
      <p className="text-body-md text-on-surface-variant">Sau khi đổi, bạn sẽ được đăng xuất ở mọi thiết bị và đăng nhập lại bằng mật khẩu mới.</p>
      <label className="flex flex-col gap-1 text-label-lg text-on-surface">
        Mật khẩu hiện tại
        <input name="currentPassword" type="password" required maxLength={128} autoComplete="current-password" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 text-label-lg text-on-surface">
        Mật khẩu mới (ít nhất 8 ký tự)
        <input name="newPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 text-label-lg text-on-surface">
        Nhập lại mật khẩu mới
        <input name="confirmPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={INPUT} />
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
          {error}
        </p>
      )}
      <button type="submit" disabled={saving} className="h-11 self-end rounded-xl bg-primary px-space-lg text-label-lg text-on-primary disabled:opacity-50">
        {saving ? "Đang đổi..." : "Đổi mật khẩu"}
      </button>
    </form>
  );
}
