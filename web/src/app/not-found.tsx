import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Icon } from "@/components/icon";
import { pageTitle } from "@/lib/brand";

export const metadata = { title: pageTitle("Không tìm thấy trang") };

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-page flex-col items-center gap-6 px-4 py-20 text-center lg:px-8">
        <span className="flex size-20 items-center justify-center rounded-full bg-surface-low text-primary-strong">
          <Icon name="wrong_location" className="!text-[40px]" />
        </span>
        <span className="rounded-full bg-surface-low px-4 py-1 text-xs font-semibold tracking-[0.02em] text-on-surface-variant">
          Mã lỗi: 404
        </span>
        <h1 className="text-[32px] leading-10 font-bold tracking-tight text-on-surface">Không tìm thấy trang</h1>
        <p className="max-w-xl text-base leading-6 text-on-surface-variant">
          Trang này không tồn tại hoặc xe đã ngừng hiển thị. Bạn có thể tìm xe khác hoặc quay về trang chủ.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/cars"
            className="flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-container"
          >
            <Icon name="search" className="!text-[18px]" />
            Tìm xe
          </Link>
          <Link
            href="/"
            className="flex h-12 items-center rounded-xl border border-line bg-white px-6 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-low"
          >
            Quay về Trang chủ
          </Link>
        </div>
        <Link href="/support" className="text-sm font-semibold text-primary-strong hover:underline">
          Cần hỗ trợ? Mở trung tâm hỗ trợ
        </Link>
      </main>
      <Footer />
    </>
  );
}
