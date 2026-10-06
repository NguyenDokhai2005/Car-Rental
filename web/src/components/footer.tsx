import Link from "next/link";
import { Logo } from "@/components/logo";

type FooterLink = { href: string; label: string };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Dòng xe phổ biến",
    links: [
      { href: "/cars?seats=5", label: "Thuê xe 5 chỗ" },
      { href: "/cars?seats=7", label: "Thuê xe 7 chỗ" },
      { href: "/cars?fuel=electric", label: "Xe điện" },
      { href: "/cars?transmission=automatic", label: "Xe số tự động" },
      { href: "/cars?sort=price_asc", label: "Giá thấp trước" },
    ],
  },
  {
    title: "Chính sách & An tâm",
    links: [
      { href: "/terms#dat-xe", label: "Đặt xe và thanh toán" },
      { href: "/terms#huy-don", label: "Hủy đơn & hoàn tiền" },
      { href: "/terms#giao-xe", label: "Giao xe và trả xe" },
      { href: "/verify-license", label: "Xác minh giấy phép lái xe" },
      { href: "/support", label: "Trung tâm hỗ trợ" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="w-full bg-white shadow-[0_-1px_8px_rgba(0,0,0,0.02)]">
      <div className="mx-auto w-full max-w-page px-4 pt-10 pb-6 lg:px-8">
        <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-4">
            <Logo size="sm" />
            <p className="text-sm leading-5 text-on-surface-variant">
              Nền tảng thuê xe tự lái giữa chủ xe và khách thuê. Trả tiền một lần khi đặt, chủ xe chỉ nhận tiền khi cả hai bên
              xác nhận giao xe.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title} className="flex flex-col gap-4">
              <span className="text-lg font-semibold text-on-surface">{column.title}</span>
              <ul className="flex flex-col gap-2 text-sm text-on-surface-variant">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="transition-colors hover:text-primary-strong">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="flex flex-col gap-4">
            <span className="text-lg font-semibold text-on-surface">Thanh toán</span>
            <p className="text-sm leading-5 text-on-surface-variant">
              Trả tiền thuê và tiền cọc một lần khi đặt. Tiền cọc được hoàn khi trả xe.
            </p>
            <div className="flex flex-wrap gap-2">
              {["VNPay", "MoMo"].map((method) => (
                <span key={method} className="rounded-lg bg-surface-low px-4 py-1 text-xs font-semibold tracking-[0.02em] text-on-surface">
                  {method}
                </span>
              ))}
            </div>
            <p className="text-xs text-outline">Đang ở chế độ thử nghiệm, không trừ tiền thật.</p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 pt-6 md:flex-row">
          <p className="text-sm text-outline">© 2026 AutoRent VN · Dự án thử nghiệm.</p>
          <div className="flex items-center gap-6 text-sm text-on-surface-variant">
            <Link href="/terms" className="transition-colors hover:text-primary-strong">
              Điều khoản sử dụng
            </Link>
            <Link href="/support" className="transition-colors hover:text-primary-strong">
              Hỗ trợ
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
