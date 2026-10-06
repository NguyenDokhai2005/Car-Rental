"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { StatusPill } from "@/components/status-pill";
import { VehicleImage } from "@/components/vehicle-image";
import { apiErrorMessage } from "@/lib/api/error-message";
import { listMyBookings, renterAction } from "@/lib/bookings/api";
import { Booking, cancelRefund, formatVnDateTime, RenterAction, renterState, RenterTab } from "@/lib/bookings/rules";
import { formatVnd } from "@/lib/cars";

const TABS: { id: RenterTab; label: string }[] = [
  { id: "upcoming", label: "Sắp diễn ra" },
  { id: "active", label: "Đang đi chuyến" },
  { id: "done", label: "Đã hoàn thành" },
  { id: "cancelled", label: "Đã hủy" },
];

const ACTION_ICONS: Record<Exclude<RenterAction, "pay" | "cancel">, string> = { pickup: "task_alt", return: "assignment_turned_in" };

const ACTION_LABELS: Record<Exclude<RenterAction, "pay">, string> = {
  cancel: "Hủy đơn",
  pickup: "Đã nhận xe",
  return: "Đã trả xe",
};

const PRIMARY =
  "flex h-10 items-center gap-space-sm rounded-xl bg-primary px-space-md text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container disabled:opacity-50";
const SECONDARY =
  "flex h-10 items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md text-label-lg text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; items: Booking[] };

