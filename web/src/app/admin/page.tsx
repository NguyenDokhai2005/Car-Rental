import Link from "next/link";
import { AdminAccount } from "./admin-account";
import { AdminReview } from "./admin-review";

export const metadata = { title: "Duyệt xe và người dùng — Quản trị" };

const NAV = [
  { label: "Chờ duyệt", href: "/admin", active: true },
  { label: "Tất cả xe" },
  { label: "Người dùng" },
  { label: "Đơn thuê" },
  { label: "Thanh toán" },
];

export default function AdminPage() {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col gap-6 bg-ink p-5">
        <Link href="/admin" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path d="M5 13l1.5-4.5A2 2 0 018.4 7h5.2a2 2 0 011.9 1.5L17 13M4 13h14v4H4z" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-lg font-bold text-white">Quản trị</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className={`rounded-[10px] px-3.5 py-3 text-[15px] font-semibold ${
                  item.active ? "bg-[#1b2f5a] text-white" : "text-footer-text"
                }`}
              >
                {item.label}
              </Link>
            ) : (
              <span key={item.label} className="rounded-[10px] px-3.5 py-3 text-[15px] text-footer-text">
                {item.label}
              </span>
            ),
          )}
        </nav>
        <AdminAccount />
      </aside>
      <main className="min-w-0 flex-1 p-10">
        <AdminReview />
      </main>
    </div>
  );
}
