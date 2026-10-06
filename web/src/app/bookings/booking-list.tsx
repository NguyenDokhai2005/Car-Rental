"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { apiErrorMessage } from "@/lib/api/error-message";
import { listMyBookings, renterAction } from "@/lib/bookings/api";
import { Booking, cancelRefund, formatVnDateTime, RenterAction, renterState, RenterTab } from "@/lib/bookings/rules";
import { formatVnd } from "@/lib/cars";

const TABS: { id: RenterTab; label: string }[] = [
  { id: "upcoming", label: "Sắp tới" },
  { id: "active", label: "Đang thuê" },
  { id: "done", label: "Hoàn tất" },
  { id: "cancelled", label: "Đã hủy" },
];

const ACTION_LABELS: Record<Exclude<RenterAction, "pay">, string> = {
  cancel: "Hủy đơn",
  pickup: "Đã nhận xe",
  return: "Đã trả xe",
};

const PRIMARY = "flex h-10 items-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50";
const SECONDARY = "flex h-10 items-center rounded-[10px] border border-[#c5d2e3] bg-white px-4 text-sm font-semibold text-ink disabled:opacity-50";

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
      <div role="tablist" className="flex gap-2 border-b border-line">
        {TABS.map((t) => {
          const selected = t.id === tab;
          const count = all.filter((entry) => entry.state.tab === t.id).length;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-5 py-3.5 text-base font-semibold ${
                selected ? "border-primary text-primary" : "border-transparent text-muted"
              }`}
            >
              {t.label}
              {count > 0 ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      {load.status === "loading" && <p className="text-muted">Đang tải đơn...</p>}
      {load.status === "error" && (
        <p role="alert" className="rounded-[10px] bg-red-50 px-3.5 py-3 text-sm text-red-700">
          {load.message}
        </p>
      )}
      {load.status === "ready" && items.length === 0 && (
        <p className="rounded-2xl border border-line bg-white p-8 text-center text-[15px] text-muted">Chưa có đơn nào trong mục này.</p>
      )}

      <div className="flex flex-col gap-6">
        {items.map(({ booking: b, state }) => {
          const busy = busyId === b.id;
          return (
            <article key={b.id} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5">
              <div className="flex items-center gap-5">
                <div className="flex h-[110px] w-40 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-placeholder text-xs font-medium text-primary">
                  {b.vehicle.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được API xử lý (WebP, ≤ 1600 px)
                    <img src={b.vehicle.coverUrl} alt={b.vehicle.title} className="size-full object-cover" />
                  ) : (
                    "Chưa có ảnh"
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-semibold text-ink">{b.vehicle.title}</h2>
                    <StatusPill tone={state.tone}>{state.label}</StatusPill>
                  </div>
                  <p className="text-base font-medium text-ink">
                    {formatVnDateTime(b.startAt)} đến {formatVnDateTime(b.endAt)}
                  </p>
                  <p className="text-sm text-muted">
                    Nhận xe tại {b.vehicle.district}, {b.vehicle.city} · {b.rentalDays} ngày
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p className="text-[22px] font-bold text-primary">{formatVnd(b.payableAmount)}</p>
                  <p className="text-[13px] text-muted">
                    Thuê {formatVnd(b.totalAmount)} + cọc {formatVnd(b.depositAmount)}
                  </p>
                </div>
              </div>

              {state.hint && <p className="rounded-[10px] bg-surface px-3.5 py-2.5 text-sm leading-[22px] text-ink">{state.hint}</p>}
              {errors[b.id] && (
                <p role="alert" className="rounded-[10px] bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                  {errors[b.id]}
                </p>
              )}

              {confirmCancelId === b.id ? (
                <div className="flex items-center justify-between gap-4 rounded-[10px] border border-[#f5c877] bg-[#fff6e5] px-3.5 py-3">
                  <p className="text-sm leading-[22px] text-[#5c3b00]">
                    {b.paidAt
                      ? `Hủy đơn này? Nếu hủy ngay bây giờ, bạn được hoàn ${formatVnd(cancelRefund(b, now))} trên ${formatVnd(b.paidAmount)} đã trả.`
                      : "Hủy đơn này? Bạn chưa thanh toán nên không mất khoản nào."}
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => run(b, "cancel")} disabled={busy} className={`${SECONDARY} text-[#c0281c]`}>
                      Xác nhận hủy
                    </button>
                    <button type="button" onClick={() => setConfirmCancelId(null)} className={SECONDARY}>
                      Giữ đơn
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end gap-2.5">
                  <Link href={`/cars/${b.vehicle.id}`} className={SECONDARY}>
                    Xem xe
                  </Link>
                  {state.actions.map((action) => {
                    if (action === "pay") {
                      return (
                        <Link key={action} href={`/checkout?booking=${b.id}`} className={PRIMARY}>
                          Thanh toán
                        </Link>
                      );
                    }
                    if (action === "cancel") {
                      return (
                        <button key={action} type="button" onClick={() => setConfirmCancelId(b.id)} disabled={busy} className={`${SECONDARY} text-[#c0281c]`}>
                          {ACTION_LABELS.cancel}
                        </button>
                      );
                    }
                    return (
                      <button key={action} type="button" onClick={() => run(b, action)} disabled={busy} className={PRIMARY}>
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
