"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/error-message";
import { useAuth } from "@/lib/auth/auth-context";
import { loginHref } from "@/lib/auth/redirect";
import { createBooking } from "@/lib/bookings/api";
import { fromVnInput, MAX_RENTAL_DAYS, quote, rangeProblem, rentalDays } from "@/lib/bookings/rules";
import { formatVnd } from "@/lib/cars";

const INPUT = "h-12 w-full rounded-[10px] border border-[#c5d2e3] bg-white px-3 text-[15px] text-ink";
const BUTTON = "flex h-[52px] items-center justify-center rounded-xl bg-primary text-base font-semibold text-white disabled:opacity-50";

// Khung đặt xe trên trang chi tiết. Khách chọn giờ nhận và trả (giờ Việt Nam), xem tiền tạm tính, rồi bấm "Đặt xe" để tạo đơn
// và sang trang thanh toán. Số tiền ở đây chỉ để tham khảo: API tự tính lại từ giá của xe, không nhận số tiền từ trình duyệt.
export function BookingPanel({
  vehicleId,
  pricePerDay,
  depositRate,
  initialStartDate,
  initialEndDate,
  returnTo,
}: {
  vehicleId: string;
  pricePerDay: number;
  depositRate: number;
  initialStartDate: string; // yyyy-mm-dd mang từ trang tìm kiếm sang, rỗng nếu chưa chọn
  initialEndDate: string;
  returnTo: string; // trang này, để quay lại sau khi đăng nhập
}) {
  const { status, user } = useAuth();
  const router = useRouter();
  // Trang tìm kiếm chọn theo ngày nguyên; mặc định nhận 08:00 ngày đầu và trả 20:00 ngày cuối, khớp số ngày đã thấy ở đó.
  const [start, setStart] = useState(initialStartDate ? `${initialStartDate}T08:00` : "");
  const [end, setEnd] = useState(initialEndDate ? `${initialEndDate}T20:00` : "");
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const startIso = fromVnInput(start);
  const endIso = fromVnInput(end);
  const days = startIso && endIso && Date.parse(endIso) > Date.parse(startIso) ? rentalDays(startIso, endIso) : null;
  const price = days ? quote(pricePerDay, depositRate, days) : null;

  async function submit() {
    const problem = rangeProblem(startIso, endIso, new Date());
    if (problem || !startIso || !endIso) {
      setError({ message: problem ?? "Thời gian không hợp lệ." });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const booking = await createBooking({ vehicleId, startAt: startIso, endAt: endIso });
      router.push(`/checkout?booking=${booking.id}`);
    } catch (e) {
      setError({ message: apiErrorMessage(e), code: e instanceof ApiError ? e.code : undefined });
      setSubmitting(false);
    }
  }

  return (
    <aside className="flex w-[380px] shrink-0 flex-col gap-4 rounded-2xl border border-line bg-white p-6">
      <p className="flex items-end gap-1">
        <strong className="text-[28px] font-bold text-primary">{formatVnd(pricePerDay)}</strong>
        <span className="text-[15px] text-muted">/ngày</span>
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink">Nhận xe</span>
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={INPUT} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink">Trả xe</span>
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={INPUT} />
      </label>
      <p className="text-[13px] text-muted">Giờ Việt Nam. Số ngày thuê tính tròn theo từng 24 giờ.</p>

      {days && price ? (
        <dl className="flex flex-col gap-2.5 text-[15px]">
          <div className="flex justify-between">
            <dt className="text-muted">
              {formatVnd(pricePerDay)} x {days} ngày
            </dt>
            <dd className="font-semibold text-ink">{formatVnd(price.totalAmount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Tiền cọc ({depositRate}%, hoàn khi trả xe)</dt>
            <dd className="font-semibold text-ink">{formatVnd(price.depositAmount)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2.5 font-bold text-ink">
            <dt>Thanh toán khi đặt</dt>
            <dd className="text-primary">{formatVnd(price.payableAmount)}</dd>
          </div>
          {days > MAX_RENTAL_DAYS && (
            <p className="rounded-[10px] bg-[#fff6e5] px-3 py-2 text-[13px] text-[#8a5a00]">Mỗi đơn thuê tối đa {MAX_RENTAL_DAYS} ngày.</p>
          )}
        </dl>
      ) : (
        <p className="rounded-[10px] bg-surface px-3.5 py-3 text-[15px] text-muted">
          Chọn giờ nhận và trả xe để xem số tiền. Tiền cọc {depositRate}% tiền thuê, được hoàn khi trả xe.
        </p>
      )}

      {error && (
        <div role="alert" className="flex flex-col gap-1 rounded-[10px] bg-red-50 px-3.5 py-3 text-sm text-red-700">
          <p>{error.message}</p>
          {error.code === "LICENSE_NOT_VERIFIED" && (
            <Link href="/verify-license" className="font-semibold underline">
              Xác minh giấy phép lái xe
            </Link>
          )}
          {error.code === "PENDING_LIMIT" && (
            <Link href="/bookings" className="font-semibold underline">
              Xem các đơn đang chờ
            </Link>
          )}
        </div>
      )}

      {status === "loading" && (
        <button type="button" disabled className={BUTTON}>
          Đặt xe
        </button>
      )}
      {status === "anonymous" && (
        <Link href={loginHref(returnTo)} className={BUTTON}>
          Đăng nhập để đặt xe
        </Link>
      )}
      {status === "authenticated" && user.role === "renter" && (
        <button type="button" onClick={submit} disabled={submitting} className={BUTTON}>
          {submitting ? "Đang giữ xe..." : "Đặt xe"}
        </button>
      )}
      {status === "authenticated" && user.role !== "renter" && (
        <p className="rounded-[10px] bg-surface px-3.5 py-3 text-center text-sm text-muted">
          Chỉ tài khoản khách thuê mới đặt được xe.
        </p>
      )}
      <p className="text-center text-[13px] text-muted">Sau khi đặt, xe được giữ cho bạn 15 phút để thanh toán.</p>
    </aside>
  );
}
