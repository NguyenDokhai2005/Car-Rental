import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/server/api";
import { searchVehicles } from "@/lib/vehicles/public";

// Lấy xe lúc có người (hoặc công cụ tìm kiếm) yêu cầu. Không dựng sẵn lúc build vì khi build chưa có API.
export const dynamic = "force-dynamic";

const MAX_PAGES = 20; // 20 trang x 50 xe = 1000 xe, quá đủ cho MVP; sitemap cho phép tối đa 50.000 đường dẫn

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/cars`, changeFrequency: "daily", priority: 0.9 },
  ];

  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await searchVehicles(new URLSearchParams({ page: String(page), limit: "50" }));
      for (const car of result.items) {
        pages.push({ url: `${base}/cars/${car.id}`, changeFrequency: "weekly", priority: 0.7 });
      }
      if (page * result.limit >= result.total) break;
    }
  } catch {
    // API tạm thời không trả lời: vẫn trả về sitemap với các trang tĩnh thay vì lỗi 500 cho công cụ tìm kiếm.
  }
  return pages;
}
