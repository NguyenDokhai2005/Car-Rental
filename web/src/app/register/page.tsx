import { Icon } from "@/components/icon";
import { Logo } from "@/components/logo";
import { pageTitle } from "@/lib/brand";
import { RegisterForm } from "./register-form";

export const metadata = { title: pageTitle("Đăng ký") };

const BENEFITS = [
  {
    icon: "savings",
    tone: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
    title: "Tiền cọc hoàn khi trả xe",
    note: "Trả tiền thuê và tiền cọc một lần khi đặt. Không cần thế chấp tài sản.",
  },
  {
    icon: "verified_user",
    tone: "bg-primary-fixed text-primary",
    title: "Tiền được giữ an toàn",
    note: "Chủ xe chỉ nhận tiền khi cả hai bên xác nhận giao xe trên ứng dụng.",
  },
  {
    icon: "badge",
    tone: "bg-primary-fixed text-primary",
    title: "Xác minh giấy phép lái xe",
    note: "Tải ảnh giấy phép lái xe để được duyệt trước khi đặt xe.",
  },
];

export default function RegisterPage() {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-page items-center gap-gutter px-margin-sm py-space-lg lg:grid-cols-12 lg:px-margin">
      <section className="hidden flex-col gap-space-md rounded-2xl bg-surface-container-low p-10 lg:col-span-5 lg:flex">
        <Logo />
        <h2 className="text-headline-lg text-on-surface">
          Thuê xe hoặc cho thuê xe, <span className="text-primary">chọn vai trò</span> phù hợp với bạn
        </h2>
        <p className="text-body-md text-on-surface-variant">
          Khách thuê tìm xe theo ngày và đặt trực tuyến. Chủ xe đăng xe, duyệt đơn và theo dõi tiền về.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh nhỏ trong thư mục public */}
        <img src="/images/home/hero.webp" alt="" className="h-48 w-full rounded-xl object-cover" />
        <ul className="flex flex-col gap-space-sm">
          {BENEFITS.map((item) => (
            <li key={item.title} className="flex items-start gap-space-sm rounded-xl bg-surface-container-lowest p-space-sm shadow-sm">
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${item.tone}`}>
                <Icon name={item.icon} />
              </span>
              <span className="flex flex-col">
                <span className="text-label-lg text-on-surface">{item.title}</span>
                <span className="text-body-md text-on-surface-variant">{item.note}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-1 text-label-md text-tertiary">
          <Icon name="lock" className="!text-[16px]" />
          Dự án thử nghiệm
        </p>
      </section>

      <section className="rounded-2xl bg-surface-container-lowest p-space-lg shadow-card lg:col-span-7 lg:p-10">
        <div className="mb-space-md lg:hidden">
          <Logo size="sm" />
        </div>
        <RegisterForm />
      </section>
    </main>
  );
}