export function BookingList() {
  const [tab, setTab] = useState<RenterTab>("upcoming");
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [now, setNow] = useState(() => new Date());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    try {
      const page = await listMyBookings();
      setLoad({ status: "ready", items: page.items });
    } catch (e) {
      setLoad({ status: "error", message: apiErrorMessage(e) });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Nhãn và nút phụ thuộc thời gian (hạn thanh toán, khung giờ nhận xe), nên cập nhật "bây giờ" đều đặn.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  async function run(booking: Booking, action: Exclude<RenterAction, "pay">) {
    setBusyId(booking.id);
    setConfirmCancelId(null);
    setErrors((prev) => ({ ...prev, [booking.id]: "" }));
    try {
      const updated = await renterAction(booking.id, action);
      setLoad((prev) => (prev.status === "ready" ? { status: "ready", items: prev.items.map((b) => (b.id === updated.id ? updated : b)) } : prev));
    } catch (e) {
      setErrors((prev) => ({ ...prev, [booking.id]: apiErrorMessage(e) }));
      // API từ chối thường vì đơn vừa đổi (chủ xe vừa duyệt, đơn vừa hết hạn...): tải lại để hiện đúng.
      void reload();
    } finally {
      setBusyId(null);
    }
  }

  const all = load.status === "ready" ? load.items.map((booking) => ({ booking, state: renterState(booking, now) })) : [];
  const items = all.filter((entry) => entry.state.tab === tab);

  return (
    <>
      <div role="tablist" className="flex flex-wrap gap-space-sm">
        {TABS.map((t) => {
          const selected = t.id === tab;
          const count = all.filter((entry) => entry.state.tab === t.id).length;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(t.id)}
              className={`flex h-10 items-center gap-space-sm rounded-full px-space-md text-label-lg transition-colors ${
                selected ? "bg-on-surface text-surface-container-lowest" : "bg-surface-container-low text-on-surface hover:bg-surface-container"
              }`}
            >
              {t.label}
              <span
                className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-label-sm ${
                  selected ? "bg-surface-container-lowest text-on-surface" : "bg-surface-container-high text-on-surface-variant"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {load.status === "loading" && <p className="text-body-md text-on-surface-variant">Đang tải đơn...</p>}
      {load.status === "error" && (
        <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
          {load.message}
        </p>
      )}
      {load.status === "ready" && items.length === 0 && (
        <div className="flex flex-col items-center gap-space-sm rounded-2xl bg-surface-container-lowest p-space-xl text-center shadow-sm">
          <Icon name="receipt_long" className="!text-[40px] text-outline" />
          <p className="text-body-md text-on-surface-variant">Chưa có đơn nào trong mục này.</p>
          <Link href="/cars" className="text-label-lg text-primary hover:underline">
            Tìm xe để đặt
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-space-md">
        {items.map(({ booking: b, state }) => {
          const busy = busyId === b.id;
          return (
            <article key={b.id} className="flex flex-col gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
              <div className="flex flex-wrap items-center gap-space-sm">
                <span className="rounded-lg bg-surface-container-low px-space-sm py-1 font-mono text-label-md text-on-surface-variant">
                  #{b.id.slice(0, 8).toUpperCase()}
                </span>
                <StatusPill tone={state.tone}>{state.label}</StatusPill>
                <span className="ml-auto flex items-center gap-1 text-label-md text-on-surface-variant">
                  <Icon name="event_note" className="!text-[16px]" />
                  Đặt lúc {formatVnDateTime(b.createdAt)}
                </span>
              </div>

              <div className="flex flex-col gap-space-md md:flex-row md:items-center">
                <Link href={`/cars/${b.vehicle.id}`} className="block h-24 w-full shrink-0 overflow-hidden rounded-xl md:w-36" aria-label={`Xem ${b.vehicle.title}`}>
                  <VehicleImage src={b.vehicle.coverUrl} alt={b.vehicle.title} emptyLabel="" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h2 className="text-headline-sm text-on-surface">{b.vehicle.title}</h2>
                  <p className="flex items-center gap-1 text-label-lg text-on-surface">
                    <Icon name="schedule" className="!text-[16px] text-primary" />
                    {formatVnDateTime(b.startAt)} đến {formatVnDateTime(b.endAt)}
                  </p>
                  <p className="flex items-center gap-1 text-body-md text-on-surface-variant">
                    <Icon name="location_on" className="!text-[16px]" />
                    Nhận xe tại {b.vehicle.district}, {b.vehicle.city} · {b.rentalDays} ngày
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1 rounded-xl bg-surface-container-low px-space-md py-space-sm md:items-end">
                  <p className="text-label-sm tracking-wider text-on-surface-variant uppercase">Thanh toán khi đặt</p>
                  <p className="text-headline-sm text-primary">{formatVnd(b.payableAmount)}</p>
                  <p className="text-label-md text-on-surface-variant">
                    Thuê {formatVnd(b.totalAmount)} + cọc {formatVnd(b.depositAmount)}
                  </p>
                </div>
              </div>

              {state.hint && (
                <p className="flex items-start gap-space-sm rounded-xl bg-surface-container-low px-space-md py-space-sm text-body-md text-on-surface">
                  <Icon name="info" className="mt-0.5 !text-[18px] text-primary" />
                  {state.hint}
                </p>
              )}
              {errors[b.id] && (
                <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
                  {errors[b.id]}
                </p>
              )}

              {confirmCancelId === b.id ? (
                <div className="flex flex-wrap items-center justify-between gap-space-md rounded-xl bg-warning-container px-space-md py-space-sm">
                  <p className="min-w-0 flex-1 text-body-md text-warning">
                    {b.paidAt
                      ? `Hủy đơn này? Nếu hủy ngay bây giờ, bạn được hoàn ${formatVnd(cancelRefund(b, now))} trên ${formatVnd(b.paidAmount)} đã trả.`
                      : "Hủy đơn này? Bạn chưa thanh toán nên không mất khoản nào."}
                  </p>
                  <div className="flex shrink-0 gap-space-sm">
                    <button type="button" onClick={() => run(b, "cancel")} disabled={busy} className={`${SECONDARY} !bg-surface-container-lowest text-error`}>
                      Xác nhận hủy
                    </button>
                    <button type="button" onClick={() => setConfirmCancelId(null)} className={`${SECONDARY} !bg-surface-container-lowest`}>
                      Giữ đơn
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap justify-end gap-space-sm">
                  <Link href={`/bookings/${b.id}`} className={SECONDARY}>
                    <Icon name="visibility" className="!text-[18px]" />
                    Xem chi tiết
                  </Link>
                  {state.actions.map((action) => {
                    if (action === "pay") {
                      return (
                        <Link key={action} href={`/checkout?booking=${b.id}`} className={PRIMARY}>
                          <Icon name="payments" className="!text-[18px]" />
                          Thanh toán
                        </Link>
                      );
                    }
                    if (action === "cancel") {
                      return (
                        <button key={action} type="button" onClick={() => setConfirmCancelId(b.id)} disabled={busy} className={`${SECONDARY} text-error`}>
                          {ACTION_LABELS.cancel}
                        </button>
                      );
                    }
                    return (
                      <button key={action} type="button" onClick={() => run(b, action)} disabled={busy} className={PRIMARY}>
                        <Icon name={ACTION_ICONS[action]} className="!text-[18px]" />
                        {busy ? "Đang gửi..." : ACTION_LABELS[action]}
                      </button>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
