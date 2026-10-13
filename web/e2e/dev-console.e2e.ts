import { expect, test } from "@playwright/test";
import { login, logout, SEED } from "./helpers";

test("dev: vào thẳng trang kỹ thuật, xem hiện trạng, nhật ký yêu cầu và lỗi trình duyệt", async ({ page }) => {
  // Một lỗi JavaScript xảy ra trên trình duyệt của khách, trước khi dev đăng nhập.
  const message = `Lỗi thử E2E ${Date.now()} <b>không phải HTML</b>`;
  await page.goto("/cars");
  const reported = page.waitForResponse((res) => res.url().endsWith("/api/client-logs"));
  await page.evaluate((text) => {
    setTimeout(() => {
      throw new Error(text);
    }, 0);
  }, message);
  expect((await reported).status()).toBe(204);

  await login(page, SEED.dev);
  await expect(page).toHaveURL(/\/dev$/);
  for (const panel of ["Máy chủ", "Backend (API)", "Frontend (Web)", "Cơ sở dữ liệu"]) {
    await expect(page.getByRole("heading", { name: panel })).toBeVisible();
  }
  await expect(page.getByRole("cell", { name: "bookings", exact: true })).toBeVisible();
  // Biểu đồ cần ít nhất hai mẫu (API lấy mẫu mỗi 10 giây), nên chờ lâu hơn mặc định.
  await expect(page.getByRole("img", { name: /^Lưu lượng yêu cầu/ })).toBeVisible({ timeout: 40_000 });
  await page.getByRole("button", { name: "5 phút", exact: true }).click();
  await expect(page.getByRole("button", { name: "5 phút", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("link", { name: "Nhật ký yêu cầu" }).first().click();
  await expect(page.getByRole("heading", { name: "Thống kê theo route" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "POST /api/client-logs" }).first()).toBeVisible();
  await page.getByLabel("Lọc theo đường dẫn").fill("/api/khong-co-duong-dan-nay");
  await expect(page.getByText("Chưa có yêu cầu nào khớp bộ lọc.")).toBeVisible();

  await page.getByRole("link", { name: "Console log" }).first().click();
  await page.getByRole("tab", { name: "Trình duyệt người dùng" }).click();
  // Nội dung hiện đúng nguyên văn dạng chữ, thẻ <b> không được dựng thành HTML.
  await expect(page.locator("pre", { hasText: message }).first()).toBeVisible();
  expect(await page.locator("pre b").count()).toBe(0);
});

test("dev không vào được khu quản trị, admin không vào được khu kỹ thuật", async ({ page }) => {
  await login(page, SEED.dev);
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/localhost:3000\/$/);

  await logout(page);
  await login(page, SEED.admin);
  await page.goto("/dev");
  await expect(page).toHaveURL(/localhost:3000\/$/);
});

test("dev xem dữ liệu bảng users: đọc được dữ liệu thường, cột bí mật bị che", async ({ page }) => {
  await login(page, SEED.dev);
  await page.getByRole("link", { name: "Cơ sở dữ liệu" }).first().click();
  await page.getByRole("navigation", { name: "Các bảng" }).getByRole("button", { name: /^users/ }).click();

  await page.getByLabel("Cột để lọc").selectOption("email");
  await page.getByLabel("Giá trị cần lọc").fill(SEED.admin);
  await page.getByRole("button", { name: "Lọc", exact: true }).click();

  const row = page.locator("tbody tr");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(SEED.admin);
  await expect(row).toContainText("đã che");
  await expect(page.locator("body")).not.toContainText("$argon2");
  // Cột bí mật không có trong danh sách cột lọc được.
  await expect(page.getByLabel("Cột để lọc").locator("option", { hasText: "password_hash" })).toHaveCount(0);
});
