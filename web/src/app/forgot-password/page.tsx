import Link from "next/link";
import { Icon } from "@/components/icon";
import { Logo } from "@/components/logo";
import { pageTitle } from "@/lib/brand";

export const metadata = { title: pageTitle("Khôi phục mật khẩu") };

const FACTS = [
  { icon: "bolt", tone: "bg-tertiary-fixed text-on-tertiary-fixed-variant", title: "Không trùng lịch", note: "Xe bạn đặt là của bạn" },
  { icon: "shield", tone: "bg-primary-fixed text-primary", title: "Tiền được giữ hộ", note: "Tới khi giao xe" },
  { icon: "key", tone: "bg-primary-fixed text-primary", title: "Tiền cọc hoàn", note: "Khi trả xe" },
];

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[576px] flex-col justify-center gap-space-md px-margin-sm py-space-lg">
      <div className="flex items-center justify-between gap-space-sm">
        <Logo />
        <Link
          href="/login"
          className="flex items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md py-space-sm text-label-lg text-primary transition-colors hover:bg-surface-container"
        >
          <Icon name="arrow_back" className="!text-[18px]" />
          Quay lại Đăng nhập
        </Link>
      </div>

      <section className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-card">
        <div className="h-1 w-1/2 bg-primary" />
        <div className="flex flex-col items-center gap-space-md p-space-lg text-center sm:p-10">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-surface-container-low text-primary">
            <Icon name="lock_reset" filled className="!text-[32px]" />
          </span>
          <h1 className="text-headline-lg text-on-surface">Khôi phục mật khẩu</h1>
          <p className="text-body-md text-on-surface-variant">
            Hiện AutoRent VN chưa gửi được mã xác thực qua email hay tin nhắn, nên bạn chưa thể tự đặt lại mật khẩu trên trang
            này. Quản trị viên của dự án sẽ cấp lại mật khẩu theo đúng email bạn đã đăng ký.
          </p>
          <p className="flex w-full items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md text-left text-label-md text-on-surface-variant">
            <Icon name="lock_person" className="!text-[20px] text-primary" />
            Không cung cấp mật khẩu cho bất kỳ ai, kể cả nhân viên hỗ trợ.
          </p>
          <Link
            href="/support"
            className="flex h-12 w-full items-center justify-center gap-space-sm rounded-xl bg-primary text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container"
          >
            Mở trung tâm hỗ trợ
            <Icon name="arrow_forward" className="!text-[18px]" />
          </Link>
        </div>
        <p className="flex items-center gap-space-sm bg-surface-container-low px-space-lg py-space-sm text-label-md text-on-surface-variant">
          <Icon name="verified_user" className="!text-[18px] text-primary" />
          Mật khẩu của bạn được mã hóa và không ai xem được.
        </p>
      </section>

      <ul className="grid grid-cols-3 gap-space-sm">
        {FACTS.map((item) => (
          <li key={item.title} className="flex flex-col items-center gap-1 rounded-xl bg-surface-container-lowest p-space-sm text-center shadow-sm">
            <span className={`flex size-8 items-center justify-center rounded-lg ${item.tone}`}>
              <Icon name={item.icon} className="!text-[18px]" />
            </span>
            <span className="text-label-lg text-on-surface">{item.title}</span>
            <span className="text-label-sm text-on-surface-variant">{item.note}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
