import Link from "next/link";
import { AccountSidebar } from "@/components/account-sidebar";
import { Header } from "@/components/header";
import { Icon } from "@/components/icon";
import { pageTitle } from "@/lib/brand";
import { LicenseStatus } from "./license-status";
import { LicenseUploads } from "./license-uploads";

export const metadata = { title: pageTitle("Xác minh giấy phép lái xe") };

const GUIDE = [
  { ok: true, icon: "check", title: "Đủ 4 góc, rõ nét", note: "Không lóa sáng đèn flash" },
  { ok: false, icon: "back_hand", title: "Bị che ngón tay", note: "Che khuất số bằng hoặc ảnh" },
  { ok: false, icon: "flash_on", title: "Chói đèn flash", note: "Mất chi tiết thông tin" },
  { ok: false, icon: "blur_on", title: "Mờ nhòe / mất góc", note: "Không đọc được thông tin" },
];

function StepTitle({ index, title, note }: { index: number; title: string; note: string }) {
  return (
    <div className="flex items-center gap-space-md">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-label-lg text-primary">{index}</span>
      <div className="flex flex-col">
        <h2 className="text-headline-sm text-on-surface">{title}</h2>
        <p className="text-label-md text-on-surface-variant">{note}</p>
      </div>
    </div>
  );
}

export default function VerifyLicensePage() {
  return (
    <>
      <Header active="/verify-license" />
      <div className="mx-auto flex w-full max-w-page items-start gap-gutter px-margin-sm py-space-lg lg:px-margin">
        <AccountSidebar active="/verify-license" />
        <main className="flex min-w-0 flex-1 flex-col gap-gutter">
          <section className="flex flex-wrap items-center justify-between gap-space-md rounded-2xl bg-gradient-to-r from-surface-container-lowest to-primary-fixed/60 p-space-lg shadow-sm">
            <div className="flex min-w-0 flex-1 flex-col items-start gap-space-sm">
              <span className="flex items-center gap-space-sm rounded-lg bg-primary-fixed px-space-sm py-1 text-label-md tracking-wider text-on-surface uppercase">
                <Icon name="verified_user" className="!text-[16px]" />
                Xác minh thủ công
              </span>
              <h1 className="text-headline-lg text-on-surface">Xác minh Giấy phép lái xe</h1>
              <p className="max-w-2xl text-body-lg text-on-surface-variant">
                Bạn cần được xác minh giấy phép lái xe trước khi đặt xe. Ảnh được lưu riêng, chỉ quản trị viên xem để xác minh.
              </p>
            </div>
            <LicenseStatus />
          </section>

          <div className="grid items-start gap-gutter xl:grid-cols-12">
            <div className="flex min-w-0 flex-col gap-gutter xl:col-span-7">
              <section className="flex flex-col gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
                <StepTitle index={1} title="Tải ảnh chụp GPLX thực tế" note="Chụp thẳng, đủ hai mặt, không mất góc" />
                <LicenseUploads />
                <p className="flex items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md text-body-md text-on-surface-variant">
                  <Icon name="admin_panel_settings" className="!text-[20px] text-primary" />
                  <span>
                    <strong className="block text-label-lg text-primary">Duyệt thủ công</strong>
                    Quản trị viên xem ảnh và duyệt. Vui lòng không dùng ảnh chụp màn hình hoặc bản photocopy.
                  </span>
                </p>
              </section>

              <section className="flex flex-col gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
                <h2 className="flex items-center gap-space-sm text-headline-sm text-on-surface">
                  <Icon name="photo_camera" className="text-primary" />
                  Hướng dẫn chụp ảnh đạt chuẩn
                </h2>
                <ul className="grid grid-cols-2 gap-space-md sm:grid-cols-4">
                  {GUIDE.map((item) => (
                    <li key={item.title} className="flex flex-col gap-1">
                      <span
                        className={`flex h-20 items-center justify-center rounded-xl ${
                          item.ok ? "bg-tertiary-fixed/50 text-tertiary" : "bg-error-container text-error"
                        }`}
                      >
                        <Icon name={item.icon} className="!text-[32px]" />
                      </span>
                      <span className={`text-label-lg ${item.ok ? "text-tertiary" : "text-error"}`}>{item.title}</span>
                      <span className="text-label-md text-on-surface-variant">{item.note}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="flex flex-col gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm xl:col-span-5">
              <StepTitle index={2} title="Cam kết & Xác nhận" note="Kiểm tra thông tin trước khi gửi xác minh" />
              <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
                <p className="flex items-start gap-space-sm text-body-md text-on-surface">
                  <Icon name="check_box" className="!text-[20px] text-primary" />
                  Giấy phép lái xe phải là thật và còn hiệu lực.
                </p>
                <p className="flex items-start gap-space-sm text-label-md text-on-surface-variant">
                  <Icon name="shield" className="!text-[18px] text-tertiary" />
                  Chúng tôi không chia sẻ ảnh giấy phép cho bên thứ ba.
                </p>
              </div>
              <p role="status" className="flex items-start gap-space-sm rounded-xl bg-warning-container p-space-md text-body-md text-warning">
                <Icon name="construction" className="!text-[20px]" />
                Chức năng gửi ảnh đang được hoàn thiện. Trong giai đoạn thử nghiệm, quản trị viên xác minh tài khoản trực tiếp.
              </p>
              <div className="flex gap-space-sm">
                <button
                  type="button"
                  disabled
                  className="flex h-12 flex-1 items-center justify-center gap-space-sm rounded-xl bg-primary text-label-lg text-on-primary shadow-sm disabled:opacity-50"
                >
                  Gửi xác minh
                  <Icon name="arrow_forward" className="!text-[18px]" />
                </button>
                <Link
                  href="/cars"
                  className="flex h-12 items-center rounded-xl bg-surface-container-low px-space-md text-label-lg text-on-surface transition-colors hover:bg-surface-container"
                >
                  Để sau
                </Link>
              </div>
              <Link href="/support#gplx" className="text-center text-label-md text-primary hover:underline">
                Cần trợ giúp? Xem câu hỏi về giấy phép lái xe
              </Link>
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
