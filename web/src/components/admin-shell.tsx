import { ConsoleArea, ConsoleShell } from "@/components/console-shell";

const ADMIN_AREA: ConsoleArea = {
  home: "/admin",
  badge: "ADMIN",
  subtitle: "Quản trị",
  breadcrumb: "Trang quản trị",
  roleLabel: "Quản trị viên",
  nav: [
    { href: "/admin/overview", icon: "monitoring", label: "Tổng quan" },
    { href: "/admin", icon: "garage", label: "Kiểm duyệt xe" },
    { href: "/admin/licenses", icon: "badge", label: "Duyệt GPLX" },
    { href: "/admin/vehicles", icon: "directions_car", label: "Quản lý xe" },
    { href: "/admin/users", icon: "group", label: "Quản lý người dùng" },
    { href: "/admin/bookings", icon: "receipt_long", label: "Quản lý đơn & Sổ tiền" },
  ],
};

export function AdminShell({ active, title, children }: { active: string; title: string; children: React.ReactNode }) {
  return (
    <ConsoleShell area={ADMIN_AREA} active={active} title={title}>
      {children}
    </ConsoleShell>
  );
}
