"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { LineChart } from "@/components/line-chart";
import { getOverview, Overview, OVERVIEW_RANGES, OverviewRange } from "@/lib/admin/api";
import { apiErrorMessage } from "@/lib/api/error-message";
import { formatVnd } from "@/lib/cars";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: Overview };

const CARD = "rounded-2xl bg-surface-container-lowest p-space-md shadow-sm";
const COLOR = { blue: "var(--color-primary)", green: "var(--color-tertiary)", amber: "#d97706" };
const number = (value: number) => value.toLocaleString("vi-VN");
const orDash = (value: number | null, unit: string) => (value === null ? "–" : `${number(value)} ${unit}`);
// "2026-10-13" -> "13/10"
const dayLabel = (date: string) => date.slice(8, 10) + "/" + date.slice(5, 7);
const share = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

function Queue({ href, icon, label, value, note }: { href: string; icon: string; label: string; value: number; note: string }) {
  const waiting = value > 0;
  return (
    <li>
      <Link href={href} className={`flex h-full flex-col gap-space-sm transition-shadow hover:shadow-md ${CARD}`}>
        <span className="flex items-center justify-between gap-space-sm">
          <span className="text-label-md tracking-wider text-on-surface-variant uppercase">{label}</span>
          <span className={`flex size-10 items-center justify-center rounded-xl ${waiting ? "bg-warning-container text-warning" : "bg-tertiary-fixed/40 text-tertiary"}`}>
            <Icon name={icon} />
          </span>
        </span>
        <span className="text-headline-lg text-on-surface">{number(value)}</span>
        <span className="text-label-md text-on-surface-variant">{note}</span>
      </Link>
    </li>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <li className={`flex flex-col gap-1 ${CARD}`}>
      <span className="text-label-md tracking-wider text-on-surface-variant uppercase">{label}</span>
      <span className="text-headline-md text-on-surface">{value}</span>
      <span className="text-label-md text-on-surface-variant">{note}</span>
    </li>
  );
}

