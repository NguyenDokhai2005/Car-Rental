"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { ReasonForm } from "@/components/reason-form";
import { AdminActionName, AdminUserDetail, getUserDetail, resetUserPassword, setUserBlocked } from "@/lib/admin/api";
import { apiErrorMessage } from "@/lib/api/error-message";
import { useAuth } from "@/lib/auth/auth-context";
import type { AuthUser, Role } from "@/lib/auth/types";
import { BookingStatus, formatVnDateTime } from "@/lib/bookings/rules";
import { formatVnd } from "@/lib/cars";
import type { VehicleStatus } from "@/lib/vehicles/api";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; user: AdminUserDetail };

const CARD = "flex flex-col gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm";
const ROLE_LABELS: Record<Role, string> = { renter: "Khách thuê", owner: "Chủ xe", admin: "Quản trị viên", dev: "Kỹ thuật viên" };
const LICENSE_LABELS: Record<AuthUser["licenseStatus"], string> = { none: "Chưa gửi", pending: "Chờ duyệt", verified: "Đã xác minh", rejected: "Bị từ chối" };
const VEHICLE_LABELS: Record<VehicleStatus, string> = { pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Bị từ chối", hidden: "Đang ẩn" };
const BOOKING_LABELS: Record<BookingStatus, string> = {
  pending: "Chờ xử lý", confirmed: "Đã xác nhận", in_use: "Đang thuê", completed: "Hoàn tất", rejected: "Chủ xe từ chối", cancelled: "Đã hủy", expired: "Hết hạn",
};
const ACTION_LABELS: Record<AdminActionName, string> = {
  "user.block": "Khóa tài khoản",
  "user.unblock": "Mở khóa tài khoản",
  "user.reset_password": "Đặt lại mật khẩu",
  "vehicle.takedown": "Gỡ xe",
  "booking.cancel": "Hủy đơn",
};

export function AdminUserDetailView({ userId }: { userId: string }) {
  const { user: me } = useAuth();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [blocking, setBlocking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoad({ status: "ready", user: await getUserDetail(userId) });
    } catch (e) {
      setLoad({ status: "error", message: apiErrorMessage(e) });
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setBlocking(false);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
      await reload();
    }
  }

  function onResetPassword() {
    if (!window.confirm("Đặt lại mật khẩu của người này? Mọi phiên đăng nhập của họ sẽ bị đăng xuất.")) return;
    void run(async () => setTemporaryPassword((await resetUserPassword(userId)).temporaryPassword));
  }

  if (load.status === "loading") return <p className="text-body-md text-on-surface-variant">Đang tải thông tin người dùng...</p>;
  if (load.status === "error") {
    return (
      <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
        {load.message}
      </p>
    );
  }

  const user = load.user;
  const blocked = user.status === "blocked";
  // API cũng từ chối các thao tác này lên chính mình hay admin khác; ẩn nút để khỏi mời bấm vào thao tác chắc chắn lỗi.
  const manageable = user.role !== "admin" && user.id !== me?.id;

  return (
    <>
      <Link href="/admin/users" className="flex w-fit items-center gap-1 text-label-lg text-primary hover:underline">
        <Icon name="arrow_back" className="!text-[18px]" />
        Danh sách người dùng
      </Link>

      <section className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-space-md">
          <div className="flex flex-col gap-1">
            <h1 className="text-headline-lg text-on-surface">{user.fullName}</h1>
            <p className="text-body-md text-on-surface-variant">
              {user.email} · {user.phone}
            </p>
            <p className="flex flex-wrap gap-space-sm text-label-md">
              <span className="rounded-full bg-primary-fixed px-space-sm py-1 text-primary">{ROLE_LABELS[user.role]}</span>
              <span className={`rounded-full px-space-sm py-1 ${blocked ? "bg-error-container text-on-error-container" : "bg-tertiary-fixed/40 text-on-tertiary-fixed-variant"}`}>
                {blocked ? "Bị khóa" : "Hoạt động"}
              </span>
              {user.role === "renter" && <span className="rounded-full bg-surface-container-low px-space-sm py-1 text-on-surface">GPLX: {LICENSE_LABELS[user.licenseStatus]}</span>}
              <span className="rounded-full bg-surface-container-low px-space-sm py-1 text-on-surface">Đăng ký {formatVnDateTime(user.createdAt)}</span>
            </p>
          </div>
          {manageable && (
            <div className="flex flex-wrap gap-space-sm">
              <button type="button" disabled={busy} onClick={onResetPassword} className="flex h-10 items-center gap-1 rounded-xl bg-surface-container-low px-space-md text-label-lg text-on-surface disabled:opacity-50">
                <Icon name="key" className="!text-[18px]" />
                Đặt lại mật khẩu
              </button>
              {blocked ? (
                <button type="button" disabled={busy} onClick={() => void run(() => setUserBlocked(userId, false))} className="flex h-10 items-center gap-1 rounded-xl bg-tertiary px-space-md text-label-lg text-on-tertiary disabled:opacity-50">
                  <Icon name="lock_open" className="!text-[18px]" />
                  Mở khóa
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={() => setBlocking(true)} className="flex h-10 items-center gap-1 rounded-xl bg-error px-space-md text-label-lg text-on-error disabled:opacity-50">
                  <Icon name="lock" className="!text-[18px]" />
                  Khóa tài khoản
                </button>
              )}
            </div>
          )}
        </div>

        {blocked && user.blockReason && (
          <p className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">Lý do khóa: {user.blockReason}</p>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
            {error}
          </p>
        )}
        {temporaryPassword && (
          <div role="status" className="flex flex-col gap-1 rounded-xl bg-warning-container px-space-md py-space-sm text-body-md text-warning">
            <span>
              Mật khẩu tạm: <strong className="font-mono text-title-lg">{temporaryPassword}</strong>
            </span>
            <span>Mật khẩu này chỉ hiện một lần. Hãy báo cho người dùng qua điện thoại và nhắc họ đổi lại ngay ở trang hồ sơ.</span>
          </div>
        )}
        {blocking && (
          <ReasonForm
            label="Lý do khóa tài khoản"
            placeholder="Ví dụ: đặt xe rồi không đến nhận nhiều lần"
            confirmLabel="Xác nhận khóa"
            busy={busy}
            onConfirm={(reason) => void run(() => setUserBlocked(userId, true, reason))}
            onCancel={() => setBlocking(false)}
          />
        )}
      </section>

      <div className="grid items-start gap-gutter xl:grid-cols-2">
        {user.role === "owner" && (
          <section className={CARD}>
            <h2 className="text-title-lg text-on-surface">Xe đã đăng ({user.vehicleCount})</h2>
            {user.vehicles.length === 0 ? (
              <p className="text-body-md text-on-surface-variant">Chưa đăng xe nào.</p>
            ) : (
              <ul className="flex flex-col gap-space-sm text-body-md">
                {user.vehicles.map((vehicle) => (
                  <li key={vehicle.id} className="flex items-center justify-between gap-space-sm">
                    <span className="text-on-surface">
                      {vehicle.title} <span className="font-mono text-label-md text-on-surface-variant">{vehicle.plateNumber}</span>
                    </span>
                    <span className="text-label-md text-on-surface-variant">{VEHICLE_LABELS[vehicle.status]}</span>
                  </li>
                ))}
              </ul>
            )}
            {user.vehicleCount > user.vehicles.length && <p className="text-label-md text-outline">Chỉ hiện 10 xe mới nhất.</p>}
          </section>
        )}

        {user.role === "renter" && (
          <section className={CARD}>
            <h2 className="text-title-lg text-on-surface">Đơn đã đặt ({user.bookingCount})</h2>
            {user.bookings.length === 0 ? (
              <p className="text-body-md text-on-surface-variant">Chưa đặt đơn nào.</p>
            ) : (
              <ul className="flex flex-col gap-space-sm text-body-md">
                {user.bookings.map((booking) => (
                  <li key={booking.id} className="flex flex-wrap items-center justify-between gap-space-sm">
                    <span className="flex flex-col">
                      <span className="text-on-surface">{booking.vehicleTitle}</span>
                      <span className="text-label-md text-on-surface-variant">
                        <span className="font-mono">#{booking.id.slice(0, 8).toUpperCase()}</span> · {formatVnDateTime(booking.startAt)}
                      </span>
                    </span>
                    <span className="text-right text-label-md text-on-surface-variant">
                      {formatVnd(booking.totalAmount)}
                      <br />
                      {BOOKING_LABELS[booking.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {user.bookingCount > user.bookings.length && <p className="text-label-md text-outline">Chỉ hiện 10 đơn mới nhất.</p>}
          </section>
        )}

        <section className={CARD}>
          <h2 className="text-title-lg text-on-surface">Lịch sử can thiệp của quản trị viên</h2>
          {user.actions.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">Chưa có thao tác nào lên tài khoản này.</p>
          ) : (
            <ol className="flex flex-col gap-space-sm text-body-md">
              {user.actions.map((entry, index) => (
                <li key={index} className="flex flex-col rounded-xl bg-surface-container-low px-space-md py-space-sm">
                  <span className="text-label-lg text-on-surface">{ACTION_LABELS[entry.action]}</span>
                  {entry.reason && <span className="text-on-surface-variant">Lý do: {entry.reason}</span>}
                  <span className="text-label-md text-outline">
                    {entry.adminName} · {formatVnDateTime(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
