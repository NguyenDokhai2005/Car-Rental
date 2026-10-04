import Link from "next/link";
import { Header } from "@/components/header";
import { LockIcon } from "@/components/icons";
import { LicenseUploads } from "./license-uploads";

export const metadata = { title: "Xác minh giấy phép lái xe — Car-Rental" };

const FIELDS = [
  { name: "licenseNumber", label: "Số giấy phép", placeholder: "[Số GPLX]", type: "text" },
  { name: "licenseClass", label: "Hạng", placeholder: "B1, B2...", type: "text" },
  { name: "expiresAt", label: "Ngày hết hạn", placeholder: "dd/mm/yyyy", type: "text" },
];

export default function VerifyLicensePage() {
  return (
    <>
      <Header minimal />
      <main className="flex justify-center pt-12 pb-16">
        <form action="/cars" className="flex w-full max-w-[760px] flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-[34px] font-bold text-ink">Xác minh giấy phép lái xe</h1>
            <p className="text-base text-muted">
              Bạn cần xác minh trước khi đặt xe đầu tiên. Quản trị viên sẽ duyệt thủ công và thông
              báo cho bạn.
            </p>
          </div>

          <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-7">
            <h2 className="text-xl font-bold text-ink">Thông tin giấy phép</h2>
            <div className="flex gap-4">
              {FIELDS.map((f) => (
                <label key={f.name} className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="text-sm font-semibold text-ink">{f.label}</span>
                  <input
                    name={f.name}
                    type={f.type}
                    placeholder={f.placeholder}
                    className="h-12 rounded-[10px] border border-[#c5d2e3] bg-white px-3.5 text-[15px] placeholder:text-[#8a99ae]"
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-7">
            <h2 className="text-xl font-bold text-ink">Ảnh giấy phép</h2>
            <LicenseUploads />
            <div className="flex items-start gap-3 rounded-[10px] bg-primary-50 px-4 py-3.5 text-primary">
              <LockIcon className="mt-px shrink-0" />
              <p className="text-sm leading-[22px] text-muted">
                Ảnh được lưu trong kho riêng, chỉ quản trị viên được xem và không hiển thị công khai
                với chủ xe.
              </p>
            </div>
          </section>

          <div className="flex items-center justify-between">
            <Link href="/" className="text-[15px] font-semibold text-muted">
              Để sau
            </Link>
            <button
              type="submit"
              className="h-[52px] rounded-xl bg-primary px-8 text-base font-semibold text-white"
            >
              Gửi xác minh
            </button>
          </div>

          <p className="rounded-xl border border-[#f5c877] bg-[#fff6e5] px-5 py-4 text-sm leading-[22px] text-[#5c3b00]">
            Trạng thái hồ sơ sau khi gửi: Chờ duyệt. Bạn có thể xem xe trong lúc chờ, nhưng chưa đặt
            được xe cho đến khi hồ sơ được duyệt.
          </p>
        </form>
      </main>
    </>
  );
}
