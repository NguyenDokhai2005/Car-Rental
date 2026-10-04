import Image from "next/image";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Đăng nhập — Car-Rental" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-white">
      <div className="flex min-w-0 flex-1 flex-col justify-between px-24 py-10">
        <Logo />
        {/* useSearchParams cần Suspense để trang vẫn dựng tĩnh được. */}
        <Suspense>
          <LoginForm />
        </Suspense>
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
