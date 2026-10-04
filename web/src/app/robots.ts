import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/server/api";

// Khu cần đăng nhập và các trang tài khoản không có gì để công cụ tìm kiếm lập chỉ mục.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/owner", "/admin", "/bookings", "/checkout", "/verify-license", "/login", "/register", "/forgot-password", "/api/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
