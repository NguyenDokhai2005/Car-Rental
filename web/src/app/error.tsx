"use client";

import Link from "next/link";

// Trang lỗi chung cho lỗi bất ngờ khi render (ví dụ API không trả lời ở trang chi tiết xe).
// Không hiện chi tiết kỹ thuật cho người dùng.
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-[28px] font-bold text-ink">Đã có lỗi xảy ra</h1>
      <p className="max-w-[420px] text-base text-muted">
        Trang này tạm thời chưa tải được. Bạn thử lại sau ít phút nhé.
      </p>
      <div className="flex gap-3">
        <button type="button" onClick={reset} className="h-12 rounded-xl bg-primary px-6 text-[15px] font-semibold text-white">
          Thử lại
        </button>
        <Link href="/" className="flex h-12 items-center rounded-xl border border-[#c5d2e3] bg-white px-6 text-[15px] font-semibold text-ink">
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}
