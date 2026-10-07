import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icon";
import { pageTitle } from "@/lib/brand";
import { LoginForm } from "./login-form";

export const metadata = { title: pageTitle("Đăng nhập") };

const PROMISES = [
  { icon: "verified_user", title: "Tiền được giữ hộ", note: "Chủ xe chỉ nhận tiền khi cả hai bên xác nhận giao xe." },
  { icon: "savings", title: "Tiền cọc hoàn khi trả xe", note: "Trả một lần khi đặt, không cần thế chấp tài sản." },
  { icon: "event_available", title: "Không trùng lịch", note: "Xe bạn đã đặt được giữ riêng cho bạn." },
];

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-margin-sm py-space-lg">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-2xl bg-surface-container-lowest shadow-card lg:grid-cols-12">
        <section className="hidden flex-col justify-between gap-space-lg bg-gradient-to-br from-primary-container to-primary p-10 text-on-primary lg:col-span-5 lg:flex">
          <Link href="/" className="flex items-center gap-space-sm">
            <span className="flex size-10 items-center justify-center rounded-xl bg-surface-container-lowest text-primary">
              <Icon name="directions_car" filled />
            </span>
            <span className="flex flex-col">
              <span className="text-headline-sm">AutoRent VN</span>
              <span className="text-label-sm tracking-widest opacity-80">THUÊ XE TỰ LÁI</span>
            </span>
          </Link>

          <div className="flex flex-col gap-space-md">
            <h2 className="text-headline-lg">Nền tảng thuê xe tự lái giữa chủ xe và khách thuê</h2>
            <p className="text-body-lg opacity-90">Tìm xe theo ngày, đặt và thanh toán trực tuyến, theo dõi đơn ngay trên web.</p>
          </div>

          <ul className="flex flex-col gap-space-sm">
            {PROMISES.map((item) => (
              <li key={item.title} className="flex items-start gap-space-sm rounded-xl bg-white/10 p-space-md backdrop-blur-sm">
                <Icon name={item.icon} filled className="text-tertiary-fixed" />
                <span className="flex flex-col">
                  <span className="text-label-lg">{item.title}</span>
                  <span className="text-body-md opacity-85">{item.note}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex items-center justify-center p-space-lg lg:col-span-7 lg:p-12">
          {/* useSearchParams cần Suspense để trang vẫn dựng tĩnh được. */}
          <Suspense>
            <LoginForm />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
