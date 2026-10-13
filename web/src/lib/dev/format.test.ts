import { describe, expect, it } from "vitest";
import { formatLogTime, formatUptime, percent, statusHealth, usageHealth } from "./format";

describe("định dạng của trang kỹ thuật", () => {
  it("giờ nhật ký theo giờ Việt Nam, có giây", () => {
    expect(formatLogTime("2026-10-13T07:03:27.123Z")).toBe("14:03:27 13/10");
    expect(formatLogTime("2026-10-13T18:00:00.000Z")).toBe("01:00:00 14/10");
  });

  it("thời gian chạy", () => {
    expect(formatUptime(42)).toBe("42 giây");
    expect(formatUptime(125)).toBe("2 phút");
    expect(formatUptime(3 * 3600 + 5 * 60)).toBe("3 giờ 5 phút");
    expect(formatUptime(2 * 86400 + 4 * 3600)).toBe("2 ngày 4 giờ");
  });

  it("phần trăm luôn nằm trong 0 đến 100, kể cả khi tổng bằng 0", () => {
    expect(percent(50, 200)).toBe(25);
    expect(percent(300, 200)).toBe(100);
    expect(percent(5, 0)).toBe(0);
  });

  it("ngưỡng cảnh báo", () => {
    expect([usageHealth(10), usageHealth(75), usageHealth(90)]).toEqual(["good", "warn", "bad"]);
    expect([statusHealth(204), statusHealth(404), statusHealth(500)]).toEqual(["good", "warn", "bad"]);
  });
});
