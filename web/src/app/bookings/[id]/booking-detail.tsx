"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { StatusPill } from "@/components/status-pill";
import { VehicleImage } from "@/components/vehicle-image";
import { apiErrorMessage } from "@/lib/api/error-message";
import { getBooking, renterAction } from "@/lib/bookings/api";
import {
  Booking,
  cancelRefund,
  effectiveStatus,
  formatRemaining,
  formatVnDateTime,
  payoutSplit,
  RenterAction,
  renterState,
} from "@/lib/bookings/rules";
import { formatVnd } from "@/lib/cars";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; booking: Booking };
type StepState = "done" | "active" | "todo";

const CARD = "rounded-2xl bg-surface-container-lowest p-space-md shadow-sm";
const PRIMARY =
  "flex h-11 items-center gap-space-sm rounded-xl bg-primary px-space-md text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container disabled:opacity-50";
const SECONDARY =
  "flex h-11 items-center gap-space-sm rounded-xl bg-surface-container-lowest px-space-md text-label-lg text-on-surface shadow-sm transition-colors hover:bg-surface-container-low disabled:opacity-50";

const ACTIONS: Record<Exclude<RenterAction, "pay" | "cancel">, { icon: string; label: string }> = {
  pickup: { icon: "task_alt", label: "Đã nhận xe" },
  return: { icon: "assignment_turned_in", label: "Đã trả xe" },
};

