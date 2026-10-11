import { AccountSidebar } from "@/components/account-sidebar";
import { Header } from "@/components/header";
import { Icon } from "@/components/icon";
import { pageTitle } from "@/lib/brand";
import { LicenseFlow } from "./license-flow";

export const metadata = { title: pageTitle("Xác minh giấy phép lái xe") };

const GUIDE = [
  { ok: true, icon: "check", title: "Đủ 4 góc, rõ nét", note: "Không lóa sáng đèn flash" },
  { ok: false, icon: "back_hand", title: "Bị che ngón tay", note: "Che khuất số bằng hoặc ảnh" },
  { ok: false, icon: "flash_on", title: "Chói đèn flash", note: "Mất chi tiết thông tin" },
  { ok: false, icon: "blur_on", title: "Mờ nhòe / mất góc", note: "Không đọc được thông tin" },
];

export default function VerifyLicensePage() {
  return (
    <>
      <Header active="/verify-license" />
      <div className="mx-auto flex w-full max-w-page items-start gap-gutter px-margin-sm py-space-lg lg:px-margin">
        <AccountSidebar active="/verify-license" />
        <main className="flex min-w-0 flex-1 flex-col gap-gutter">
          <section className="flex flex-col items-start gap-space-sm rounded-2xl bg-gradient-to-r from-surface-container-lowest to-primary-fixed/60 p-space-lg shadow-sm">
            <span className="flex items-center gap-space-sm rounded-lg bg-primary-fixed px-space-sm py-1 text-label-md tracking-wider text-on-surface uppercase">
              <Icon name="verified_user" className="!text-[16px]" />
              Xác minh thủ công
            </span>
            <h1 className="text-headline-lg text-on-surface">Xác minh Giấy phép lái xe</h1>
            <p className="max-w-2xl text-body-lg text-on-surface-variant">
              Bạn cần được xác minh giấy phép lái xe trước khi đặt xe. Ảnh được lưu riêng, chỉ quản trị viên xem để xác minh.
            </p>
          </section>

          <LicenseFlow />

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
        </main>
      </div>
    </>
  );
}
