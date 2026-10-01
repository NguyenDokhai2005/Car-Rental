import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

// Trang giữ chỗ cho route chưa có thiết kế; thay bằng màn hình thật khi có.
export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <Header />
      <main className="flex min-h-[480px] flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-[32px] font-bold text-ink">{title}</h1>
        <p className="text-[15px] text-muted">Màn hình này đang được thiết kế.</p>
        <Link
          href="/"
          className="flex h-12 items-center rounded-xl bg-primary px-6 text-[15px] font-semibold text-white"
        >
          Về trang chủ
        </Link>
      </main>
      <Footer />
    </>
  );
}
