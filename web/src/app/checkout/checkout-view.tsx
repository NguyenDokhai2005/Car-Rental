"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Icon } from "@/components/icon";
import { VehicleImage } from "@/components/vehicle-image";
import { apiErrorMessage } from "@/lib/api/error-message";
import { useAuth } from "@/lib/auth/auth-context";
import { getBooking, renterAction } from "@/lib/bookings/api";
import { Booking, effectiveStatus, formatClock, formatVnDateTime } from "@/lib/bookings/rules";
import { formatVnd } from "@/lib/cars";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; booking: Booking };

function Card({ icon, title, aside, children }: { icon: string; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex w-full flex-col gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <h2 className="flex items-center gap-space-sm text-headline-sm text-on-surface">
          <span className="flex size-9 items-center justify-center rounded-lg bg-surface-container-low text-primary">
            <Icon name={icon} className="!text-[20px]" />
          </span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Step({ index, label, state }: { index: number; label: string; state: "done" | "active" | "todo" }) {
  const circle =
    state === "active"
      ? "bg-primary-container text-on-primary shadow-sm"
      : state === "done"
        ? "bg-surface-container-low text-primary"
        : "bg-surface-container-low text-outline";
  return (
    <div className="flex items-center gap-space-sm">
      <span className={`flex size-7 items-center justify-center rounded-full text-label-md ${circle}`}>
        {state === "done" ? <Icon name="check" className="!text-[16px]" /> : index}
      </span>
      <span className={`text-label-lg ${state === "active" ? "text-primary" : state === "done" ? "text-on-surface" : "text-outline"}`}>
        {label}
      </span>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface-container-low p-space-md">
      <span className="text-label-md text-on-surface-variant">{label}:</span>
      <span className="text-title-lg text-on-surface">{value || "Chưa có"}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-space-md text-body-md">
      <span className="text-on-surface-variant">{label}</span>
      <span className="text-right font-semibold text-on-surface">{value}</span>
    </div>
  );
}

// Thông báo thay cho form khi đơn không còn ở bước "chờ thanh toán" (đã trả, đã hủy, hết hạn...).
function Notice({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-space-md rounded-2xl bg-surface-container-lowest p-space-lg text-center shadow-sm">
      <span className="flex size-14 items-center justify-center rounded-full bg-surface-container-low text-primary">
        <Icon name={icon} className="!text-[28px]" />
      </span>
      <h1 className="text-headline-md text-on-surface">{title}</h1>
      <p className="text-body-md text-on-surface-variant">{children}</p>
      <div className="flex flex-wrap justify-center gap-space-sm">
        <Link
          href="/bookings"
          className="flex h-12 items-center rounded-xl bg-primary px-space-lg text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container"
        >
          Đơn của tôi
        </Link>
        <Link
          href="/cars"
          className="flex h-12 items-center rounded-xl bg-surface-container-low px-space-lg text-label-lg text-on-surface transition-colors hover:bg-surface-container"
        >
          Tìm xe khác
        </Link>
      </div>
    </div>
  );
}

export function CheckoutView({ bookingId }: { bookingId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [now, setNow] = useState(() => new Date());
  const [agreed, setAgreed] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!bookingId) {
      setLoad({ status: "error", message: "Không có đơn nào để thanh toán." });
      return;
    }
    getBooking(bookingId)
      .then((booking) => !cancelled && setLoad({ status: "ready", booking }))
      .catch((e) => !cancelled && setLoad({ status: "error", message: apiErrorMessage(e) }));
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  // Đồng hồ đếm ngược: mỗi giây cập nhật "bây giờ". Hạn thật do API giữ; đồng hồ này chỉ để người dùng thấy.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function pay(booking: Booking) {
    setPaying(true);
    setError(null);
    try {
      await renterAction(booking.id, "pay");
      router.push(`/checkout/result?booking=${booking.id}`);
    } catch (e) {
      setError(apiErrorMessage(e));
      setPaying(false);
      // Đơn có thể vừa hết hạn hoặc đã được trả ở tab khác: tải lại để hiện đúng tình trạng.
      getBooking(booking.id)
        .then((latest) => setLoad({ status: "ready", booking: latest }))
        .catch(() => undefined);
    }
  }

  let bar: React.ReactNode = null;
  let body: React.ReactNode;
  if (load.status === "loading") {
    body = <p className="text-center text-body-md text-on-surface-variant">Đang tải đơn...</p>;
  } else if (load.status === "error") {
    body = (
      <Notice icon="error" title="Không mở được đơn">
        {load.message}
      </Notice>
    );
  } else {
    const booking = load.booking;
    const status = effectiveStatus(booking, now);
    if (status === "expired") {
      body = (
        <Notice icon="timer_off" title="Đơn đã hết hạn">
          {booking.paidAt
            ? `Chủ xe không trả lời kịp. Bạn được hoàn ${formatVnd(booking.paidAmount)}.`
            : "Đã quá 15 phút giữ chỗ nên xe được mở lại cho người khác. Bạn có thể đặt lại."}
        </Notice>
      );
    } else if (status !== "pending") {
      body = (
        <Notice icon="receipt_long" title="Đơn này không còn chờ thanh toán">
          Xem tình trạng mới nhất của đơn trong mục Đơn của tôi.
        </Notice>
      );
    } else if (booking.paidAt) {
      body = (
        <Notice icon="check_circle" title="Đã thanh toán">
          Bạn đã thanh toán {formatVnd(booking.paidAmount)}. Chủ xe có tối đa 6 giờ để duyệt; nếu họ từ chối hoặc không trả lời, bạn
          được hoàn toàn bộ.
        </Notice>
      );
    } else {
      const left = booking.expiresAt ? Date.parse(booking.expiresAt) - now.getTime() : 0;
      bar = (
        <section className="bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-space-md px-margin-sm py-space-md lg:px-margin">
            <div className="flex flex-wrap items-center gap-space-md">
              <Step index={1} label="Chọn xe" state="done" />
              <span aria-hidden className="hidden h-0.5 w-12 bg-primary sm:block" />
              <Step index={2} label="Thanh toán" state="active" />
              <span aria-hidden className="hidden h-0.5 w-12 bg-surface-container-high sm:block" />
              <Step index={3} label="Chủ xe duyệt" state="todo" />
            </div>
            <p role="timer" className="flex items-center gap-space-sm rounded-xl bg-warning-container px-space-md py-space-sm text-body-md text-warning">
              <Icon name="timer" filled className="!text-[20px]" />
              <span>
                Xe được giữ cho bạn trong <strong className="tabular-nums">{formatClock(left)}</strong>. Hết thời gian, đơn tự hủy.
              </span>
            </p>
          </div>
        </section>
      );
      body = (
        <div className="grid items-start gap-gutter lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-gutter lg:col-span-7">
            <Card
              icon="person"
              title="Thông tin người thuê"
              aside={
                <span className="flex items-center gap-1 rounded-full bg-tertiary-fixed/40 px-space-sm py-1 text-label-md text-on-tertiary-fixed-variant">
                  <Icon name="check_circle" filled className="!text-[16px]" />
                  Giấy phép lái xe đã được xác minh
                </span>
              }
            >
              <div className="grid gap-space-md sm:grid-cols-2">
                <Tile label="Họ và tên" value={user?.fullName ?? ""} />
                <Tile label="Số điện thoại" value={user?.phone ?? ""} />
              </div>
            </Card>

            <Card icon="credit_card" title="Phương thức thanh toán">
              <div className="flex items-center gap-space-md rounded-xl bg-surface-container-low p-space-md ring-2 ring-primary-container">
                <span aria-hidden className="flex size-5 items-center justify-center rounded-full border-[6px] border-primary-container bg-surface-container-lowest" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-title-lg text-on-surface">Thanh toán thử nghiệm</span>
                  <span className="text-body-md text-on-surface-variant">Bấm thanh toán là ghi nhận ngay, không trừ tiền thật.</span>
                </div>
                <span className="rounded-md bg-primary px-2 py-1 text-label-sm text-on-primary">SANDBOX</span>
              </div>
              <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
                <Row label="Số tiền" value={formatVnd(booking.payableAmount)} />
                <p className="flex items-center gap-space-sm text-label-md text-on-surface-variant">
                  <Icon name="check_circle" className="!text-[16px] text-tertiary" />
                  Hệ thống tự ghi nhận ngay sau khi bạn bấm thanh toán.
                </p>
              </div>
            </Card>

            <Card icon="verified_user" title="Tiền của bạn được giữ an toàn">
              <p className="text-body-md text-on-surface-variant">
                Chúng tôi giữ toàn bộ khoản thanh toán cho tới khi chủ xe duyệt đơn, tối đa 6 giờ. Nếu chủ xe từ chối hoặc không trả
                lời, bạn được hoàn 100%. Khi cả hai bên xác nhận giao xe, chủ xe nhận 50% tiền thuê; phần còn lại khi trả xe.
              </p>
              <div className="flex flex-wrap gap-space-sm">
                <span className="flex items-center gap-1 rounded-lg bg-surface-container-low px-space-sm py-1.5 text-label-md text-primary">
                  <Icon name="event_available" className="!text-[16px]" />
                  Hủy trước 48 giờ: hoàn 100%
                </span>
                <span className="flex items-center gap-1 rounded-lg bg-tertiary-fixed/40 px-space-sm py-1.5 text-label-md text-on-tertiary-fixed-variant">
                  <Icon name="payments" className="!text-[16px]" />
                  Tiền cọc hoàn khi trả xe
                </span>
              </div>
            </Card>

            <section className="flex flex-col gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
              <label className="flex items-start gap-space-sm text-body-md text-on-surface">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
                <span>
                  Tôi đồng ý với{" "}
                  <Link href="/terms" target="_blank" className="font-semibold text-primary underline">
                    điều khoản thuê xe và chính sách hủy, hoàn tiền
                  </Link>
                  .
                </span>
              </label>
              {error && (
                <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={() => pay(booking)}
                disabled={!agreed || paying}
                className="flex h-14 items-center justify-center gap-space-sm rounded-xl bg-primary-container text-title-lg text-on-primary shadow-sm transition-colors hover:bg-primary disabled:opacity-50"
              >
                <Icon name="lock" className="!text-[20px]" />
                {paying ? "Đang thanh toán..." : `Thanh toán ${formatVnd(booking.payableAmount)}`}
              </button>
            </section>
          </div>

          <aside className="flex flex-col gap-gutter lg:sticky lg:top-24 lg:col-span-5">
            <section className="flex flex-col gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
              <div className="flex items-start justify-between gap-space-sm">
                <div className="flex flex-col gap-1">
                  <h2 className="text-headline-sm text-on-surface">Chi tiết đơn hàng</h2>
                  <p className="font-mono text-label-sm text-on-surface-variant">Mã đơn: {booking.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <span className="rounded-lg bg-surface-container-low px-space-sm py-1 text-label-md text-on-surface-variant">
                  {booking.rentalDays} ngày
                </span>
              </div>

              <div className="flex items-center gap-space-md rounded-xl bg-surface-container-low p-space-md">
                <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg">
                  <VehicleImage src={booking.vehicle.coverUrl} alt={booking.vehicle.title} emptyLabel="" />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-title-lg text-on-surface">{booking.vehicle.title}</p>
                  <p className="flex items-center gap-1 text-label-md text-on-surface-variant">
                    <Icon name="location_on" className="!text-[16px] text-primary" />
                    {booking.vehicle.district}, {booking.vehicle.city}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
                <div className="flex items-start gap-space-sm">
                  <Icon name="calendar_today" className="mt-0.5 !text-[18px] text-primary" />
                  <span className="flex flex-col">
                    <span className="text-label-md text-on-surface-variant">Giờ nhận:</span>
                    <span className="text-label-lg text-on-surface">{formatVnDateTime(booking.startAt)}</span>
                  </span>
                </div>
                <span className="ml-7 w-fit rounded bg-primary-fixed px-2 py-0.5 text-label-sm text-primary">
                  Thời gian: {booking.rentalDays} ngày
                </span>
                <div className="flex items-start gap-space-sm">
                  <Icon name="event_upcoming" className="mt-0.5 !text-[18px] text-primary" />
                  <span className="flex flex-col">
                    <span className="text-label-md text-on-surface-variant">Giờ trả:</span>
                    <span className="text-label-lg text-on-surface">{formatVnDateTime(booking.endAt)}</span>
                  </span>
                </div>
              </div>

              <Row label={`Tiền thuê (${formatVnd(booking.pricePerDay)} × ${booking.rentalDays} ngày)`} value={formatVnd(booking.totalAmount)} />
              <Row label="Tiền cọc (hoàn khi trả xe)" value={formatVnd(booking.depositAmount)} />
              <div className="flex items-center justify-between gap-space-md rounded-xl bg-surface-container-low px-space-md py-space-sm">
                <span className="text-title-lg text-on-surface">Cần thanh toán</span>
                <span className="text-headline-md text-primary-container">{formatVnd(booking.payableAmount)}</span>
              </div>
              <p className="flex items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md text-label-md text-on-surface-variant">
                <Icon name="check_circle" className="!text-[18px] text-primary" />
                Bạn thanh toán một lần duy nhất khi đặt xe. Tiền cọc được hoàn khi cả hai bên xác nhận trả xe.
              </p>
            </section>

            <Link
              href="/support"
              className="flex items-center justify-between gap-space-sm rounded-2xl bg-surface-container-lowest p-space-md text-label-md shadow-sm transition-colors hover:bg-surface-bright"
            >
              <span className="flex items-center gap-space-sm text-on-surface-variant">
                <Icon name="support_agent" className="!text-[20px] text-primary" />
                Cần hỗ trợ thanh toán?
              </span>
              <span className="font-bold text-primary">Mở trung tâm hỗ trợ</span>
            </Link>
          </aside>
        </div>
      );
    }
  }

  return (
    <>
      <Header />
      {bar}
      <main className="mx-auto w-full max-w-page px-margin-sm py-space-lg lg:px-margin">{body}</main>
      <footer className="mx-auto flex w-full max-w-page flex-wrap items-center justify-between gap-space-sm px-margin-sm py-space-md text-label-md text-on-surface-variant lg:px-margin">
        <span>© 2026 AutoRent VN · Dự án thử nghiệm, không trừ tiền thật</span>
        <Link href="/support" className="hover:text-primary">
          Hỗ trợ
        </Link>
      </footer>
    </>
  );
}
