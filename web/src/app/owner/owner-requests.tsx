"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { apiErrorMessage } from "@/lib/api/error-message";
import { listOwnerBookings, ownerAction } from "@/lib/bookings/api";
import { formatVnDateTime, OwnerAction, OwnerBooking, ownerState } from "@/lib/bookings/rules";
import { formatVnd } from "@/lib/cars";

const ACTION_LABELS: Record<OwnerAction, string> = {
  approve: "Chấp nhận",
  reject: "Từ chối",
  handover: "Giao xe",
  receive: "Đã nhận lại xe",
};

const PRIMARY = "h-10 rounded-[10px] bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50";
const SECONDARY = "h-10 rounded-[10px] border border-[#c5d2e3] bg-white px-4 text-sm font-semibold text-ink disabled:opacity-50";

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
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold text-ink">Đơn thuê</h2>

      {load.status === "loading" && <p className="text-muted">Đang tải đơn thuê...</p>}
      {load.status === "error" && (
        <p role="alert" className="rounded-[10px] bg-red-50 px-3.5 py-3 text-sm text-red-700">
          {load.message}
        </p>
      )}
      {ready && sorted.length === 0 && (
        <p className="rounded-2xl border border-line bg-white px-6 py-8 text-center text-[15px] text-muted">
          Chưa có đơn nào. Đơn xuất hiện ở đây sau khi khách đặt xe và thanh toán.
        </p>
      )}

      {sorted.map(({ booking: b, state }) => {
        const busy = busyId === b.id;
        const isRejecting = rejecting?.id === b.id;
        return (
          <article
            key={b.id}
            className={`flex flex-col gap-3 rounded-2xl border bg-white p-5 ${state.needsAction ? "border-primary" : "border-line"}`}
          >
            <div className="flex items-start gap-6">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-semibold text-ink">{b.vehicle.title}</h3>
                  <StatusPill tone={state.tone}>{state.label}</StatusPill>
                </div>
                <p className="text-[15px] text-ink">
                  {b.renter.fullName} · {b.renter.phone}
                </p>
                <p className="text-sm text-muted">
                  {formatVnDateTime(b.startAt)} đến {formatVnDateTime(b.endAt)} · {b.rentalDays} ngày
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <p className="text-lg font-bold text-ink">{formatVnd(b.totalAmount)}</p>
                <p className="text-[13px] text-muted">Tiền thuê · khách đã cọc {formatVnd(b.depositAmount)}</p>
              </div>
            </div>

            {state.hint && <p className="rounded-[10px] bg-surface px-3.5 py-2.5 text-sm leading-[22px] text-ink">{state.hint}</p>}
            {errors[b.id] && (
              <p role="alert" className="rounded-[10px] bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {errors[b.id]}
              </p>
            )}

            {isRejecting ? (
              <form
                className="flex flex-col gap-2.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(b, "reject", rejecting.reason.trim());
                }}
              >
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-ink">Lý do từ chối (khách sẽ đọc được)</span>
                  <textarea
                    value={rejecting.reason}
                    onChange={(e) => setRejecting({ id: b.id, reason: e.target.value })}
                    maxLength={500}
                    rows={2}
                    required
                    className="rounded-[10px] border border-[#c5d2e3] bg-white px-3.5 py-2.5 text-[15px] text-ink"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button type="submit" disabled={busy || rejecting.reason.trim() === ""} className={`${SECONDARY} text-[#c0281c]`}>
                    Xác nhận từ chối
                  </button>
                  <button type="button" onClick={() => setRejecting(null)} className={SECONDARY}>
                    Quay lại
                  </button>
                </div>
              </form>
            ) : (
              state.actions.length > 0 && (
                <div className="flex justify-end gap-2">
                  {state.actions.map((action) =>
                    action === "reject" ? (
                      <button key={action} type="button" onClick={() => setRejecting({ id: b.id, reason: "" })} disabled={busy} className={SECONDARY}>
                        {ACTION_LABELS.reject}
                      </button>
                    ) : (
                      <button key={action} type="button" onClick={() => run(b, action)} disabled={busy} className={PRIMARY}>
                        {busy ? "Đang gửi..." : ACTION_LABELS[action]}
                      </button>
                    ),
                  )}
                </div>
              )
            )}
          </article>
        );
      })}
    </section>
  );
}
