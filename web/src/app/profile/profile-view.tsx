"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { apiErrorMessage } from "@/lib/api/error-message";
import { useAuth } from "@/lib/auth/auth-context";
import type { AuthUser, Role } from "@/lib/auth/types";

const CARD = "rounded-2xl bg-surface-container-lowest p-space-md shadow-sm";
const INPUT =
  "h-12 w-full rounded-xl bg-surface-container-low px-space-md text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/30 disabled:text-on-surface-variant";

const ROLE_LABELS: Record<Role, string> = { renter: "Khách thuê", owner: "Chủ xe", admin: "Quản trị viên" };

const LICENSE: Record<AuthUser["licenseStatus"], { label: string; note: string; tone: string }> = {
  verified: { label: "Đã xác minh", note: "Đã được quản trị viên xác minh. Bạn đặt được xe.", tone: "bg-tertiary-fixed/50 text-on-tertiary-fixed-variant" },
  pending: { label: "Đang chờ duyệt", note: "Quản trị viên đang xem hồ sơ của bạn.", tone: "bg-primary-fixed text-primary" },
  rejected: { label: "Bị từ chối", note: "Hồ sơ chưa đạt. Hãy gửi lại ảnh rõ hơn.", tone: "bg-error-container text-on-error-container" },
  none: { label: "Chưa xác minh", note: "Bạn chưa đặt được xe cho tới khi được xác minh.", tone: "bg-warning-container text-warning" },
};

function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return ((words.length > 1 ? words[0].charAt(0) : "") + words[words.length - 1].charAt(0)).toUpperCase();
}

