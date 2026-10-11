import { expect, test } from "@playwright/test";
import { alertBox } from "./helpers";

test.describe("Khách chưa đăng nhập", () => {
  test("trang chủ → tìm kiếm → chi tiết xe", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Thuê Xe Tự Lái");

    await page.goto("/cars");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Thuê xe tự lái");
    const firstCar = page.locator("article").first();
    await expect(firstCar).toBeVisible();
    const title = (await firstCar.getByRole("heading").innerText()).trim();

    await firstCar.getByRole("link", { name: "Xem chi tiết" }).click();
    await expect(page).toHaveURL(/\/cars\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.getByRole("link", { name: "Đăng nhập để đặt xe" })).toBeVisible();
  });

  test("bộ lọc nằm trên URL: tải lại vẫn giữ, bỏ lọc thì URL sạch", async ({ page }) => {
    await page.goto("/cars?seats=5&fuel=petrol");
    await expect(page.getByRole("checkbox", { name: "5 chỗ" })).toBeChecked();
    await expect(page.getByRole("link", { name: "Bỏ lọc Xăng" })).toBeVisible();

    await page.getByRole("link", { name: "Bỏ lọc Xăng" }).click();
    await expect(page).toHaveURL(/seats=5/);
    await expect(page).not.toHaveURL(/fuel=/);
  });

  test("trang cần đăng nhập đưa về /login và nhớ trang đang muốn vào", async ({ page }) => {
    await page.goto("/bookings");
    await expect(page).toHaveURL(/\/login\?next=%2Fbookings/);
  });

  test("đăng nhập sai báo lỗi chung, không lộ email có tồn tại hay không", async ({ page }) => {
    await page.goto("/login");
    await page.locator("input[name=email]").fill("khong-co@e2e.test");
    await page.locator("input[name=password]").fill("Sai-mat-khau-123");
    await page.getByRole("button", { name: /Đăng nhập ngay/ }).click();
    await expect(alertBox(page)).toHaveText("Email hoặc mật khẩu không đúng.");
  });

  test("đường dẫn không tồn tại hiện trang 404 có lối về", async ({ page }) => {
    const response = await page.goto("/duong-dan-khong-co");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Không tìm thấy trang");
    await expect(page.getByRole("link", { name: "Quay về Trang chủ" })).toBeVisible();
  });
});
