"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Icon } from "@/components/icon";
import { VehicleImage } from "@/components/vehicle-image";
import { apiErrorMessage } from "@/lib/api/error-message";
import { getBooking } from "@/lib/bookings/api";
import { Booking, formatVnDateTime } from "@/lib/bookings/rules";
import { formatVnd } from "@/lib/cars";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; booking: Booking };

const CARD = "rounded-2xl bg-surface-container-lowest p-space-md shadow-sm";

const BADGES = {
  done: { label: "Đã hoàn thành", tone: "bg-tertiary-fixed/50 text-on-tertiary-fixed-variant", box: "bg-surface-container-low" },
  waiting: { label: "Đang chờ", tone: "bg-warning-container text-warning", box: "bg-warning-container/60" },
  next: { label: "Sắp diễn ra", tone: "bg-primary-fixed text-primary", box: "bg-surface-container-low" },
} as const;

function Step({ title, note, state }: { title: string; note: string; state: keyof typeof BADGES }) {
  const badge = BADGES[state];
  return (
    <li className={`flex flex-col gap-1 rounded-xl p-space-md ${badge.box}`}>
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <h3 className="text-label-lg text-on-surface">{title}</h3>
        <span className={`rounded px-2 py-0.5 text-label-sm uppercase ${badge.tone}`}>{badge.label}</span>
      </div>
      <p className="text-body-md text-on-surface-variant">{note}</p>
    </li>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label-md text-on-surface-variant">{label}</span>
      <span className="text-title-lg text-on-surface">{value}</span>
    </div>
  );
}

