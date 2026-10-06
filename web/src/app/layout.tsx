import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/lib/auth/auth-context";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plus-jakarta-sans",
});

export const metadata: Metadata = {
  title: `${BRAND} — Thuê xe tự lái từ chủ xe`,
  description: "Chọn xe, đặt lịch và nhận xe nhanh chóng. Trả tiền một lần, tiền cọc hoàn khi trả xe.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={plusJakartaSans.variable}>
      <head>
        {/* Font biểu tượng. display=block: chưa tải xong thì để trống thay vì hiện tên biểu tượng dạng chữ. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/google-font-display -- font biểu tượng dùng cho mọi trang; cố ý dùng display=block (xem trên) */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&display=block"
        />
      </head>
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
