"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { useAuth } from "@/lib/auth/auth-context";
import { loginHref } from "@/lib/auth/redirect";
import type { Role } from "@/lib/auth/types";

type NavItem = { href: string; label: string };

const GUEST_NAV: NavItem[] = [
  { href: "/cars", label: "Tìm xe" },
  { href: "/owner", label: "Cho thuê xe của bạn" },
  { href: "/support", label: "Hỗ trợ" },
];

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  renter: [
    { href: "/cars", label: "Tìm xe" },
    { href: "/bookings", label: "Đơn của tôi" },
    { href: "/support", label: "Hỗ trợ" },
  ],
  owner: [
    { href: "/owner", label: "Tổng quan" },
    { href: "/owner/new", label: "Đăng xe" },
    { href: "/support", label: "Hỗ trợ" },
  ],
  admin: [
    { href: "/admin", label: "Quản trị" },
    { href: "/support", label: "Hỗ trợ" },
  ],
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <header className="flex h-[72px] w-full items-center justify-center border-b border-line bg-white">
      <div className="flex h-[72px] w-full max-w-page items-center justify-between px-6">{children}</div>
    </header>
  );
}

function Nav({ items, active }: { items: NavItem[]; active?: string }) {
  return (
    <nav className="flex gap-8 text-[15px] font-medium text-ink">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={item.href === active ? "text-primary" : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const last = words[words.length - 1];
  const first = words.length > 1 ? words[0] : "";
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

// Một thanh đầu trang cho mọi trạng thái: khách, khách thuê, chủ xe, quản trị viên.
// `minimal` giấu menu (trang xác minh GPLX chỉ cần logo và người dùng).
export function Header({ active, minimal = false }: { active?: string; minimal?: boolean }) {
  const { status, user, logout } = useAuth();
  const pathname = usePathname();

  if (status === "authenticated") {
    return (
      <Shell>
        <Logo />
        {!minimal && <Nav items={NAV_BY_ROLE[user.role]} active={active} />}
        <div className="flex items-center gap-3">
          <span className="text-[15px] font-semibold text-ink">{user.fullName}</span>
          <span
            aria-hidden
            className="flex size-10 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary"
          >
            {initials(user.fullName)}
          </span>
          <button
            type="button"
            onClick={() => void logout()}
            className="text-[15px] font-semibold text-primary"
          >
            Đăng xuất
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Logo />
      {!minimal && <Nav items={GUEST_NAV} />}
      {/* Trong lúc khôi phục phiên, giữ chỗ để thanh đầu trang không nhảy từ "Đăng nhập" sang tên người dùng. */}
      <div className="flex items-center gap-4 text-[15px] font-semibold" aria-busy={status === "loading"}>
        {status === "anonymous" && (
          <>
            <Link href={loginHref(pathname)} className="text-primary">
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="flex h-10 items-center justify-center rounded-[10px] bg-primary px-5 text-white"
            >
              Đăng ký
            </Link>
          </>
        )}
      </div>
    </Shell>
  );
}