export function PaymentResult({ bookingId }: { bookingId: string }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    if (!bookingId) {
      setLoad({ status: "error", message: "Không có đơn nào để xem kết quả." });
      return;
    }
    getBooking(bookingId)
      .then((booking) => !cancelled && setLoad({ status: "ready", booking }))
      .catch((e) => !cancelled && setLoad({ status: "error", message: apiErrorMessage(e) }));
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  let body: React.ReactNode;
  if (load.status === "loading") {
    body = <p className="text-center text-body-md text-on-surface-variant">Đang tải kết quả...</p>;
  } else if (load.status === "error" || !load.booking.paidAt) {
    // Kết quả luôn lấy từ API: đơn chưa được ghi nhận thanh toán thì không báo thành công, dù người dùng mở thẳng trang này.
    const unpaid = load.status === "ready";
    body = (
      <section className={`mx-auto flex w-full max-w-[560px] flex-col items-center gap-space-md text-center ${CARD} lg:p-space-lg`}>
        <span className="flex size-16 items-center justify-center rounded-2xl bg-error-container text-error">
          <Icon name="error" filled className="!text-[32px]" />
        </span>
        <h1 className="text-headline-lg text-on-surface">Chưa ghi nhận thanh toán</h1>
        <p className="text-body-md text-on-surface-variant">
          {unpaid ? "Đơn này chưa được thanh toán. Xe chỉ được giữ trong 15 phút kể từ lúc đặt." : load.status === "error" ? load.message : ""}
        </p>
        <div className="flex flex-wrap justify-center gap-space-sm">
          {unpaid && (
            <Link
              href={`/checkout?booking=${bookingId}`}
              className="flex h-12 items-center rounded-xl bg-primary px-space-lg text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container"
            >
              Quay lại thanh toán
            </Link>
          )}
          <Link
            href="/bookings"
            className="flex h-12 items-center rounded-xl bg-surface-container-low px-space-lg text-label-lg text-on-surface transition-colors hover:bg-surface-container"
          >
            Đơn của tôi
          </Link>
        </div>
      </section>
    );
  } else {
    const b = load.booking;
    const approved = Boolean(b.ownerApprovedAt);
    body = (
      <>
        <section className={`flex flex-col gap-space-md bg-gradient-to-br from-surface-container-lowest to-tertiary-fixed/30 ${CARD} lg:p-space-lg`}>
          <div className="flex flex-wrap items-center justify-between gap-space-md">
            <div className="flex min-w-0 flex-1 items-start gap-space-md">
              <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-tertiary-fixed/60 text-tertiary">
                <Icon name="check_circle" filled className="!text-[36px]" />
              </span>
              <div className="flex min-w-0 flex-col gap-space-sm">
                <span className="flex w-fit items-center gap-1 rounded-full bg-tertiary-fixed/50 px-space-sm py-0.5 text-label-md text-on-tertiary-fixed-variant">
                  <Icon name="bolt" className="!text-[14px]" />
                  Khóa lịch xe tức thì
                </span>
                <h1 className="text-headline-lg text-on-surface">Thanh toán thành công</h1>
                <p className="text-body-lg text-on-surface-variant">
                  {approved
                    ? "Chủ xe đã duyệt đơn. Hẹn bạn tại điểm nhận xe đúng giờ."
                    : "Đơn của bạn đang chờ chủ xe duyệt. Chủ xe có tối đa 6 giờ để trả lời; nếu họ từ chối hoặc không trả lời, bạn được hoàn toàn bộ."}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 rounded-2xl bg-surface-container-low p-space-md">
              <span className="text-label-md tracking-wider text-on-surface-variant uppercase">Số tiền đã thanh toán</span>
              <span className="text-price-display text-primary-container">{formatVnd(b.paidAmount)}</span>
              <span className="flex items-center gap-1 text-label-md text-tertiary">
                <Icon name="verified" className="!text-[16px]" />
                Gồm tiền thuê và tiền cọc
              </span>
            </div>
          </div>
          <div className="grid gap-space-md pt-space-sm sm:grid-cols-3">
            <Fact label="Mã đơn đặt xe" value={b.id.slice(0, 8).toUpperCase()} />
            <Fact label="Hình thức" value="Thanh toán thử nghiệm" />
            <Fact label="Thời gian ghi nhận" value={formatVnDateTime(b.paidAt ?? b.createdAt)} />
          </div>
        </section>

        <div className="grid items-start gap-gutter lg:grid-cols-12">
          <section className={`flex flex-col gap-space-md lg:col-span-7 ${CARD}`}>
            <h2 className="flex items-center gap-space-sm text-headline-sm text-on-surface">
              <Icon name="alt_route" className="text-primary" />
              Lộ trình 3 bước nhận xe tiếp theo
            </h2>
            <ol className="flex flex-col gap-space-sm">
              <Step state="done" title="Bước 1: Thanh toán" note="Bạn đã trả tiền thuê và tiền cọc." />
              <Step
                state={approved ? "done" : "waiting"}
                title="Bước 2: Chủ xe duyệt đơn"
                note="Chủ xe có tối đa 6 giờ. Bạn sẽ thấy kết quả trong mục Đơn của tôi."
              />
              <Step
                state="next"
                title="Bước 3: Nhận xe"
                note={`${formatVnDateTime(b.startAt)} tại ${b.vehicle.district}, ${b.vehicle.city}. Bạn và chủ xe cùng bấm xác nhận trên ứng dụng.`}
              />
            </ol>
            <div className="flex flex-wrap gap-space-sm">
              <Link
                href={`/bookings/${b.id}`}
                className="flex h-12 items-center gap-space-sm rounded-xl bg-primary-container px-space-md text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary"
              >
                <Icon name="directions_car" className="!text-[18px]" />
                Xem chi tiết chuyến đi
              </Link>
              <Link
                href="/bookings"
                className="flex h-12 items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md text-label-lg text-on-surface transition-colors hover:bg-surface-container"
              >
                <Icon name="list_alt" className="!text-[18px]" />
                Xem đơn của tôi
              </Link>
              <Link
                href="/"
                className="flex h-12 items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md text-label-lg text-on-surface transition-colors hover:bg-surface-container"
              >
                <Icon name="home" className="!text-[18px]" />
                Về trang chủ
              </Link>
            </div>
          </section>

          <section className={`flex flex-col gap-space-sm lg:col-span-5 ${CARD}`}>
            <div className="flex items-center justify-between gap-space-sm">
              <h2 className="text-headline-sm text-on-surface">Thông tin xe & Hợp đồng</h2>
              <span className="rounded-lg bg-surface-container-low px-space-sm py-1 text-label-md text-on-surface-variant">{b.rentalDays} ngày thuê</span>
            </div>
            <div className="flex items-center gap-space-md rounded-xl bg-surface-container-low p-space-md">
              <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg">
                <VehicleImage src={b.vehicle.coverUrl} alt={b.vehicle.title} emptyLabel="" />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-title-lg text-on-surface">{b.vehicle.title}</p>
                <p className="text-label-md text-on-surface-variant">
                  {b.vehicle.district}, {b.vehicle.city}
                </p>
              </div>
            </div>
            <div className="flex justify-between text-body-md">
              <span className="text-on-surface-variant">Tiền thuê xe:</span>
              <span className="font-semibold text-on-surface">{formatVnd(b.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-body-md">
              <span className="text-on-surface-variant">Tiền cọc:</span>
              <span className="font-semibold text-on-surface">{formatVnd(b.depositAmount)}</span>
            </div>
            <div className="flex justify-between text-body-md text-tertiary">
              <span className="flex items-center gap-1">
                <Icon name="autorenew" className="!text-[18px]" />
                Hoàn lại khi trả xe:
              </span>
              <span className="font-semibold">{formatVnd(b.depositAmount)}</span>
            </div>
            <p className="flex items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md text-body-md text-on-surface">
              <Icon name="info" className="!text-[20px] text-primary" />
              Bạn không cần trả thêm khoản nào khi nhận xe.
            </p>
            <div className="flex flex-col gap-1 rounded-xl bg-warning-container p-space-md text-body-md text-warning">
              <p className="flex items-center gap-space-sm text-label-lg">
                <Icon name="badge" className="!text-[18px]" />
                Khi nhận xe:
              </p>
              <ul className="list-disc pl-space-lg">
                <li>Mang theo giấy phép lái xe bản gốc.</li>
                <li>Bấm Đã nhận xe trên ứng dụng khi bạn nhận được xe.</li>
              </ul>
            </div>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <Header active="/bookings" />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-gutter px-margin-sm py-space-lg">{body}</main>
      <Footer />
    </>
  );
}
