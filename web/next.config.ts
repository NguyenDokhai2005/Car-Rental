import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Đóng gói gọn cho Docker (xem web/Dockerfile): chỉ giữ file thật sự cần để chạy.
  output: "standalone",
  // Monorepo: truy vết file từ thư mục gốc để standalone lấy đủ gói dùng chung.
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  // Không báo công nghệ trong header phản hồi.
  poweredByHeader: false,
};

export default nextConfig;