function Milestone({ icon, title, when, note, state }: { icon: string; title: string; when: string; note: string; state: StepState }) {
  const dot =
    state === "done" ? "bg-tertiary text-on-tertiary" : state === "active" ? "bg-primary-container text-on-primary" : "bg-surface-container-high text-outline";
  return (
    <li className="group relative flex gap-space-md pb-space-md last:pb-0">
      <span aria-hidden className="absolute top-7 bottom-0 left-3 w-0.5 bg-surface-container-high group-last:hidden" />
      <span className={`relative flex size-6 shrink-0 items-center justify-center rounded-full ${dot}`}>
        <Icon name={state === "done" ? "check" : icon} className="!text-[14px]" />
      </span>
      <div className={`flex min-w-0 flex-1 flex-col gap-1 rounded-xl p-space-md ${state === "active" ? "bg-surface-container-lowest shadow-sm ring-1 ring-primary-fixed" : "bg-surface-container-low"}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-space-sm">
          <h3 className={`text-title-lg ${state === "active" ? "text-primary" : "text-on-surface"}`}>{title}</h3>
          <span className={`text-label-md ${state === "done" ? "text-tertiary" : state === "active" ? "text-primary" : "text-on-surface-variant"}`}>{when}</span>
        </div>
        <p className="text-body-md text-on-surface-variant">{note}</p>
      </div>
    </li>
  );
}

function MoneyRow({ icon, label, note, amount, tone = "bg-surface-container-low" }: { icon: string; label: string; note: string; amount: number; tone?: string }) {
  return (
    <div className={`flex flex-col gap-1 rounded-xl p-space-md ${tone}`}>
      <div className="flex items-center justify-between gap-space-sm">
        <span className="flex items-center gap-space-sm text-label-lg text-on-surface">
          <Icon name={icon} className="!text-[18px] text-primary" />
          {label}
        </span>
        <span className="text-title-lg text-primary">{formatVnd(amount)}</span>
      </div>
      <p className="text-label-md text-on-surface-variant">{note}</p>
    </div>
  );
}

export function BookingDetail({ bookingId }: { bookingId: string }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoad({ status: "ready", booking: await getBooking(bookingId) });
    } catch (e) {
      setLoad({ status: "error", message: apiErrorMessage(e) });
    }
  }, [bookingId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  async function run(action: Exclude<RenterAction, "pay">) {
    setBusy(true);
    setConfirmCancel(false);
    setError(null);
    try {
      setLoad({ status: "ready", booking: await renterAction(bookingId, action) });
    } catch (e) {
      setError(apiErrorMessage(e));
      // API từ chối thường vì đơn vừa đổi (chủ xe vừa duyệt, đơn vừa hết hạn...): tải lại để hiện đúng.
      void reload();
    } finally {
      setBusy(false);
    }
  }

  if (load.status !== "ready") {
    return (
      <main className="mx-auto flex w-full max-w-page flex-col items-center gap-space-md px-margin-sm py-space-xl text-center lg:px-margin">
        {load.status === "loading" ? (
          <p className="text-body-md text-on-surface-variant">Đang tải đơn...</p>
        ) : (
          <>
            <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
              {load.message}
            </p>
            <Link href="/bookings" className="text-label-lg text-primary hover:underline">
              Về Đơn của tôi
            </Link>
          </>
        )}
      </main>
    );
  }

  const b = load.booking;
  const state = renterState(b, now);
  const status = effectiveStatus(b, now);
  const code = b.id.slice(0, 8).toUpperCase();
  const split = payoutSplit(b.totalAmount);
  const untilStart = Date.parse(b.startAt) - now.getTime();
  const closed = status === "cancelled" || status === "rejected" || status === "expired";

  const paid: StepState = b.paidAt ? "done" : closed ? "todo" : "active";
  const approved: StepState = b.ownerApprovedAt ? "done" : b.paidAt && !closed ? "active" : "todo";
  const pickedUp: StepState = b.startedAt ? "done" : status === "confirmed" ? "active" : "todo";
  const returned: StepState = status === "completed" ? "done" : status === "in_use" ? "active" : "todo";

  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-gutter px-margin-sm py-space-lg lg:px-margin">
      <div className="flex flex-wrap items-center justify-between gap-space-md">
        <nav aria-label="Đường dẫn" className="flex items-center gap-1 text-label-md text-on-surface-variant">
          <Icon name="chevron_left" className="!text-[16px]" />
          <Link href="/bookings" className="hover:text-primary">
            Đơn của tôi
          </Link>
          <span>/</span>
          <span className="text-on-surface">Chi tiết đơn #{code}</span>
        </nav>
        <div className="flex flex-wrap gap-space-sm">
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
                <button key={action} type="button" onClick={() => setConfirmCancel(true)} disabled={busy} className={SECONDARY}>
                  <Icon name="cancel" className="!text-[18px]" />
                  Hủy đơn
                </button>
              );
            }
            return (
              <button key={action} type="button" onClick={() => run(action)} disabled={busy} className={PRIMARY}>
                <Icon name={ACTIONS[action].icon} className="!text-[18px]" />
                {busy ? "Đang gửi..." : ACTIONS[action].label}
              </button>
            );
          })}
        </div>
      </div>

      {confirmCancel && (
        <div className="flex flex-wrap items-center justify-between gap-space-md rounded-xl bg-warning-container px-space-md py-space-sm">
          <p className="min-w-0 flex-1 text-body-md text-warning">
            {b.paidAt
              ? `Hủy đơn này? Nếu hủy ngay bây giờ, bạn được hoàn ${formatVnd(cancelRefund(b, now))} trên ${formatVnd(b.paidAmount)} đã trả.`
              : "Hủy đơn này? Bạn chưa thanh toán nên không mất khoản nào."}
          </p>
          <div className="flex shrink-0 gap-space-sm">
            <button type="button" onClick={() => run("cancel")} disabled={busy} className={`${SECONDARY} text-error`}>
              Xác nhận hủy
            </button>
            <button type="button" onClick={() => setConfirmCancel(false)} className={SECONDARY}>
              Giữ đơn
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
          {error}
        </p>
      )}

      <section className={`flex flex-wrap items-center justify-between gap-space-md ${CARD} lg:p-space-lg`}>
        <div className="flex min-w-0 flex-col gap-space-sm">
          <div className="flex flex-wrap items-center gap-space-sm">
            <h1 className="text-headline-lg text-on-surface">Đơn thuê xe #{code}</h1>
            <StatusPill tone={state.tone}>{state.label}</StatusPill>
          </div>
          {state.hint && <p className="text-body-md text-on-surface-variant">{state.hint}</p>}
        </div>
        {status === "confirmed" && untilStart > 0 && (
          <div className="flex items-center gap-space-md rounded-2xl bg-surface-container-low p-space-md">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary text-on-primary">
              <Icon name="timer" />
            </span>
            <span className="flex flex-col">
              <span className="text-label-sm tracking-wider text-on-surface-variant uppercase">Thời gian tới giờ nhận xe</span>
              <span className="text-headline-sm text-primary">{formatRemaining(untilStart)}</span>
            </span>
          </div>
        )}
      </section>

      <div className="grid items-start gap-gutter lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-gutter lg:col-span-8">
          <section className={`flex flex-col gap-space-md ${CARD}`}>
            <div className="flex flex-col gap-1">
              <p className="text-label-md tracking-wider text-primary uppercase">Quy trình tự lái minh bạch</p>
              <h2 className="text-headline-md text-on-surface">Hành trình & Tiến trình chuyến đi</h2>
            </div>
            <ol className="flex flex-col">
              <Milestone
                icon="payments"
                state={paid}
                title={b.paidAt ? "Đã thanh toán" : "Thanh toán"}
                when={b.paidAt ? `Hoàn tất lúc ${formatVnDateTime(b.paidAt)}` : "Trong 15 phút sau khi đặt"}
                note={`Tiền thuê và tiền cọc, tổng ${formatVnd(b.payableAmount)}.`}
              />
              <Milestone
                icon="how_to_reg"
                state={approved}
                title="Chủ xe duyệt đơn"
                when={b.ownerApprovedAt ? `Đã duyệt lúc ${formatVnDateTime(b.ownerApprovedAt)}` : "Tối đa 6 giờ"}
                note="Chủ xe từ chối hoặc không trả lời thì bạn được hoàn toàn bộ."
              />
              <Milestone
                icon="key"
                state={pickedUp}
                title="Giao xe"
                when={b.startedAt ? `Bắt đầu lúc ${formatVnDateTime(b.startedAt)}` : formatVnDateTime(b.startAt)}
                note="Chủ xe bấm Giao xe, bạn bấm Đã nhận xe. Chuyến đi bắt đầu khi đủ cả hai. Mang theo giấy phép lái xe bản gốc."
              />
              <Milestone
                icon="fact_check"
                state={returned}
                title="Trả xe"
                when={b.completedAt ? `Hoàn tất lúc ${formatVnDateTime(b.completedAt)}` : formatVnDateTime(b.endAt)}
                note={`Bạn bấm Đã trả xe, chủ xe bấm Đã nhận lại xe. Sau đó bạn nhận lại ${formatVnd(b.depositAmount)} tiền cọc.`}
              />
            </ol>
          </section>

          <section className={`flex flex-col gap-space-md ${CARD}`}>
            <h2 className="text-headline-md text-on-surface">Thông tin xe & Điểm hẹn bàn giao</h2>
            <div className="flex flex-col gap-space-md sm:flex-row sm:items-center">
              <Link href={`/cars/${b.vehicle.id}`} className="block h-40 w-full shrink-0 overflow-hidden rounded-xl sm:w-64" aria-label={`Xem ${b.vehicle.title}`}>
                <VehicleImage src={b.vehicle.coverUrl} alt={b.vehicle.title} emptyLabel="Chưa có ảnh" />
              </Link>
              <div className="flex min-w-0 flex-col gap-space-sm">
                <h3 className="text-headline-sm text-on-surface">{b.vehicle.title}</h3>
                <p className="flex items-center gap-1 text-body-md text-on-surface-variant">
                  <Icon name="location_on" className="!text-[18px] text-primary" />
                  {b.vehicle.district}, {b.vehicle.city}
                </p>
                <Link href={`/cars/${b.vehicle.id}`} className="text-label-lg text-primary hover:underline">
                  Xem trang xe
                </Link>
              </div>
            </div>
            <div className="grid gap-space-md rounded-xl bg-surface-container-low p-space-md sm:grid-cols-2">
              <div className="flex items-start gap-space-sm">
                <Icon name="login" className="text-primary" />
                <span className="flex flex-col">
                  <span className="text-label-sm tracking-wider text-on-surface-variant uppercase">Nhận xe</span>
                  <span className="text-title-lg text-on-surface">{formatVnDateTime(b.startAt)}</span>
                </span>
              </div>
              <div className="flex items-start gap-space-sm">
                <Icon name="logout" className="text-primary" />
                <span className="flex flex-col">
                  <span className="text-label-sm tracking-wider text-on-surface-variant uppercase">Trả xe</span>
                  <span className="text-title-lg text-on-surface">{formatVnDateTime(b.endAt)}</span>
                </span>
              </div>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-gutter lg:sticky lg:top-24 lg:col-span-4">
          <section className={`flex flex-col gap-space-sm ${CARD}`}>
            <h2 className="text-headline-sm text-on-surface">Chi tiết thanh toán</h2>
            <div className="flex justify-between gap-space-sm text-body-md">
              <span className="text-on-surface-variant">
                Tiền thuê xe ({formatVnd(b.pricePerDay)} × {b.rentalDays} ngày)
              </span>
              <span className="font-semibold text-on-surface">{formatVnd(b.totalAmount)}</span>
            </div>
            <div className="flex justify-between gap-space-sm text-body-md">
              <span className="text-on-surface-variant">Tiền cọc (hoàn khi trả xe)</span>
              <span className="font-semibold text-on-surface">{formatVnd(b.depositAmount)}</span>
            </div>
            <div className="flex items-center justify-between gap-space-sm rounded-xl bg-surface-container-low p-space-md">
              <span className="text-title-lg text-on-surface">{b.paidAt ? "Đã thanh toán:" : "Cần thanh toán:"}</span>
              <span className="text-headline-sm text-primary">{formatVnd(b.paidAt ? b.paidAmount : b.payableAmount)}</span>
            </div>
            {b.refundAmount > 0 && (
              <MoneyRow icon="undo" label="Đã hoàn cho bạn" note="Số tiền hoàn theo chính sách hủy và hoàn tiền." amount={b.refundAmount} tone="bg-tertiary-fixed/40" />
            )}

            {!closed && (
              <>
                <p className="mt-space-sm text-label-md tracking-wider text-on-surface uppercase">Phân bổ tiến trình dòng tiền</p>
                <MoneyRow icon="payments" label="Chủ xe nhận khi giao xe" note="Ghi nhận khi cả hai bên xác nhận giao xe." amount={split.atPickup} />
                <MoneyRow icon="payments" label="Chủ xe nhận khi trả xe" note="Ghi nhận khi cả hai bên xác nhận trả xe." amount={split.atReturn} />
                <MoneyRow
                  icon="verified"
                  label="Hoàn cho bạn khi trả xe"
                  note="Tiền cọc được hoàn đầy đủ. Không cần thế chấp tài sản."
                  amount={b.depositAmount}
                  tone="bg-tertiary-fixed/40"
                />
              </>
            )}
          </section>

          <section className={`flex flex-col gap-space-sm ${CARD}`}>
            <p className="flex items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md text-body-md text-on-surface-variant">
              <Icon name="verified_user" className="!text-[20px] text-tertiary" />
              Nếu chủ xe không giao xe, bạn hủy đơn và được hoàn theo chính sách.
            </p>
            <Link href="/terms#huy-don" className="flex items-center justify-center gap-1 text-label-lg text-primary hover:underline">
              Xem chính sách hủy và hoàn tiền
              <Icon name="arrow_forward" className="!text-[18px]" />
            </Link>
          </section>
        </aside>
      </div>
    </main>
  );
}
