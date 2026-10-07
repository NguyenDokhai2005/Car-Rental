"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { Pager } from "@/components/pager";
import { StatusPill } from "@/components/status-pill";
import { ADMIN_PAGE_SIZE, AdminBooking, LedgerTotals, listAllBookings, Page } from "@/lib/admin/api";
import { apiErrorMessage } from "@/lib/api/error-message";
import { BookingStatus, formatVnDateTime, Tone } from "@/lib/bookings/rules";
import { formatVnd } from "@/lib/cars";

type Result = Page<AdminBooking> & { totals: LedgerTotals };
type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; result: Result };

const CARD = "rounded-2xl bg-surface-container-lowest p-space-md shadow-sm";

const STATUSES: Record<BookingStatus, { label: string; tone: Tone }> = {
  pending: { label: "Chờ xử lý", tone: "warning" },
  confirmed: { label: "Đã xác nhận", tone: "success" },
  in_use: { label: "Đang thuê", tone: "info" },
  completed: { label: "Hoàn tất", tone: "success" },
  rejected: { label: "Chủ xe từ chối", tone: "warning" },
  cancelled: { label: "Đã hủy", tone: "warning" },
  expired: { label: "Hết hạn", tone: "warning" },
};

const FILTERS: { id: BookingStatus | "all"; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "pending", label: "Chờ xử lý" },
  { id: "confirmed", label: "Đã xác nhận" },
  { id: "in_use", label: "Đang thuê" },
  { id: "completed", label: "Hoàn tất" },
  { id: "cancelled", label: "Đã hủy" },
  { id: "rejected", label: "Bị từ chối" },
  { id: "expired", label: "Hết hạn" },
];

function Ledger({ icon, tone, label, value, note }: { icon: string; tone: string; label: string; value: string; note: string }) {
  return (
    <li className={`flex flex-col gap-space-sm ${CARD}`}>
      <div className="flex items-start justify-between gap-space-sm">
        <span className="text-label-md tracking-wider text-on-surface-variant uppercase">{label}</span>
        <span className={`flex size-10 items-center justify-center rounded-xl ${tone}`}>
          <Icon name={icon} />
        </span>
      </div>
      <span className="text-headline-md text-on-surface">{value}</span>
      <span className="text-label-md text-on-surface-variant">{note}</span>
    </li>
  );
}

export function AdminBookings() {
  const [status, setStatus] = useState<BookingStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [load, setLoad] = useState<Load>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    listAllBookings({ status: status === "all" ? undefined : status, page })
      .then((result) => !cancelled && setLoad({ status: "ready", result }))
      .catch((e) => !cancelled && setLoad({ status: "error", message: apiErrorMessage(e) }));
    return () => {
      cancelled = true;
    };
  }, [status, page]);

  const result = load.status === "ready" ? load.result : null;
  const money = (value: number | undefined) => (value === undefined ? "–" : formatVnd(value));

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">Quản lý đơn & Sổ tiền</h1>
        <p className="text-body-md text-on-surface-variant">Mọi đơn thuê trên nền tảng và dòng tiền đang được giữ hộ, đã hoàn, đã ghi nhận cho chủ xe.</p>
      </div>

      <ul className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-4">
        <Ledger icon="payments" tone="bg-primary-fixed text-primary" label="Khách đã thanh toán" value={money(result?.totals.paidAmount)} note="Tiền thuê và tiền cọc của mọi đơn." />
        <Ledger icon="account_balance" tone="bg-tertiary-fixed/50 text-tertiary" label="Đang giữ hộ" value={money(result?.totals.heldAmount)} note="Đã thu, chưa hoàn và chưa ghi nhận cho chủ xe." />
        <Ledger icon="key" tone="bg-primary-fixed text-primary" label="Đã ghi nhận cho chủ xe" value={money(result?.totals.ownerPayoutAmount)} note="50% khi giao xe, phần còn lại khi trả xe." />
        <Ledger icon="undo" tone="bg-warning-container text-warning" label="Đã hoàn cho khách" value={money(result?.totals.refundAmount)} note="Tiền cọc và tiền hoàn khi hủy, từ chối." />
      </ul>

      <section className={`flex flex-col gap-space-md ${CARD}`}>
        <div className="flex flex-wrap gap-space-sm">
          {FILTERS.map((f) => {
            const selected = f.id === status;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setStatus(f.id);
                  setPage(1);
                }}
                className={`h-9 rounded-full px-space-md text-label-lg transition-colors ${
                  selected ? "bg-on-surface text-surface-container-lowest" : "bg-surface-container-low text-on-surface hover:bg-surface-container"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {load.status === "loading" && <p className="text-body-md text-on-surface-variant">Đang tải danh sách đơn...</p>}
        {load.status === "error" && (
          <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
            {load.message}
          </p>
        )}
        {result && result.items.length === 0 && (
          <p className="rounded-xl bg-surface-container-low px-space-md py-space-lg text-center text-body-md text-on-surface-variant">Không có đơn nào trong mục này.</p>
        )}

        {result && result.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-body-md">
              <thead>
                <tr className="bg-surface-container-low text-label-md tracking-wider text-on-surface-variant uppercase">
                  <th scope="col" className="rounded-l-lg px-space-sm py-space-sm font-semibold">Mã đơn</th>
                  <th scope="col" className="px-space-sm py-space-sm font-semibold">Khách thuê</th>
                  <th scope="col" className="px-space-sm py-space-sm font-semibold">Xe & chủ xe</th>
                  <th scope="col" className="px-space-sm py-space-sm font-semibold">Thời gian thuê</th>
                  <th scope="col" className="px-space-sm py-space-sm text-right font-semibold">Khách trả</th>
                  <th scope="col" className="px-space-sm py-space-sm text-right font-semibold">Chủ xe nhận</th>
                  <th scope="col" className="px-space-sm py-space-sm text-right font-semibold">Hoàn khách</th>
                  <th scope="col" className="rounded-r-lg px-space-sm py-space-sm font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((b) => (
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
                        {b.owner.fullName} · {b.owner.phone}
                      </span>
                    </td>
                    <td className="px-space-sm py-space-md">
                      <span className="block text-on-surface">{formatVnDateTime(b.startAt)}</span>
                      <span className="text-label-md text-on-surface-variant">
                        đến {formatVnDateTime(b.endAt)} · {b.rentalDays} ngày
                      </span>
                    </td>
                    <td className="px-space-sm py-space-md text-right">
                      <span className="block text-label-lg text-on-surface">{formatVnd(b.paidAmount)}</span>
                      {!b.paidAt && <span className="text-label-md text-outline">chưa thanh toán</span>}
                    </td>
                    <td className="px-space-sm py-space-md text-right text-primary">{formatVnd(b.ownerPayoutAmount)}</td>
                    <td className="px-space-sm py-space-md text-right text-on-surface">{formatVnd(b.refundAmount)}</td>
                    <td className="px-space-sm py-space-md">
                      <StatusPill tone={STATUSES[b.status].tone}>{STATUSES[b.status].label}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result && <Pager page={result.page} total={result.total} pageSize={ADMIN_PAGE_SIZE} unit="đơn" onPage={setPage} />}
      </section>

      <p className={`flex items-start gap-space-sm text-body-md text-on-surface-variant ${CARD}`}>
        <Icon name="info" className="!text-[20px] text-primary" />
        Sổ tiền cộng trên toàn bộ đơn, không theo bộ lọc đang chọn. Đây là sổ theo dõi của giai đoạn thử nghiệm, chưa có chuyển khoản thật.
      </p>
    </>
  );
}
