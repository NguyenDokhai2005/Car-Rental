"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { apiErrorMessage } from "@/lib/api/error-message";
import { useAuth } from "@/lib/auth/auth-context";
import { getBooking, renterAction } from "@/lib/bookings/api";
import { Booking, effectiveStatus, formatClock, formatVnDateTime } from "@/lib/bookings/rules";
import { formatVnd } from "@/lib/cars";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; booking: Booking };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex w-full flex-col gap-4 rounded-2xl border border-line bg-white p-6">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Step({ index, label, state }: { index: number; label: string; state: "done" | "active" | "todo" }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex size-7 items-center justify-center rounded-full border-2 text-[13px] font-bold ${
          state === "todo" ? "border-[#c5d2e3] bg-white text-muted" : "border-primary bg-primary text-white"
        }`}
      >
        {state === "done" ? <Image src="/icons/check-white-16.svg" alt="" width={16} height={16} /> : index}
      </span>
      <span className={`text-[15px] ${state === "todo" ? "font-medium text-muted" : "font-semibold text-ink"}`}>{label}</span>
    </div>
  );
}

function Line() {
  return <span className="h-0.5 w-16 bg-[#c5d2e3]" />;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-[15px]">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold text-ink">{value}</span>
    </div>
  );
}

// Thông báo thay cho form khi đơn không còn ở bước "chờ thanh toán" (đã trả, đã hủy, hết hạn...).
function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-4 rounded-2xl border border-line bg-white p-8 text-center">
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      <p className="text-[15px] leading-6 text-muted">{children}</p>
      <div className="flex gap-3">
        <Link href="/bookings" className="flex h-12 items-center rounded-xl bg-primary px-6 text-[15px] font-semibold text-white">
          Đơn của tôi
        </Link>
        <Link href="/cars" className="flex h-12 items-center rounded-xl border border-[#c5d2e3] px-6 text-[15px] font-semibold text-ink">
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
      router.push("/bookings");
    } catch (e) {
      setError(apiErrorMessage(e));
      setPaying(false);
      // Đơn có thể vừa hết hạn hoặc đã được trả ở tab khác: tải lại để hiện đúng tình trạng.
      getBooking(booking.id)
        .then((latest) => setLoad({ status: "ready", booking: latest }))
        .catch(() => undefined);
    }
  }

  let body: React.ReactNode;
  if (load.status === "loading") {
    body = <p className="text-center text-muted">Đang tải đơn...</p>;
  } else if (load.status === "error") {
    body = <Notice title="Không mở được đơn">{load.message}</Notice>;
  } else {
    const booking = load.booking;
    const status = effectiveStatus(booking, now);
    if (status === "expired") {
      body = (
        <Notice title="Đơn đã hết hạn">
          {booking.paidAt
            ? `Chủ xe không trả lời kịp. Bạn được hoàn ${formatVnd(booking.paidAmount)}.`
            : "Đã quá 15 phút giữ chỗ nên xe được mở lại cho người khác. Bạn có thể đặt lại."}
        </Notice>
      );
    } else if (status !== "pending") {
      body = <Notice title="Đơn này không còn chờ thanh toán">Xem tình trạng mới nhất của đơn trong mục Đơn của tôi.</Notice>;
    } else if (booking.paidAt) {
      body = (
        <Notice title="Đã thanh toán">
          Bạn đã thanh toán {formatVnd(booking.paidAmount)}. Chủ xe có tối đa 6 giờ để duyệt; nếu họ từ chối hoặc không trả lời, bạn
          được hoàn toàn bộ.
        </Notice>
      );
    } else {
      const left = booking.expiresAt ? Date.parse(booking.expiresAt) - now.getTime() : 0;
      body = (
        <>
          <div className="flex items-center justify-center gap-3">
            <Step index={1} label="Chọn xe" state="done" />
            <Line />
            <Step index={2} label="Thanh toán" state="active" />
            <Line />
            <Step index={3} label="Chủ xe duyệt" state="todo" />
          </div>

          <div className="flex items-start gap-8">
            <div className="flex min-w-0 flex-1 flex-col gap-6">
              <div className="flex items-center gap-3 rounded-xl border border-[#f5c877] bg-[#fff6e5] px-[18px] py-3.5">
                <Image src="/icons/clock-22.svg" alt="" width={22} height={22} />
                <p className="flex-1 text-sm leading-[22px] font-medium text-[#5c3b00]">
                  Xe được giữ cho bạn trong <strong className="tabular-nums">{formatClock(left)}</strong>. Hết thời gian, đơn sẽ tự hủy
                  và xe mở lại cho người khác.
                </p>
              </div>

              <Card title="Thông tin người thuê">
                <Row label="Họ và tên" value={user?.fullName ?? ""} />
                <Row label="Số điện thoại" value={user?.phone ?? ""} />
                <div className="flex w-fit items-center gap-2 rounded-[10px] bg-[#e8f6ee] px-3.5 py-2.5">
                  <Image src="/icons/shield-check-18.svg" alt="" width={18} height={18} />
                  <span className="text-sm font-semibold text-[#137a43]">Giấy phép lái xe đã được xác minh</span>
                </div>
              </Card>

              <Card title="Tiền của bạn đi đâu">
                <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-6 text-ink">
                  <li>Ứng dụng giữ toàn bộ số tiền cho tới khi chủ xe duyệt đơn (tối đa 6 giờ).</li>
                  <li>Chủ xe từ chối hoặc không trả lời: bạn được hoàn toàn bộ.</li>
                  <li>Khi cả hai bên xác nhận giao xe, chủ xe nhận 50% tiền thuê; phần còn lại khi trả xe.</li>
                  <li>Tiền cọc {formatVnd(booking.depositAmount)} được hoàn cho bạn khi cả hai bên xác nhận trả xe.</li>
                </ul>
                <p className="text-[13px] text-muted">
                  Đây là thanh toán thử nghiệm: bấm &quot;Thanh toán&quot; là ghi nhận ngay, không trừ tiền thật.
                </p>
              </Card>

              <label className="flex items-start gap-3 text-sm leading-[22px] text-ink">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-px size-5 shrink-0 accent-primary"
                />
                Tôi đã đọc và đồng ý với điều khoản thuê xe và chính sách hủy, hoàn tiền.
              </label>
            </div>

            <aside className="flex w-[400px] shrink-0 flex-col gap-4 rounded-2xl border border-line bg-white p-6">
              <div className="flex items-center gap-3.5">
                <div className="flex h-[68px] w-24 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-placeholder text-[11px] font-medium text-primary">
                  {booking.vehicle.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được API xử lý (WebP, ≤ 1600 px)
                    <img src={booking.vehicle.coverUrl} alt={booking.vehicle.title} className="size-full object-cover" />
                  ) : (
                    "Chưa có ảnh"
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[17px] font-semibold text-ink">{booking.vehicle.title}</p>
                  <p className="text-[13px] text-muted">
                    {booking.vehicle.district}, {booking.vehicle.city}
                  </p>
                </div>
              </div>
              <hr className="border-line" />
              <Row label="Nhận xe" value={formatVnDateTime(booking.startAt)} />
              <Row label="Trả xe" value={formatVnDateTime(booking.endAt)} />
              <hr className="border-line" />
              <Row label={`${formatVnd(booking.pricePerDay)} x ${booking.rentalDays} ngày`} value={formatVnd(booking.totalAmount)} />
              <Row label="Tiền cọc (hoàn khi trả xe)" value={formatVnd(booking.depositAmount)} />
              <hr className="border-line" />
              <div className="flex justify-between text-lg font-bold">
                <span className="text-ink">Cần thanh toán</span>
                <span className="text-primary">{formatVnd(booking.payableAmount)}</span>
              </div>
              {error && (
                <p role="alert" className="rounded-[10px] bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={() => pay(booking)}
                disabled={!agreed || paying}
                className="flex h-[52px] items-center justify-center rounded-xl bg-primary text-base font-semibold text-white disabled:opacity-50"
              >
                {paying ? "Đang thanh toán..." : "Thanh toán"}
              </button>
            </aside>
          </div>
        </>
      );
    }
  }

  return (
    <>
      <Header />
      <main className="flex justify-center pt-8 pb-16">
        <div className="flex w-full max-w-page flex-col gap-7">{body}</div>
      </main>
      <Footer />
    </>
  );
}