function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = steps[0].value;
  return (
    <ol className="flex flex-col gap-space-sm">
      {steps.map((step, index) => {
        const percent = share(step.value, top);
        const fromPrevious = index > 0 ? share(step.value, steps[index - 1].value) : null;
        return (
          <li key={step.label} className="flex flex-col gap-1">
            <div className="flex justify-between text-body-md">
              <span className="text-on-surface">{step.label}</span>
              <span className="text-on-surface-variant">
                <strong className="text-on-surface">{number(step.value)}</strong>
                {percent !== null && ` · ${percent}% số đơn tạo`}
                {fromPrevious !== null && ` · ${fromPrevious}% so với bước trước`}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-container">
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent ?? 0}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function AdminOverview() {
  const [days, setDays] = useState<OverviewRange>(30);
  const [load, setLoad] = useState<Load>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getOverview(days)
      .then((data) => !cancelled && setLoad({ status: "ready", data }))
      .catch((e) => !cancelled && setLoad({ status: "error", message: apiErrorMessage(e) }));
    return () => {
      cancelled = true;
    };
  }, [days]);

  const data = load.status === "ready" ? load.data : null;
  const dates = data?.series.map((day) => day.date) ?? [];
  const sum = (read: (day: Overview["series"][number]) => number) => data?.series.reduce((total, day) => total + read(day), 0) ?? 0;
  const empty = "Chưa đủ dữ liệu để vẽ biểu đồ.";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-lg text-on-surface">Tổng quan</h1>
          <p className="text-body-md text-on-surface-variant">Việc đang chờ xử lý, sản lượng và hiệu năng vận hành của nền tảng. Ngày tính theo giờ Việt Nam.</p>
        </div>
        <div role="group" aria-label="Khoảng thời gian" className="flex gap-space-sm">
          {OVERVIEW_RANGES.map((range) => (
            <button
              key={range}
              type="button"
              aria-pressed={range === days}
              onClick={() => setDays(range)}
              className={`h-9 rounded-full px-space-md text-label-lg transition-colors ${
                range === days ? "bg-on-surface text-surface-container-lowest" : "bg-surface-container-lowest text-on-surface hover:bg-surface-container"
              }`}
            >
              {range} ngày
            </button>
          ))}
        </div>
      </div>

      {load.status === "loading" && <p className="text-body-md text-on-surface-variant">Đang tải số liệu...</p>}
      {load.status === "error" && (
        <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
          {load.message}
        </p>
      )}

      {data && (
        <>
          <section className="flex flex-col gap-space-md">
            <h2 className="text-headline-sm text-on-surface">Việc đang chờ</h2>
            <ul className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-4">
              <Queue href="/admin" icon="garage" label="Xe chờ duyệt" value={data.queues.pendingVehicles} note="Chủ xe đang chờ bạn duyệt để xe hiện công khai." />
              <Queue href="/admin/licenses" icon="badge" label="GPLX chờ duyệt" value={data.queues.pendingLicenses} note="Khách chưa đặt được xe cho tới khi được duyệt." />
              <Queue href="/admin/bookings" icon="hourglass_top" label="Đơn chờ chủ xe duyệt" value={data.queues.awaitingOwnerApproval} note="Khách đã thanh toán; chủ xe có 6 giờ để trả lời." />
              <Queue href="/admin/bookings" icon="key" label="Đơn đang thuê" value={data.queues.inUse} note="Xe đang ở chỗ khách; nơi dễ phát sinh tranh chấp." />
            </ul>
          </section>

          <section className="flex flex-col gap-space-md">
            <h2 className="text-headline-sm text-on-surface">Sản lượng {data.days} ngày qua</h2>
            <ul className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Đơn được tạo" value={number(data.performance.created)} note={`${number(sum((d) => d.bookingsCompleted))} đơn hoàn tất trong khoảng này.`} />
              <Metric label="Khách đã thanh toán" value={formatVnd(sum((d) => d.paidAmount))} note="Tiền thuê và tiền cọc, tính theo ngày thanh toán." />
              <Metric label="Người dùng mới" value={number(sum((d) => d.newUsers))} note="Khách thuê và chủ xe đăng ký mới." />
              <Metric label="Xe đăng mới" value={number(sum((d) => d.newVehicles))} note="Gồm cả xe còn chờ duyệt." />
            </ul>
            <div className="grid gap-gutter xl:grid-cols-2">
              <LineChart
                title="Đơn thuê theo ngày"
                hint="Tạo: khách bấm đặt. Thanh toán: khách đã trả tiền. Hoàn tất: đã trả xe xong."
                unit="đơn"
                times={dates}
                formatTime={dayLabel}
                emptyText={empty}
                series={[
                  { label: "Tạo", color: COLOR.blue, values: data.series.map((d) => d.bookingsCreated) },
                  { label: "Thanh toán", color: COLOR.amber, values: data.series.map((d) => d.bookingsPaid) },
                  { label: "Hoàn tất", color: COLOR.green, values: data.series.map((d) => d.bookingsCompleted) },
                ]}
              />
              <LineChart
                title="Tiền khách thanh toán theo ngày"
                hint="Tổng tiền thuê và tiền cọc khách trả trong ngày. Đây là số ghi nhận, chưa có tiền thật."
                unit="triệu ₫"
                times={dates}
                formatTime={dayLabel}
                emptyText={empty}
                series={[{ label: "Thanh toán", color: COLOR.green, values: data.series.map((d) => Math.round(d.paidAmount / 100_000) / 10) }]}
              />
              <LineChart
                title="Người dùng và xe mới"
                hint="Số tài khoản đăng ký và số xe được đăng mỗi ngày."
                unit=""
                times={dates}
                formatTime={dayLabel}
                emptyText={empty}
                series={[
                  { label: "Người dùng", color: COLOR.blue, values: data.series.map((d) => d.newUsers) },
                  { label: "Xe", color: COLOR.green, values: data.series.map((d) => d.newVehicles) },
                ]}
              />
              <section className={`flex flex-col gap-space-md ${CARD}`}>
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-title-lg text-on-surface">Thành phố nhiều đơn nhất</h3>
                  <p className="text-label-md text-on-surface-variant">Theo số đơn tạo trong khoảng đã chọn.</p>
                </div>
                {data.performance.topCities.length === 0 ? (
                  <p className="text-body-md text-on-surface-variant">Chưa có đơn nào trong khoảng này.</p>
                ) : (
                  <table className="w-full text-left text-body-md">
                    <thead>
                      <tr className="bg-surface-container-low text-label-md tracking-wider text-on-surface-variant uppercase">
                        <th scope="col" className="rounded-l-lg px-space-sm py-space-sm font-semibold">Thành phố</th>
                        <th scope="col" className="px-space-sm py-space-sm text-right font-semibold">Số đơn</th>
                        <th scope="col" className="rounded-r-lg px-space-sm py-space-sm text-right font-semibold">Khách đã trả</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.performance.topCities.map((city) => (
                        <tr key={city.city}>
                          <td className="px-space-sm py-1.5 text-on-surface">{city.city}</td>
                          <td className="px-space-sm py-1.5 text-right text-on-surface">{number(city.bookings)}</td>
                          <td className="px-space-sm py-1.5 text-right text-on-surface-variant">{formatVnd(city.paidAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </div>
          </section>

          <section className="flex flex-col gap-space-md">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-headline-sm text-on-surface">Hiệu năng vận hành</h2>
              <p className="text-label-md text-on-surface-variant">Tính trên các đơn tạo trong {data.days} ngày qua. Dấu gạch ngang nghĩa là chưa có dữ liệu để tính.</p>
            </div>
            <div className="grid items-start gap-gutter xl:grid-cols-2">
              <section className={`flex flex-col gap-space-md ${CARD}`}>
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-title-lg text-on-surface">Phễu đơn thuê</h3>
                  <p className="text-label-md text-on-surface-variant">Đơn rơi nhiều ở bước nào thì bước đó cần xem lại.</p>
                </div>
                <Funnel
                  steps={[
                    { label: "Khách tạo đơn", value: data.performance.created },
                    { label: "Khách thanh toán", value: data.performance.paid },
                    { label: "Chủ xe duyệt", value: data.performance.approved },
                    { label: "Hoàn tất chuyến", value: data.performance.completed },
                  ]}
                />
                <ul className="grid grid-cols-3 gap-space-sm text-center">
                  {[
                    ["Khách hoặc admin hủy", data.performance.cancelled],
                    ["Chủ xe từ chối", data.performance.rejected],
                    ["Hết hạn", data.performance.expired],
                  ].map(([label, value]) => (
                    <li key={label} className="flex flex-col rounded-xl bg-surface-container-low px-space-sm py-space-sm">
                      <span className="text-title-lg text-on-surface">{number(Number(value))}</span>
                      <span className="text-label-md text-on-surface-variant">{label}</span>
                      <span className="text-label-sm text-outline">{share(Number(value), data.performance.created) ?? "–"}% số đơn</span>
                    </li>
                  ))}
                </ul>
              </section>

              <ul className="grid gap-gutter sm:grid-cols-2">
                <Metric label="Tỷ lệ xe được thuê" value={orDash(data.performance.utilizationPercent, "%")} note="Số ngày xe có khách thuê trên tổng số ngày của các xe đang công khai." />
                <Metric label="Chủ xe trả lời sau" value={orDash(data.performance.avgOwnerResponseHours, "giờ")} note="Trung bình từ lúc khách thanh toán đến lúc chủ xe duyệt. Hạn là 6 giờ." />
                <Metric label="Duyệt xe mất" value={orDash(data.performance.avgVehicleReviewHours, "giờ")} note="Trung bình từ lúc xe được đăng đến lúc được duyệt." />
                <Metric label="Giá trị đơn trung bình" value={data.performance.avgBookingValue === null ? "–" : formatVnd(data.performance.avgBookingValue)} note={`Tiền thuê, chưa gồm cọc. Trung bình ${orDash(data.performance.avgRentalDays, "ngày")} mỗi đơn.`} />
              </ul>
            </div>
          </section>

          <section className="flex flex-col gap-space-md">
            <h2 className="text-headline-sm text-on-surface">Toàn nền tảng từ trước tới nay</h2>
            <ul className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Người dùng"
                value={number(Object.values(data.totals.users).reduce((a, b) => a + (b ?? 0), 0))}
                note={`${number(data.totals.users.renter ?? 0)} khách thuê, ${number(data.totals.users.owner ?? 0)} chủ xe.`}
              />
              <Metric
                label="Xe"
                value={number(Object.values(data.totals.vehicles).reduce((a, b) => a + (b ?? 0), 0))}
                note={`${number(data.totals.vehicles.approved ?? 0)} đang công khai, ${number(data.totals.vehicles.pending ?? 0)} chờ duyệt.`}
              />
              <Metric label="Đơn thuê" value={number(data.totals.bookings)} note={`Khách đã thanh toán tổng cộng ${formatVnd(data.totals.paidAmount)}.`} />
              <Metric label="Đang giữ hộ" value={formatVnd(data.totals.heldAmount)} note="Đã thu, chưa hoàn cho khách và chưa ghi nhận cho chủ xe." />
            </ul>
          </section>
        </>
      )}
    </>
  );
}
