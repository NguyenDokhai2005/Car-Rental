"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";
import { Logo } from "@/components/logo";
import { useAuth } from "@/lib/auth/auth-context";
import { loginHref } from "@/lib/auth/redirect";
import type { AuthUser, Role } from "@/lib/auth/types";

type NavItem = { href: string; label: string };

const GUEST_NAV: NavItem[] = [
  { href: "/cars", label: "Thuê xe tự lái" },
  { href: "/register", label: "Trở thành chủ xe" },
  { href: "/support", label: "Hỗ trợ" },
];

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  renter: [
    { href: "/cars", label: "Thuê xe tự lái" },
    { href: "/bookings", label: "Đơn của tôi" },
    { href: "/verify-license", label: "Giấy phép lái xe" },
    { href: "/support", label: "Hỗ trợ" },
  ],
  owner: [
    { href: "/owner", label: "Tổng quan" },
    { href: "/owner/earnings", label: "Thu nhập" },
    { href: "/owner/new", label: "Đăng xe mới" },
    { href: "/support", label: "Hỗ trợ" },
  ],
  admin: [
    { href: "/admin", label: "Quản trị" },
    { href: "/support", label: "Hỗ trợ" },
  ],
};

const ROLE_LABELS: Record<Role, string> = { renter: "Khách thuê", owner: "Chủ xe", admin: "Quản trị viên" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      <div className="mx-auto flex h-20 w-full max-w-page items-center justify-between gap-6 px-4 lg:px-8">{children}</div>
    </header>
  );
}

function Nav({ items, active }: { items: NavItem[]; active?: string }) {
  return (
    <nav className="hidden items-center gap-1 lg:flex" aria-label="Điều hướng chính">
      {items.map((item) => {
        const current = item.href === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`rounded-lg px-4 py-2 text-sm font-semibold tracking-[0.01em] transition-colors ${
              current ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:bg-surface-low hover:text-on-surface"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
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

function userCaption(user: AuthUser): { text: string; verified: boolean } {
  if (user.role !== "renter") return { text: ROLE_LABELS[user.role], verified: false };
  if (user.licenseStatus === "verified") return { text: "Đã xác minh GPLX", verified: true };
  if (user.licenseStatus === "pending") return { text: "GPLX chờ duyệt", verified: false };
  return { text: "Chưa xác minh GPLX", verified: false };
}

function Brand() {
  return (
    <div className="flex items-center gap-6">
      <Logo />
      <Link
        href="/cars"
        className="hidden items-center rounded-full bg-surface-low px-4 py-1 text-xs font-semibold tracking-[0.02em] text-on-surface transition-colors hover:bg-surface-container xl:flex"
      >
        <Icon name="location_on" className="mr-1 !text-[18px] text-primary-strong" />
        TP. Hồ Chí Minh
      </Link>
    </div>
  );
}

export function Header({ active, minimal = false }: { active?: string; minimal?: boolean }) {
  const { status, user, logout } = useAuth();
  const pathname = usePathname();

  if (status === "authenticated") {
    const caption = userCaption(user);
    return (
      <Shell>
        <Brand />
        {!minimal && <Nav items={NAV_BY_ROLE[user.role]} active={active} />}
        <div className="flex items-center gap-4">
          {user.role === "owner" && (
            <Link
              href="/owner/new"
              className="hidden items-center rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-container sm:inline-flex"
            >
              Đăng xe cho thuê
            </Link>
          )}
          <Link href="/profile" className="flex items-center gap-2.5 rounded-xl px-1 py-1 transition-colors hover:bg-surface-low" aria-label="Hồ sơ cá nhân">
            <span
              aria-hidden
              className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-white"
            >
              {initials(user.fullName)}
            </span>
            <span className="hidden flex-col leading-tight sm:flex">
              <span className="text-sm font-semibold text-on-surface">{user.fullName}</span>
              <span className={`flex items-center gap-1 text-[11px] font-medium ${caption.verified ? "text-success" : "text-outline"}`}>
                {caption.verified && <Icon name="verified" filled className="!text-[13px]" />}
                {caption.text}
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
          >
            Đăng xuất
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Brand />
      {!minimal && <Nav items={GUEST_NAV} active={active} />}
      {/* Trong lúc khôi phục phiên, giữ chỗ để thanh đầu trang không nhảy từ "Đăng nhập" sang tên người dùng. */}
      <div className="flex min-w-[190px] items-center justify-end gap-2 text-sm font-semibold" aria-busy={status === "loading"}>
        {status === "anonymous" && (
          <>
            <Link
              href={loginHref(pathname)}
              className="rounded-lg px-4 py-2 text-primary-strong transition-colors hover:bg-surface-low"
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="flex items-center justify-center rounded-xl bg-primary px-6 py-2 text-white shadow-sm transition-colors hover:bg-primary-container"
            >
              Đăng ký
            </Link>
          </>
        )}
      </div>
    </Shell>
  );
}
