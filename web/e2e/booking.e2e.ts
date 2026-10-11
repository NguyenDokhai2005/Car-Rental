import { expect, Page, test } from "@playwright/test";
import { alertBox, farFutureRange, login, logout, PASSWORD, SEED } from "./helpers";

const OWNER_EMAILS: Record<string, string> = {
  "Trần Minh Chủ": "chuxe.tran@carrental.test",
  "Lê Hoàng Xe": "chuxe.le@carrental.test",
};

// "2027-03-01T08:00" thành "01/03/2027, 08:00", đúng cách trang web hiện giờ nhận xe.
function shown(input: string): string {
  const [date, time] = input.split("T");
  return `${date.split("-").reverse().join("/")}, ${time}`;
}

async function loginRaw(page: Page, email: string) {
  await page.goto("/login");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(PASSWORD);
  await page.getByRole("button", { name: /Đăng nhập ngay/ }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("đặt xe: thanh toán hỏng rồi thành công, chủ xe duyệt, khách hủy và được hoàn tiền", async ({ page }) => {
  const range = farFutureRange();

  // Khách chọn xe và giữ chỗ.
  await login(page, SEED.renter);
  await page.goto("/cars");
  await page.locator("article").first().getByRole("link", { name: "Xem chi tiết" }).click();
  await expect(page).toHaveURL(/\/cars\/[0-9a-f-]{36}/);
  const ownerName = (await page.getByText(/^Chủ xe: /).innerText()).replace("Chủ xe: ", "").trim();
  const ownerEmail = OWNER_EMAILS[ownerName];
  expect(ownerEmail, `chưa biết email của chủ xe "${ownerName}" trong dữ liệu seed`).toBeTruthy();

  await page.locator('input[type="datetime-local"]').nth(0).fill(range.start);
  await page.locator('input[type="datetime-local"]').nth(1).fill(range.end);
  await expect(page.getByText("Thanh toán khi đặt")).toBeVisible();
  await page.getByRole("button", { name: "Đặt xe", exact: true }).click();
  await expect(page).toHaveURL(/\/checkout\?booking=[0-9a-f-]{36}/);
  const bookingId = new URL(page.url()).searchParams.get("booking") as string;
  await expect(page.getByRole("timer")).toContainText("Xe được giữ cho bạn");

  // Thanh toán thất bại: ở lại trang, đơn chưa được ghi nhận.
  const payButton = page.getByRole("button", { name: /Thanh toán \d/ });
  await page.locator('input[type="checkbox"]').check();
  await page.getByLabel(/Không đủ số dư/).check();
  await payButton.click();
  await expect(alertBox(page)).toContainText("không đủ số dư");
  await expect(page).toHaveURL(/\/checkout\?booking=/);

  // Thử lại với kịch bản thành công.
  await page.getByLabel(/^Thành công/).check();
  await payButton.click();
  await expect(page).toHaveURL(new RegExp(`/checkout/result\\?booking=${bookingId}`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Thanh toán thành công");
  await expect(page.getByText("Đang chờ", { exact: true })).toBeVisible();

  // Chủ xe thấy đơn và chấp nhận.
  await logout(page);
  await loginRaw(page, ownerEmail);
  await expect(page).toHaveURL(/\/owner$/);
  const request = page.locator("article").filter({ hasText: shown(range.start) });
  await expect(request).toHaveCount(1);
  await request.getByRole("button", { name: /Chấp nhận đơn/ }).click();
  await expect(request.getByText("Đã xác nhận")).toBeVisible();

  // Khách thấy đơn đã được xác nhận, rồi hủy (còn xa ngày nhận xe nên được hoàn đủ).
  await logout(page);
  await login(page, SEED.renter);
  await page.goto(`/bookings/${bookingId}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Đơn thuê xe #");
  await expect(page.getByText("Đã xác nhận").first()).toBeVisible();

  await page.getByRole("button", { name: /Hủy đơn/ }).click();
  await expect(page.getByText(/Nếu hủy ngay bây giờ, bạn được hoàn/)).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận hủy" }).click();
  await expect(page.getByText("Đã hủy").first()).toBeVisible();
  await expect(page.getByText("Đã hoàn cho bạn")).toBeVisible();
});

test("mở thẳng trang kết quả của đơn chưa thanh toán: không báo thành công", async ({ page }) => {
  const range = farFutureRange();
  await login(page, SEED.renter);
  await page.goto("/cars");
  await page.locator("article").first().getByRole("link", { name: "Xem chi tiết" }).click();
  await page.locator('input[type="datetime-local"]').nth(0).fill(range.start);
  await page.locator('input[type="datetime-local"]').nth(1).fill(range.end);
  await page.getByRole("button", { name: "Đặt xe", exact: true }).click();
  await expect(page).toHaveURL(/\/checkout\?booking=/);
  const bookingId = new URL(page.url()).searchParams.get("booking") as string;

  await page.goto(`/checkout/result?booking=${bookingId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chưa ghi nhận thanh toán");

  // Dọn: hủy đơn giữ chỗ để lần chạy sau không vướng giới hạn số đơn đang chờ.
  await page.goto(`/bookings/${bookingId}`);
  await page.getByRole("button", { name: /Hủy đơn/ }).click();
  await page.getByRole("button", { name: "Xác nhận hủy" }).click();
  await expect(page.getByText("Đã hủy").first()).toBeVisible();
});
