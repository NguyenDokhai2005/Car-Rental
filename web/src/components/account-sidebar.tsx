"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";
import { useAuth } from "@/lib/auth/auth-context";

const ITEMS = [
  { href: "/bookings", icon: "receipt_long", label: "Đơn của tôi" },
  { href: "/verify-license", icon: "badge", label: "Giấy phép lái xe" },
  { href: "/profile", icon: "account_circle", label: "Hồ sơ cá nhân" },
  { href: "/cars", icon: "search", label: "Tìm xe" },
  { href: "/support", icon: "support_agent", label: "Hỗ trợ" },
];

export function AccountSidebar({ active }: { active: string }) {
  const { logout } = useAuth();
  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-space-sm lg:sticky lg:top-24 lg:flex">
      <p className="px-space-md text-label-sm tracking-widest text-on-surface-variant uppercase">Quản lý tài khoản</p>
      <nav aria-label="Tài khoản" className="flex flex-col gap-1">
        {ITEMS.map((item) => {
          const current = item.href === active;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={`flex items-center gap-space-sm rounded-xl px-space-md py-2.5 text-label-lg transition-colors ${
                current ? "bg-primary-container text-on-primary shadow-sm" : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              }`}
            >
              <Icon name={item.icon} className="!text-[20px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={() => void logout()}
        className="mt-space-md flex items-center gap-space-sm rounded-xl px-space-md py-2.5 text-label-lg text-error transition-colors hover:bg-error-container"
      >
        <Icon name="logout" className="!text-[20px]" />
        Đăng xuất
      </button>
    </aside>
  );
}
