import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam-pro",
});

export const metadata: Metadata = {
  title: "Car-Rental — Thuê xe tự lái từ chủ xe",
  description:
    "Chọn xe, đặt lịch và nhận xe nhanh chóng. Giá niêm yết rõ ràng trước khi đặt.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={beVietnamPro.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
