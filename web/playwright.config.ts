import { defineConfig } from "@playwright/test";

// Test E2E chạy trên trình duyệt thật, đi qua cả web lẫn API và CSDL.
// Cần: CSDL đang chạy và đã seed (docker compose up -d db; pnpm --filter api prisma db seed).
// Chạy: pnpm --filter web e2e
//
// Playwright tự khởi động API, vì bộ test đăng nhập nhiều lần liên tiếp và sẽ vượt giới hạn 5 lần đăng nhập mỗi phút:
// API phải chạy với THROTTLE_DISABLED=1. Không dùng lại API của `pnpm dev`, vì `nest --watch` làm rơi biến môi trường này
// mỗi khi tự khởi động lại. Vì vậy hãy TẮT `pnpm dev` trước khi chạy E2E (cổng 4000 phải trống); web thì dùng lại được.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  // Các luồng dùng chung dữ liệu (đơn, hồ sơ GPLX), nên chạy lần lượt để kết quả không phụ thuộc thứ tự ngẫu nhiên.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    // Dùng Chrome đã cài trên máy: không phải tải thêm trình duyệt của Playwright.
    channel: "chrome",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npx nest start",
      cwd: "../api",
      url: "http://localhost:4000/api/health",
      env: { THROTTLE_DISABLED: "1" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npx next dev",
      url: "http://localhost:3000/login",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
