import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata = { title: "Đăng nhập — Car-Rental" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-white">
      <div className="flex min-w-0 flex-1 flex-col justify-between px-24 py-10">
        <Logo />
        <form action="/" className="flex w-[440px] flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="text-[34px] font-bold text-ink">Chào mừng trở lại</h1>
            <p className="text-base text-muted">Đăng nhập để đặt xe hoặc quản lý xe của bạn.</p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">Email</span>
            <input
              type="email"
              placeholder="ten@email.com"
              className="h-[52px] rounded-[10px] border border-[#c5d2e3] px-3.5 text-base placeholder:text-[#8a99ae]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">Mật khẩu</span>
            <input
              type="password"
              placeholder="Nhập mật khẩu"
              className="h-[52px] rounded-[10px] border border-[#c5d2e3] px-3.5 text-base placeholder:text-[#8a99ae]"
            />
          </label>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2.5 text-ink">
              <input type="checkbox" className="size-5 accent-primary" />
              Ghi nhớ đăng nhập
            </label>
            <Link href="/forgot-password" className="font-semibold text-primary">
              Quên mật khẩu?
            </Link>
          </div>
          <button
            type="submit"
            className="h-[54px] rounded-xl bg-primary text-base font-semibold text-white"
          >
            Đăng nhập
          </button>
          <p className="flex justify-center gap-1.5 text-[15px]">
            <span className="text-muted">Chưa có tài khoản?</span>
            <Link href="/register" className="font-semibold text-primary">
              Đăng ký
            </Link>
          </p>
        </form>
        <p className="text-[13px] text-muted">Bằng việc đăng nhập, bạn đồng ý với điều khoản sử dụng.</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-6 bg-primary-50 p-16">
        <div className="flex h-[360px] w-[480px] flex-col items-center justify-center gap-2.5 rounded-3xl bg-primary-100">
          <Image src="/icons/hero-car.svg" alt="" width={72} height={72} />
          <p className="text-sm font-medium text-primary">[Ảnh minh họa]</p>
        </div>
        <p className="w-[420px] text-center text-2xl leading-[34px] font-semibold text-ink">
          Thuê xe từ chủ xe quanh bạn, đặt trong vài phút
        </p>
      </div>
    </div>
  );
}
