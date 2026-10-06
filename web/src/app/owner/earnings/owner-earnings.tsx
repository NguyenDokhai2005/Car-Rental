"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { StatusPill } from "@/components/status-pill";
import { apiErrorMessage } from "@/lib/api/error-message";
import { listOwnerBookings } from "@/lib/bookings/api";
import { EarningsFilter, summarizeEarnings } from "@/lib/bookings/earnings";
import { formatVnDateTime, OwnerBooking, ownerState } from "@/lib/bookings/rules";
import { formatVnd } from "@/lib/cars";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; items: OwnerBooking[] };

const CARD = "rounded-2xl bg-surface-container-lowest p-space-md shadow-sm";

const FILTERS: { id: EarningsFilter; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "received", label: "Đã nhận" },
  { id: "onReturn", label: "Sẽ nhận khi trả xe" },
  { id: "cancelled", label: "Đơn đã kết thúc sớm" },
];

function Stat({ icon, tone, label, value, note }: { icon: string; tone: string; label: string; value: string; note: string }) {
  return (
    <li className={`flex flex-col gap-space-sm ${CARD}`}>
      <div className="flex items-start justify-between gap-space-sm">
        <span className="text-label-lg text-on-surface-variant">{label}</span>
        <span className={`flex size-10 items-center justify-center rounded-xl ${tone}`}>
          <Icon name={icon} />
        </span>
      </div>
      <span className="text-headline-lg text-on-surface">{value}</span>
      <span className="text-label-md text-on-surface-variant">{note}</span>
    </li>
  );
}

