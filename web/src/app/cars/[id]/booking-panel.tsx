"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { ApiError } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/error-message";
import { useAuth } from "@/lib/auth/auth-context";
import { loginHref } from "@/lib/auth/redirect";
import { createBooking } from "@/lib/bookings/api";
import { fromVnInput, MAX_RENTAL_DAYS, quote, rangeProblem, rentalDays } from "@/lib/bookings/rules";
import { formatVnd } from "@/lib/cars";

const INPUT = "w-full bg-transparent text-label-lg text-on-surface outline-none";
const BUTTON = "flex h-[52px] w-full items-center justify-center gap-space-sm rounded-xl bg-primary-container text-title-lg text-on-primary shadow-sm transition-colors hover:bg-primary disabled:opacity-50";

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
    <aside className="flex w-full shrink-0 flex-col gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-card lg:sticky lg:top-24 lg:w-[380px]">
      <p className="flex items-end gap-1">
        <strong className="text-price-display text-primary">{formatVnd(pricePerDay)}</strong>
        <span className="text-body-md text-on-surface-variant">/ngày</span>
      </p>

      <label className="flex flex-col gap-1 rounded-xl bg-surface-container-low px-space-md py-space-sm">
        <span className="text-label-sm text-on-surface-variant">Thời gian nhận</span>
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 rounded-xl bg-surface-container-low px-space-md py-space-sm">
        <span className="text-label-sm text-on-surface-variant">Thời gian trả</span>
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={INPUT} />
      </label>
      <p className="text-label-sm text-outline">Giờ Việt Nam. Số ngày thuê tính tròn theo từng 24 giờ.</p>

      {days && price ? (
        <dl className="flex flex-col gap-space-sm text-body-md">
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">
              {formatVnd(pricePerDay)} x {days} ngày
            </dt>
            <dd className="font-semibold text-on-surface">{formatVnd(price.totalAmount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Tiền cọc ({depositRate}%, hoàn khi trả xe)</dt>
            <dd className="font-semibold text-on-surface">{formatVnd(price.depositAmount)}</dd>
          </div>
          <div className="flex justify-between rounded-xl bg-surface-container-low px-space-md py-space-sm font-bold text-on-surface">
            <dt>Thanh toán khi đặt</dt>
            <dd className="text-primary">{formatVnd(price.payableAmount)}</dd>
          </div>
          {days > MAX_RENTAL_DAYS && (
            <p className="rounded-xl bg-warning-container px-space-sm py-space-sm text-label-md text-warning">Mỗi đơn thuê tối đa {MAX_RENTAL_DAYS} ngày.</p>
          )}
        </dl>
      ) : (
        <p className="rounded-xl bg-surface-container-low px-space-md py-space-sm text-body-md text-on-surface-variant">
          Chọn giờ nhận và trả xe để xem số tiền. Tiền cọc {depositRate}% tiền thuê, được hoàn khi trả xe.
        </p>
      )}

      {error && (
        <div role="alert" className="flex flex-col gap-1 rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
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
        <p className="rounded-xl bg-surface-container-low px-space-md py-space-sm text-center text-body-md text-on-surface-variant">
          Chỉ tài khoản khách thuê mới đặt được xe.
        </p>
      )}
      <p className="text-center text-label-sm text-outline">Sau khi đặt, xe được giữ cho bạn 15 phút để thanh toán.</p>
      <p className="flex flex-wrap justify-center gap-x-space-md gap-y-1 text-label-sm text-on-surface-variant">
        <span className="flex items-center gap-1">
          <Icon name="verified_user" filled className="!text-[14px] text-tertiary" />
          Tiền được giữ hộ
        </span>
        <span className="flex items-center gap-1">
          <Icon name="savings" filled className="!text-[14px] text-tertiary" />
          Tiền cọc hoàn khi trả xe
        </span>
      </p>
    </aside>
  );
}
