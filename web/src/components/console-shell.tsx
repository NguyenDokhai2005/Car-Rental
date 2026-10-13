"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { useAuth } from "@/lib/auth/auth-context";

export type ConsoleNavItem = { href: string; icon: string; label: string };

export type ConsoleArea = {
  home: string;
  badge: string;
  subtitle: string;
  breadcrumb: string;
  roleLabel: string;
  nav: ConsoleNavItem[];
};

// Khung của các khu nội bộ (quản trị, kỹ thuật): thanh bên và thanh trên riêng, không dùng thanh đầu trang chung của khách.
export function ConsoleShell({ area, active, title, children }: { area: ConsoleArea; active: string; title: string; children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col gap-space-md bg-surface-container-lowest p-space-md shadow-sm lg:flex">
        <Link href={area.home} className="flex items-center gap-space-sm">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-on-primary">
            <Icon name="directions_car" filled />
          </span>
          <span className="flex flex-col">
            <span className="flex items-center gap-space-sm text-title-lg text-on-surface">
              AutoRent
              <span className="rounded bg-primary-fixed px-1.5 py-0.5 text-label-sm text-primary">{area.badge}</span>
            </span>
            <span className="text-label-sm tracking-widest text-on-surface-variant uppercase">{area.subtitle}</span>
          </span>
        </Link>
        <p className="mt-space-sm text-label-sm tracking-widest text-on-surface-variant uppercase">Bảng điều khiển</p>
        <nav aria-label={area.subtitle} className="flex flex-col gap-1">
          {area.nav.map((item) => {
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
          onClick={() => void onLogout()}
          className="mt-auto flex items-center gap-space-sm rounded-xl px-space-md py-2.5 text-label-lg text-error transition-colors hover:bg-error-container"
        >
          <Icon name="logout" className="!text-[20px]" />
          Đăng xuất
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-space-md bg-surface-container-lowest px-margin-sm py-space-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] lg:px-space-lg">
          <nav aria-label="Đường dẫn" className="flex items-center gap-space-sm text-body-md text-on-surface-variant">
            <Icon name="home" className="!text-[18px]" />
            <Link href={area.home} className="hover:text-primary">
              {area.breadcrumb}
            </Link>
            <span>/</span>
            <span className="font-semibold text-on-surface">{title}</span>
          </nav>
          {/* Màn hình hẹp không có thanh bên nên các mục điều hướng nằm ở đây. */}
          <nav aria-label={area.subtitle} className="flex gap-1 lg:hidden">
            {area.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={item.href === active ? "page" : undefined}
                className={`flex size-10 items-center justify-center rounded-xl ${
                  item.href === active ? "bg-primary-container text-on-primary" : "bg-surface-container-low text-on-surface-variant"
                }`}
              >
                <Icon name={item.icon} className="!text-[20px]" />
              </Link>
            ))}
          </nav>
          {user && (
            <p className="flex items-center gap-space-sm text-label-lg text-on-surface">
              {user.fullName}
              <span className="text-label-md text-primary">{area.roleLabel}</span>
              <button type="button" onClick={() => void onLogout()} className="text-label-md text-error hover:underline lg:hidden">
                Đăng xuất
              </button>
            </p>
          )}
        </header>
        <main className="flex min-w-0 flex-1 flex-col gap-gutter p-margin-sm lg:p-space-lg">{children}</main>
      </div>
    </div>
  );
}
