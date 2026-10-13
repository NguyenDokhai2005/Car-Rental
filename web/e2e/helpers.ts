import path from "node:path";
import { expect, Locator, Page } from "@playwright/test";

export const PASSWORD = "Password123!";

// Tài khoản do `prisma db seed` tạo.
export const SEED = {
  renter: "khach.an@carrental.test",
  owner: "chuxe.tran@carrental.test",
  admin: "admin@carrental.test",
  dev: "dev@carrental.test",
};

export const FIXTURES = path.join(__dirname, "fixtures");

export async function login(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(password);
  await page.getByRole("button", { name: /Đăng nhập ngay/ }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function logout(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/");
}

// Email chưa từng dùng, để mỗi lần chạy tạo được tài khoản mới mà không đụng dữ liệu của lần trước.
export function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@e2e.test`;
}

// Khoảng ngày thuê ở tương lai xa, chọn ngẫu nhiên, để các lần chạy không đặt trùng lịch của nhau.
// Trả về giá trị cho ô datetime-local (giờ Việt Nam).
export function farFutureRange(): { start: string; end: string } {
  const start = new Date(Date.now() + (60 + Math.floor(Math.random() * 280)) * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000);
  const day = (date: Date) => date.toISOString().slice(0, 10);
  return { start: `${day(start)}T08:00`, end: `${day(end)}T08:00` };
}

// Thông báo lỗi của trang. Next luôn có sẵn một vùng role="alert" rỗng để đọc tên trang cho trình đọc màn hình, nên phải loại nó ra.
export function alertBox(page: Page): Locator {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}