function joined(iso: string): string {
  const date = new Date(iso);
  return `T${date.getMonth() + 1}/${date.getFullYear()}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-label-lg text-on-surface">{label}</span>
      {children}
    </label>
  );
}

export function ProfileView() {
  const { status, user, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (status !== "authenticated") return null;
  const license = LICENSE[user.licenseStatus];

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile({ fullName: String(form.get("fullName") ?? "").trim(), phone: String(form.get("phone") ?? "").trim() });
      setMessage({ ok: true, text: "Đã cập nhật hồ sơ." });
    } catch (e) {
      setMessage({ ok: false, text: apiErrorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-gutter px-margin-sm py-space-lg lg:px-margin">
      <nav aria-label="Đường dẫn" className="flex items-center gap-1 text-label-md text-on-surface-variant">
        <Link href="/" className="hover:text-primary">
          Trang chủ
        </Link>
        <Icon name="chevron_right" className="!text-[16px]" />
        <span className="text-on-surface">Hồ sơ cá nhân</span>
      </nav>

      <section className={`flex flex-wrap items-center gap-space-md bg-gradient-to-r from-surface-container-lowest to-tertiary-fixed/20 ${CARD} lg:p-space-lg`}>
        <span aria-hidden className="flex size-24 shrink-0 items-center justify-center rounded-2xl bg-primary text-headline-lg text-on-primary">
          {initials(user.fullName)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-space-sm">
          <div className="flex flex-wrap items-center gap-space-sm">
            <h1 className="text-headline-lg text-on-surface">{user.fullName}</h1>
            <span className="rounded-full bg-primary-fixed px-space-sm py-1 text-label-md text-primary">{ROLE_LABELS[user.role]}</span>
            {user.role === "renter" && (
              <span className={`flex items-center gap-1 rounded-full px-space-sm py-1 text-label-md ${license.tone}`}>
                {user.licenseStatus === "verified" && <Icon name="verified" filled className="!text-[14px]" />}
                Giấy phép lái xe: {license.label.toLowerCase()}
              </span>
            )}
          </div>
          <p className="flex flex-wrap items-center gap-x-space-md gap-y-1 text-body-md text-on-surface-variant">
            <span className="flex items-center gap-1">
              <Icon name="mail" className="!text-[18px] text-primary" />
              {user.email}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="smartphone" className="!text-[18px] text-primary" />
              {user.phone}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="calendar_today" className="!text-[18px] text-primary" />
              Gia nhập: {joined(user.createdAt)}
            </span>
          </p>
        </div>
      </section>

      <div className="grid items-start gap-gutter lg:grid-cols-12">
        <form onSubmit={onSubmit} className={`flex flex-col gap-space-md lg:col-span-7 ${CARD} lg:p-space-lg`}>
          <div className="flex flex-col gap-1">
            <h2 className="text-headline-sm text-on-surface">{user.role === "renter" ? "Thông tin người thuê xe" : "Thông tin tài khoản"}</h2>
            <p className="text-body-md text-on-surface-variant">
              {user.role === "owner"
                ? "Khách thấy họ tên của bạn trên trang xe."
                : "Chủ xe thấy họ tên và số điện thoại của bạn khi bạn đặt xe của họ."}
            </p>
          </div>
          <div className="grid gap-space-md sm:grid-cols-2">
            <Field label="Họ và tên đầy đủ *">
              <input name="fullName" defaultValue={user.fullName} required minLength={2} maxLength={100} autoComplete="name" className={INPUT} />
            </Field>
            <Field label="Số điện thoại *">
              <input name="phone" type="tel" defaultValue={user.phone} required autoComplete="tel" className={INPUT} />
            </Field>
          </div>
          <Field label="Địa chỉ hòm thư điện tử (Email)">
            <input value={user.email} disabled readOnly className={INPUT} />
          </Field>
          <p className="text-label-md text-on-surface-variant">Email dùng để đăng nhập nên không đổi được ở đây.</p>

          {message && (
            <p
              role={message.ok ? "status" : "alert"}
              className={`rounded-xl px-space-md py-space-sm text-body-md ${
                message.ok ? "bg-tertiary-fixed/40 text-on-tertiary-fixed-variant" : "bg-error-container text-on-error-container"
              }`}
            >
              {message.text}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-space-md">
            <p className="flex items-center gap-space-sm text-label-md text-on-surface-variant">
              <Icon name="lock" className="!text-[16px] text-tertiary" />
              Thông tin của bạn được lưu riêng tư
            </p>
            <button
              type="submit"
              disabled={saving}
              className="flex h-12 items-center gap-space-sm rounded-xl bg-primary px-space-lg text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container disabled:opacity-50"
            >
              <Icon name="save" className="!text-[18px]" />
              {saving ? "Đang lưu..." : "Cập nhật hồ sơ"}
            </button>
          </div>
        </form>

        <div className="flex flex-col gap-gutter lg:col-span-5">
          {user.role === "renter" && (
            <section className={`flex flex-col gap-space-sm ${CARD}`}>
              <div className="flex items-center justify-between gap-space-sm">
                <h2 className="text-headline-sm text-on-surface">Giấy phép lái xe (GPLX)</h2>
                <span className={`rounded-full px-space-sm py-1 text-label-md ${license.tone}`}>{license.label}</span>
              </div>
              <p className="flex items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md text-body-md text-on-surface-variant">
                <Icon name="badge" className="!text-[20px] text-primary" />
                {license.note}
              </p>
              <Link href="/verify-license" className="flex items-center gap-1 text-label-lg text-primary hover:underline">
                Mở trang xác minh giấy phép
                <Icon name="arrow_forward" className="!text-[18px]" />
              </Link>
            </section>
          )}

          <section className={`flex flex-col gap-space-sm ${CARD}`}>
            <div className="flex items-center justify-between gap-space-sm">
              <h2 className="text-headline-sm text-on-surface">Bảo mật & Đăng nhập</h2>
              <Icon name="verified_user" className="text-primary" />
            </div>
            <div className="flex items-start gap-space-md rounded-xl bg-surface-container-low p-space-md">
              <Icon name="key" className="text-on-surface-variant" />
              <div className="flex flex-col gap-1">
                <p className="text-title-lg text-on-surface">Mật khẩu đăng nhập</p>
                <p className="text-body-md text-on-surface-variant">
                  Mật khẩu được mã hóa và không ai xem được. Chưa đổi được trên trang này; quản trị viên của dự án cấp lại khi bạn cần.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
