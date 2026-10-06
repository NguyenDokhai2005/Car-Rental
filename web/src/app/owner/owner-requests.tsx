"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { StatusPill } from "@/components/status-pill";
import { VehicleImage } from "@/components/vehicle-image";
import { apiErrorMessage } from "@/lib/api/error-message";
import { listOwnerBookings, ownerAction } from "@/lib/bookings/api";
import { formatVnDateTime, OwnerAction, OwnerBooking, ownerState } from "@/lib/bookings/rules";
import { formatVnd } from "@/lib/cars";

const ACTION_LABELS: Record<OwnerAction, string> = {
  approve: "Chấp nhận đơn",
  reject: "Từ chối",
  handover: "Giao xe",
  receive: "Đã nhận lại xe",
};

const PRIMARY =
  "flex h-11 items-center gap-space-sm rounded-xl bg-primary px-space-md text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container disabled:opacity-50";
const SECONDARY =
  "flex h-11 items-center rounded-xl bg-surface-container-lowest px-space-md text-label-lg text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-50";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; items: OwnerBooking[] };

// Đơn thuê trên các xe của chủ xe. Chỉ gồm đơn khách đã thanh toán (API không trả đơn chưa thanh toán cho chủ xe).
// `onNeedsAction` báo cho trang tổng quan số đơn đang chờ chủ xe làm gì đó.
export function OwnerRequests({ onNeedsAction }: { onNeedsAction?: (count: number) => void }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [now, setNow] = useState(() => new Date());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    try {
      const page = await listOwnerBookings();
      setLoad({ status: "ready", items: page.items });
    } catch (e) {
      setLoad({ status: "error", message: apiErrorMessage(e) });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const entries = load.status === "ready" ? load.items.map((booking) => ({ booking, state: ownerState(booking, now) })) : [];
  // Đơn cần chủ xe làm gì đó đứng trước; trong mỗi nhóm giữ thứ tự của API (mới nhất trước).
  const sorted = [...entries.filter((e) => e.state.needsAction), ...entries.filter((e) => !e.state.needsAction)];
  const needsAction = entries.filter((e) => e.state.needsAction).length;
  const ready = load.status === "ready";

  useEffect(() => {
    if (ready) onNeedsAction?.(needsAction);
  }, [ready, needsAction, onNeedsAction]);

  async function run(booking: OwnerBooking, action: OwnerAction, reason?: string) {
    setBusyId(booking.id);
    setErrors((prev) => ({ ...prev, [booking.id]: "" }));
    try {
      const updated = await ownerAction(booking.id, action, reason);
      setRejecting(null);
      setLoad((prev) => (prev.status === "ready" ? { status: "ready", items: prev.items.map((b) => (b.id === updated.id ? updated : b)) } : prev));
    } catch (e) {
      setErrors((prev) => ({ ...prev, [booking.id]: apiErrorMessage(e) }));
      // API từ chối thường vì đơn vừa đổi (khách vừa hủy, đơn vừa hết hạn...): tải lại để hiện đúng.
      void reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="flex flex-col gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-space-sm">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-space-sm text-headline-md text-on-surface">
            <Icon name="pending_actions" className="text-primary" />
            Đơn thuê{ready ? ` (${String(sorted.length).padStart(2, "0")})` : ""}
          </h2>
          <p className="text-body-md text-on-surface-variant">Khách đã thanh toán đủ. Bạn có 6 giờ để chấp nhận hoặc từ chối.</p>
        </div>
        {needsAction > 0 && (
          <span className="rounded-lg bg-error-container px-space-sm py-1 text-label-md text-on-error-container">{needsAction} đơn cần xử lý</span>
        )}
      </div>

      {load.status === "loading" && <p className="text-body-md text-on-surface-variant">Đang tải đơn thuê...</p>}
      {load.status === "error" && (
        <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
          {load.message}
        </p>
      )}
      {ready && sorted.length === 0 && (
        <p className="rounded-xl bg-surface-container-low px-space-md py-space-lg text-center text-body-md text-on-surface-variant">
          Chưa có đơn nào. Đơn xuất hiện ở đây sau khi khách đặt xe và thanh toán.
        </p>
      )}

      {sorted.map(({ booking: b, state }) => {
        const busy = busyId === b.id;
        const isRejecting = rejecting?.id === b.id;
        return (
          <article
            key={b.id}
            className={`flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md ${state.needsAction ? "ring-2 ring-primary-container" : ""}`}
          >
            <div className="flex flex-col gap-space-md md:flex-row md:items-center">
              <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg">
                <VehicleImage src={b.vehicle.coverUrl} alt={b.vehicle.title} emptyLabel="" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-space-sm">
                  <h3 className="text-title-lg text-on-surface">{b.renter.fullName}</h3>
                  <StatusPill tone={state.tone}>{state.label}</StatusPill>
                </div>
                <p className="text-body-md text-on-surface">
                  {b.vehicle.title} · {b.renter.phone}
                </p>
                <p className="flex flex-wrap items-center gap-x-space-md gap-y-1 text-label-md text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <Icon name="calendar_today" className="!text-[16px]" />
                    {formatVnDateTime(b.startAt)} đến {formatVnDateTime(b.endAt)} ({b.rentalDays} ngày)
                  </span>
                  <span className="text-tertiary">
                    Tiền thuê: {formatVnd(b.totalAmount)} · khách đã cọc {formatVnd(b.depositAmount)}
                  </span>
                </p>
              </div>
              {!isRejecting && state.actions.length > 0 && (
                <div className="flex shrink-0 flex-wrap gap-space-sm">
                  {state.actions.map((action) =>
                    action === "reject" ? (
                      <button key={action} type="button" onClick={() => setRejecting({ id: b.id, reason: "" })} disabled={busy} className={SECONDARY}>
                        {ACTION_LABELS.reject}
                      </button>
                    ) : (
                      <button key={action} type="button" onClick={() => run(b, action)} disabled={busy} className={PRIMARY}>
                        <Icon name="check_circle" className="!text-[18px]" />
                        {busy ? "Đang gửi..." : ACTION_LABELS[action]}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>

            {state.hint && (
              <p className="flex items-start gap-space-sm rounded-lg bg-surface-container-lowest px-space-md py-space-sm text-body-md text-on-surface">
                <Icon name="info" className="mt-0.5 !text-[18px] text-primary" />
                {state.hint}
              </p>
            )}
            {errors[b.id] && (
              <p role="alert" className="rounded-lg bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
                {errors[b.id]}
              </p>
            )}

            {isRejecting && (
              <form
                className="flex flex-col gap-space-sm"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(b, "reject", rejecting.reason.trim());
                }}
              >
                <label className="flex flex-col gap-1.5">
                  <span className="text-label-lg text-on-surface">Lý do từ chối (khách sẽ đọc được)</span>
                  <textarea
                    value={rejecting.reason}
                    onChange={(e) => setRejecting({ id: b.id, reason: e.target.value })}
                    maxLength={500}
                    rows={2}
                    required
                    className="rounded-xl bg-surface-container-lowest px-space-md py-space-sm text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
                <div className="flex justify-end gap-space-sm">
                  <button type="submit" disabled={busy || rejecting.reason.trim() === ""} className={`${SECONDARY} !text-error`}>
                    Xác nhận từ chối
                  </button>
                  <button type="button" onClick={() => setRejecting(null)} className={SECONDARY}>
                    Quay lại
                  </button>
                </div>
              </form>
            )}
          </article>
        );
      })}

      <p className="flex items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md py-space-sm text-body-md text-on-surface-variant">
        <Icon name="lock_clock" className="!text-[20px] text-primary" />
        Mỗi xe chỉ nhận một đơn cho một khoảng thời gian, không bao giờ trùng lịch.
      </p>
    </section>
  );
}
