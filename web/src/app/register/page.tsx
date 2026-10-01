import Image from "next/image";
import { Logo } from "@/components/logo";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Đăng ký — Car-Rental" };

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen bg-white">
      <div className="flex min-w-0 flex-1 flex-col px-24 py-10">
        <Logo />
        <div className="flex flex-1 items-center">
          <RegisterForm />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-6 bg-primary-50 p-16">
        <div className="flex h-[360px] w-[480px] flex-col items-center justify-center gap-2.5 rounded-3xl bg-primary-100">
          <Image src="/icons/hero-car.svg" alt="" width={72} height={72} />
          <p className="text-sm font-medium text-primary">[Ảnh minh họa]</p>
        </div>
        <p className="w-[420px] text-center text-2xl leading-[34px] font-semibold text-ink">
          Một tài khoản cho cả việc thuê và cho thuê xe
        </p>
      </div>
    </div>
  );
}
