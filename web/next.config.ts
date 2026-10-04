import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Đóng gói gọn cho Docker (xem web/Dockerfile): chỉ giữ file thật sự cần để chạy.
  output: "standalone",
  // Monorepo: truy vết file từ thư mục gốc để standalone lấy đủ gói dùng chung.
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  // Cho phép build thử sang thư mục khác (NEXT_DIST_DIR) trong lúc dev server đang dùng .next; mặc định không đổi.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Không báo công nghệ trong header phản hồi.
  poweredByHeader: false,
  // Trình duyệt chỉ nói chuyện với một origin: /api/* được chuyển tiếp tới API. Nhờ vậy cookie làm mới
  // (SameSite=Lax, Path=/api/auth) hoạt động mà không cần CORS. Trên máy chủ thật, Nginx làm việc này trước khi tới Next.
  async rewrites() {
    const api = process.env.API_URL ?? "http://localhost:4000";
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
      // Ảnh đã tải lên: ở dev do API phục vụ, ở server thật Nginx phục vụ trước khi tới Next.
      { source: "/uploads/:path*", destination: `${api}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
