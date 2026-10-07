import Link from "next/link";
import { AccountSidebar } from "@/components/account-sidebar";
import { Header } from "@/components/header";
import { Icon } from "@/components/icon";
import { pageTitle } from "@/lib/brand";
import { BookingList } from "./booking-list";

export const metadata = { title: pageTitle("Đơn của tôi") };

export default function BookingsPage() {
  return (
    <>
      <Header active="/bookings" />
      <div className="mx-auto flex w-full max-w-page items-start gap-gutter px-margin-sm py-space-lg lg:px-margin">
        <AccountSidebar active="/bookings" />
        <main className="flex min-w-0 flex-1 flex-col gap-space-md">
          <div className="flex flex-wrap items-end justify-between gap-space-md">
            <div className="flex flex-col gap-1">
              <h1 className="flex items-center gap-space-sm text-headline-lg text-on-surface">
                <Icon name="receipt_long" className="!text-[32px] text-primary" />
                Đơn của tôi
              </h1>
              <p className="text-body-md text-on-surface-variant">Theo dõi trạng thái đơn, xác nhận nhận xe và trả xe.</p>
            </div>
            <div className="flex flex-wrap gap-space-sm">
              <Link
                href="/terms#huy-don"
                className="flex h-10 items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md text-label-lg text-on-surface transition-colors hover:bg-surface-container"
              >
                <Icon name="help_center" className="!text-[18px]" />
                Chính sách hoàn tiền
              </Link>
              <Link
                href="/cars"
                className="flex h-10 items-center gap-space-sm rounded-xl bg-primary px-space-md text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container"
              >
                <Icon name="add_circle" className="!text-[18px]" />
                Đặt thêm xe mới
              </Link>
            </div>
          </div>

          <div className="flex items-start gap-space-md rounded-2xl bg-primary-fixed/60 p-space-md">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
              <Icon name="verified_user" filled />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-title-lg text-on-surface">Lưu ý bắt buộc khi nhận xe</p>
              <p className="text-body-md text-on-surface-variant">
                Mang theo giấy phép lái xe bản gốc đã xác minh. Khi nhận xe, bạn và chủ xe cùng bấm xác nhận trên ứng dụng.
              </p>
            </div>
          </div>

          <BookingList />

          <div className="flex flex-wrap items-center gap-space-md rounded-2xl bg-surface-container-low p-space-md">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-tertiary text-on-tertiary">
              <Icon name="shield" filled />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-title-lg text-on-surface">Tiền của bạn được giữ hộ</p>
              <p className="text-body-md text-on-surface-variant">
                Chúng tôi giữ khoản thanh toán của bạn. Chủ xe chỉ nhận tiền khi cả hai bên xác nhận giao xe trên ứng dụng.
              </p>
            </div>
            <Link
              href="/terms#huy-don"
              className="flex items-center gap-space-sm rounded-xl bg-surface-container-lowest px-space-md py-space-sm text-label-lg text-on-surface shadow-sm transition-colors hover:bg-surface-bright"
            >
              Xem chính sách hủy và hoàn tiền
              <Icon name="arrow_forward" className="!text-[18px]" />
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}
