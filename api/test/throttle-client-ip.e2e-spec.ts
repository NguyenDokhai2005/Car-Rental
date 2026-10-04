import request from "supertest";
import type { TestContext } from "./helpers";

// Hợp đồng mà máy chủ web dựa vào (web/src/lib/server/api.ts): ở production API đứng sau proxy, tin đúng MỘT tầng proxy và
// tính hạn mức theo địa chỉ ngoài cùng bên phải của X-Forwarded-For (địa chỉ Nginx vừa ghi). Nhờ vậy:
//  - mỗi khách có hạn mức riêng, thay vì cả website dùng chung hạn mức của IP máy chủ web;
//  - khách không giả mạo được bằng cách tự gửi X-Forwarded-For (giá trị giả nằm bên trái, không được tin).
describe("Giới hạn tốc độ theo địa chỉ khách thật (production)", () => {
  let ctx: TestContext;
  const previous = { NODE_ENV: process.env.NODE_ENV, THROTTLE_DISABLED: process.env.THROTTLE_DISABLED };
  const LIMIT = 120; // hạn mức mặc định theo IP, xem ThrottlerModule trong app.module.ts

  beforeAll(async () => {
    process.env.NODE_ENV = "production"; // bật "trust proxy" như trên server thật
    process.env.THROTTLE_DISABLED = "0"; // các test khác tắt giới hạn tốc độ, test này cần nó
    // Nạp ứng dụng SAU khi đặt biến môi trường: ConfigModule đọc NODE_ENV ngay lúc app.module được nạp, nên import tĩnh
    // ở đầu file sẽ chốt NODE_ENV=test và trust proxy không bao giờ được bật.
    const { createTestApp } = await import("./helpers");
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
    process.env.NODE_ENV = previous.NODE_ENV;
    process.env.THROTTLE_DISABLED = previous.THROTTLE_DISABLED;
  });

  const get = (forwardedFor: string) =>
    request(ctx.app.getHttpServer()).get("/api/vehicles?limit=1").set("X-Forwarded-For", forwardedFor);

  it("mỗi khách một hạn mức: khách A hết lượt thì khách B vẫn dùng được; giả mạo header không né được", async () => {
    for (let i = 0; i < LIMIT; i += 1) {
      expect((await get("203.0.113.1")).status).toBe(200);
    }
    expect((await get("203.0.113.1")).status).toBe(429);

    // Khách khác (địa chỉ khác) không bị ảnh hưởng.
    expect((await get("203.0.113.2")).status).toBe(200);

    // Khách A thêm một địa chỉ giả ở bên trái để giả làm người khác: địa chỉ thật (ngoài cùng bên phải) vẫn là A, vẫn bị chặn.
    expect((await get("198.51.100.99, 203.0.113.1")).status).toBe(429);

    // Ngược lại, địa chỉ giả không làm khách B bị tính vào hạn mức của A.
    expect((await get("203.0.113.1, 203.0.113.2")).status).toBe(200);
  }, 60_000);
});
