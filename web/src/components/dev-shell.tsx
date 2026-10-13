import { ConsoleArea, ConsoleShell } from "@/components/console-shell";

const DEV_AREA: ConsoleArea = {
  home: "/dev",
  badge: "DEV",
  subtitle: "Kỹ thuật",
  breadcrumb: "Trang kỹ thuật",
  roleLabel: "Kỹ thuật viên",
  nav: [
    { href: "/dev", icon: "monitor_heart", label: "Hiện trạng hệ thống" },
    { href: "/dev/requests", icon: "swap_vert", label: "Nhật ký yêu cầu" },
    { href: "/dev/logs", icon: "terminal", label: "Console log" },
    { href: "/dev/database", icon: "database", label: "Cơ sở dữ liệu" },
  ],
};

export function DevShell({ active, title, children }: { active: string; title: string; children: React.ReactNode }) {
  return (
    <ConsoleShell area={DEV_AREA} active={active} title={title}>
      {children}
    </ConsoleShell>
  );
}
