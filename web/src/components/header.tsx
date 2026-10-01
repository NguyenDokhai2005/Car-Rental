import Link from "next/link";
import { Logo } from "@/components/logo";

type NavItem = { href: string; label: string };

const GUEST_NAV: NavItem[] = [
  { href: "/cars", label: "Tìm xe" },
  { href: "/owner", label: "Cho thuê xe của bạn" },
  { href: "/support", label: "Hỗ trợ" },
];

const RENTER_NAV: NavItem[] = [
  { href: "/cars", label: "Tìm xe" },
  { href: "/bookings", label: "Đơn của tôi" },
  { href: "/support", label: "Hỗ trợ" },
];

const OWNER_NAV: NavItem[] = [
  { href: "/owner", label: "Tổng quan" },
  { href: "/owner/new", label: "Đăng xe" },
  { href: "/support", label: "Hỗ trợ" },
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <header className="flex h-[72px] w-full items-center justify-center border-b border-line bg-white">
      <div className="flex h-[72px] w-full max-w-page items-center justify-between px-6">
        {children}
      </div>
    </header>
  );
}

function Nav({ items, active }: { items: NavItem[]; active?: string }) {
  return (
    <nav className="flex gap-8 text-[15px] font-medium text-ink">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={item.href === active ? "text-primary" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function Header() {
  return (
    <Shell>
      <Logo />
      <Nav items={GUEST_NAV} />
      <div className="flex items-center gap-4 text-[15px] font-semibold">
        <Link href="/login" className="text-primary">
          Đăng nhập
        </Link>
        <Link
          href="/register"
          className="flex h-10 items-center justify-center rounded-[10px] bg-primary px-5 text-white"
        >
          Đăng ký
        </Link>
      </div>
    </Shell>
  );
}

// Tên và avatar là dữ liệu mẫu cho tới khi có phiên đăng nhập.
export function HeaderLoggedIn({
  variant = "renter",
  active,
}: {
  variant?: "renter" | "owner" | "minimal";
  active?: string;
}) {
  const isOwner = variant === "owner";
  return (
    <Shell>
      <Logo />
      {variant !== "minimal" && <Nav items={isOwner ? OWNER_NAV : RENTER_NAV} active={active} />}
      <div className="flex items-center gap-3">
        <span className="text-[15px] font-semibold text-ink">
          {isOwner ? "[Tên chủ xe]" : "[Tên người dùng]"}
        </span>
        <span className="flex size-10 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary">
          {isOwner ? "CX" : "NA"}
        </span>
      </div>
    </Shell>
  );
}
