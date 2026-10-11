import path from "node:path";
import { expect, Page, test } from "@playwright/test";
import { alertBox, FIXTURES, login, logout, PASSWORD, SEED, uniqueEmail } from "./helpers";

async function register(page: Page, email: string, fullName: string) {
  await page.goto("/register");
  await page.locator("input[name=fullName]").fill(fullName);
  await page.locator("input[name=phone]").fill("0912345678");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(PASSWORD);
  await page.locator("input[name=confirmPassword]").fill(PASSWORD);
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: /Đăng ký tài khoản/ }).click();
  await expect(page).not.toHaveURL(/\/register/);
}

async function loginWith(page: Page, email: string) {
  await page.goto("/login");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(PASSWORD);
  await page.getByRole("button", { name: /Đăng nhập ngay/ }).click();
}

test("khách mới: chưa đặt được xe → gửi GPLX → admin từ chối → gửi lại → admin duyệt", async ({ page }) => {
  const email = uniqueEmail("gplx");
  const name = `Khách GPLX ${Date.now() % 100000}`;
  await register(page, email, name);

  // Chưa xác minh: bấm đặt xe bị chặn và được dẫn tới trang xác minh.
  await page.goto("/cars");
  await page.locator("article").first().getByRole("link", { name: "Xem chi tiết" }).click();
  await page.locator('input[type="datetime-local"]').nth(0).fill("2027-06-01T08:00");
  await page.locator('input[type="datetime-local"]').nth(1).fill("2027-06-02T08:00");
  await page.getByRole("button", { name: "Đặt xe", exact: true }).click();
  await expect(alertBox(page)).toContainText("xác minh giấy phép lái xe");
  await alertBox(page).getByRole("link", { name: "Xác minh giấy phép lái xe" }).click();
  await expect(page).toHaveURL(/\/verify-license/);

  async function submit(licenseNumber: string) {
    await page.locator("input[name=licenseNumber]").fill(licenseNumber);
    await page.locator("input[name=licenseExpiresOn]").fill("2032-10-15");
    await page.locator('input[type="file"]').nth(0).setInputFiles(path.join(FIXTURES, "gplx-front.jpg"));
    await page.locator('input[type="file"]').nth(1).setInputFiles(path.join(FIXTURES, "gplx-back.jpg"));
    await page.locator('form input[type="checkbox"]').check();
    await page.getByRole("button", { name: /Gửi xác minh/ }).click();
    await expect(page.getByText("Đang chờ duyệt")).toBeVisible();
  }

  // Số GPLX sai bị báo ngay tại trình duyệt, không gửi đi.
  await page.locator("input[name=licenseNumber]").fill("123");
  await page.locator("input[name=licenseExpiresOn]").fill("2032-10-15");
  await page.locator('input[type="file"]').nth(0).setInputFiles(path.join(FIXTURES, "gplx-front.jpg"));
  await page.locator('form input[type="checkbox"]').check();
  await page.getByRole("button", { name: /Gửi xác minh/ }).click();
  await expect(alertBox(page)).toHaveText("Số giấy phép lái xe gồm đúng 12 chữ số.");

  await submit("790123456789");
  await expect(page.getByRole("img", { name: "Mặt trước GPLX" })).toBeVisible();

  // Admin từ chối kèm lý do.
  await logout(page);
  await login(page, SEED.admin);
  await page.goto("/admin/licenses");
  await page.getByRole("button", { name: new RegExp(email.replace(/\./g, "\\.")) }).click();
  await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  await expect(page.getByRole("img", { name: new RegExp(`Mặt trước giấy phép của ${name}`) })).toBeVisible();
  await page.getByPlaceholder(/ảnh mờ/).fill("Ảnh mờ, không đọc được số giấy phép");
  await page.getByRole("button", { name: /Từ chối/ }).click();
  await expect(page.getByRole("button", { name: new RegExp(email.replace(/\./g, "\\.")) })).toHaveCount(0);

  // Khách thấy lý do và gửi lại.
  await logout(page);
  await loginWith(page, email);
  await page.goto("/verify-license");
  await expect(page.getByText("Bị từ chối").first()).toBeVisible();
  await expect(alertBox(page)).toContainText("Ảnh mờ, không đọc được số giấy phép");
  await submit("790123456780");

  // Admin duyệt lần hai.
  await logout(page);
  await login(page, SEED.admin);
  await page.goto("/admin/licenses");
  await page.getByRole("button", { name: new RegExp(email.replace(/\./g, "\\.")) }).click();
  await expect(page.getByText("790123456780")).toBeVisible();
  for (const box of await page.locator("fieldset").getByRole("checkbox").all()) await box.check();
  await page.getByRole("button", { name: /Duyệt hồ sơ/ }).click();
  await expect(page.getByRole("button", { name: new RegExp(email.replace(/\./g, "\\.")) })).toHaveCount(0);

  // Khách đã được xác minh: thanh đầu trang đổi nhãn và nút đặt xe không còn bị chặn.
  await logout(page);
  await loginWith(page, email);
  await page.goto("/verify-license");
  await expect(page.getByText("Đã xác minh").first()).toBeVisible();
  await expect(page.getByText("Đã xác minh GPLX")).toBeVisible();
});

test("admin khóa tài khoản: người bị khóa không đăng nhập được, mở khóa thì vào lại được", async ({ page }) => {
  const email = uniqueEmail("khoa");
  await register(page, email, "Khách Bị Khóa");
  await logout(page);

  await login(page, SEED.admin);
  await page.goto("/admin/users");
  await page.getByLabel("Tìm người dùng").fill(email);
  await page.getByRole("button", { name: "Tìm" }).click();
  const row = page.locator("tbody tr").filter({ hasText: email });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Khóa" }).click();
  await row.getByRole("button", { name: "Xác nhận khóa" }).click();
  await expect(row.getByText("Bị khóa")).toBeVisible();

  await logout(page);
  await loginWith(page, email);
  await expect(alertBox(page)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  await login(page, SEED.admin);
  await page.goto("/admin/users");
  await page.getByLabel("Tìm người dùng").fill(email);
  await page.getByRole("button", { name: "Tìm" }).click();
  await row.getByRole("button", { name: /Mở khóa/ }).click();
  await expect(row.getByText("Hoạt động")).toBeVisible();

  await logout(page);
  await loginWith(page, email);
  await expect(page).not.toHaveURL(/\/login/);
});

test("khách thuê không vào được khu quản trị và khu chủ xe", async ({ page }) => {
  await login(page, SEED.renter);
  for (const url of ["/admin", "/admin/users", "/admin/licenses", "/owner", "/owner/earnings"]) {
    await page.goto(url);
    await expect(page).toHaveURL(/\/$/);
  }
});