export function OwnerEarnings() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [filter, setFilter] = useState<EarningsFilter>("all");
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    listOwnerBookings()
      .then((page) => !cancelled && setLoad({ status: "ready", items: page.items }))
      .catch((e) => !cancelled && setLoad({ status: "error", message: apiErrorMessage(e) }));
    return () => {
      cancelled = true;
    };
  }, []);

  const items = load.status === "ready" ? load.items : null;
  const summary = useMemo(() => summarizeEarnings(items ?? []), [items]);
  const money = (value: number) => (items ? formatVnd(value) : "–");
  const rows = summary.rows.filter((row) => filter === "all" || row.filter === filter);
  const count = (id: EarningsFilter) => (id === "all" ? summary.rows.length : summary.rows.filter((row) => row.filter === id).length);

  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-gutter px-margin-sm py-space-lg lg:px-margin">
      <div className="flex flex-col gap-space-sm">
        <span className="flex w-fit items-center gap-space-sm rounded-full bg-tertiary-fixed/40 px-space-md py-1 text-label-md tracking-wider text-on-tertiary-fixed-variant uppercase">
          <i aria-hidden className="size-2 rounded-full bg-tertiary" />
          Ghi nhận tự động theo từng đơn
        </span>
        <h1 className="text-headline-lg text-on-surface">Thu nhập & Lịch sử nhận tiền</h1>
        <p className="max-w-2xl text-body-md text-on-surface-variant">
          Theo dõi tiền thuê bạn đã nhận và sẽ nhận theo từng đơn. Bạn nhận 50% khi giao xe và 50% còn lại khi trả xe.
        </p>
      </div>

      {load.status === "error" && (
        <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
          {load.message}
        </p>
      )}

      <ul className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon="payments"
          tone="bg-tertiary-fixed/50 text-tertiary"
          label="Tiền thuê đã nhận"
          value={money(summary.received)}
          note="Đã ghi nhận sau khi hai bên xác nhận."
        />
        <Stat
          icon="hourglass_top"
          tone="bg-primary-fixed text-primary"
          label="Sẽ nhận khi trả xe"
          value={money(summary.onReturn)}
          note={`${summary.activeTrips} chuyến đang thuê`}
        />
        <Stat
          icon="event_upcoming"
          tone="bg-primary-fixed text-primary"
          label="Đơn đã duyệt, chưa giao xe"
          value={money(summary.upcoming)}
          note="Ước tính, đơn còn có thể bị hủy."
        />
        <Stat icon="receipt" tone="bg-primary-fixed text-primary" label="Phí nền tảng" value={formatVnd(0)} note="Không thu phí trong giai đoạn thử nghiệm." />
      </ul>

      <div className="grid items-start gap-gutter lg:grid-cols-12">
        <section className={`flex flex-col gap-space-md lg:col-span-8 ${CARD}`}>
          <div className="flex flex-wrap gap-space-sm">
            {FILTERS.map((f) => {
              const selected = f.id === filter;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFilter(f.id)}
                  className={`h-9 rounded-full px-space-md text-label-lg transition-colors ${
                    selected ? "bg-on-surface text-surface-container-lowest" : "bg-surface-container-low text-on-surface hover:bg-surface-container"
                  }`}
                >
                  {f.label} ({count(f.id)})
                </button>
              );
            })}
          </div>

          {load.status === "loading" && <p className="text-body-md text-on-surface-variant">Đang tải dữ liệu...</p>}
          {items && rows.length === 0 && (
            <p className="rounded-xl bg-surface-container-low px-space-md py-space-lg text-center text-body-md text-on-surface-variant">
              Chưa có đơn nào trong mục này.
            </p>
          )}

          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-body-md">
                <thead>
                  <tr className="bg-surface-container-low text-label-md tracking-wider text-on-surface-variant uppercase">
                    <th scope="col" className="rounded-l-lg px-space-sm py-space-sm font-semibold">Mã đơn & thời gian</th>
                    <th scope="col" className="px-space-sm py-space-sm font-semibold">Khách hàng</th>
                    <th scope="col" className="px-space-sm py-space-sm font-semibold">Xe & kỳ hạn</th>
                    <th scope="col" className="px-space-sm py-space-sm text-right font-semibold">Tiền thuê của đơn</th>
                    <th scope="col" className="px-space-sm py-space-sm text-right font-semibold">Đã nhận</th>
                    <th scope="col" className="rounded-r-lg px-space-sm py-space-sm font-semibold">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ booking: b, received, remaining }) => {
                    const state = ownerState(b, now);
                    return (
                      <tr key={b.id} className="align-top">
                        <td className="px-space-sm py-space-md">
                          <span className="block font-mono text-label-lg text-on-surface">#{b.id.slice(0, 8).toUpperCase()}</span>
                          <span className="text-label-md text-on-surface-variant">{formatVnDateTime(b.createdAt)}</span>
                        </td>
                        <td className="px-space-sm py-space-md">
                          <span className="block text-label-lg text-on-surface">{b.renter.fullName}</span>
                          <span className="text-label-md text-on-surface-variant">{b.renter.phone}</span>
                        </td>
                        <td className="px-space-sm py-space-md">
                          <span className="block text-label-lg text-on-surface">{b.vehicle.title}</span>
                          <span className="text-label-md text-on-surface-variant">
                            {b.rentalDays} ngày, từ {formatVnDateTime(b.startAt)}
                          </span>
                        </td>
                        <td className="px-space-sm py-space-md text-right text-on-surface">{formatVnd(b.totalAmount)}</td>
                        <td className="px-space-sm py-space-md text-right">
                          <span className={`block text-label-lg ${received > 0 ? "text-primary" : "text-on-surface-variant"}`}>
                            {received > 0 ? `+${formatVnd(received)}` : formatVnd(0)}
                          </span>
                          {remaining > 0 && <span className="text-label-md text-on-surface-variant">còn {formatVnd(remaining)}</span>}
                        </td>
                        <td className="px-space-sm py-space-md">
                          <StatusPill tone={state.tone}>{state.label}</StatusPill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="flex items-start gap-space-sm rounded-xl bg-surface-container-low px-space-md py-space-sm text-body-md text-on-surface-variant">
            <Icon name="info" className="!text-[20px] text-primary" />
            Mỗi khoản được ghi nhận ngay khi cả hai bên xác nhận giao xe hoặc trả xe. Đây là sổ theo dõi, chưa chuyển khoản thật.
          </p>
        </section>

        <section className={`flex flex-col gap-space-md lg:col-span-4 ${CARD}`}>
          <div className="flex items-center justify-between gap-space-sm">
            <h2 className="text-headline-sm text-on-surface">Hiệu suất xe cho thuê</h2>
            <span className="text-label-md text-on-surface-variant">{summary.vehicles.length} xe có thu</span>
          </div>
          {summary.vehicles.length === 0 ? (
            <p className="rounded-xl bg-surface-container-low p-space-md text-body-md text-on-surface-variant">
              Chưa xe nào có khoản thu. Số liệu xuất hiện sau lần giao xe đầu tiên.
            </p>
          ) : (
            <ul className="flex flex-col gap-space-sm">
              {summary.vehicles.map((v) => (
                <li key={v.vehicleId} className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
                  <div className="flex items-center justify-between gap-space-sm">
                    <span className="text-label-lg text-on-surface">{v.title}</span>
                    <span className="text-label-lg text-primary">{v.percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-container-high" role="presentation">
                    <div className="h-full rounded-full bg-primary-container" style={{ width: `${v.percent}%` }} />
                  </div>
                  <div className="flex items-center justify-between gap-space-sm text-label-md text-on-surface-variant">
                    <span>{v.trips} đơn có thu</span>
                    <span>{formatVnd(v.received)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
