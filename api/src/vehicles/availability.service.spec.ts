import { monthWindow } from "./availability.service";

describe("monthWindow (tháng tính theo giờ Việt Nam, UTC+7)", () => {
  it("tháng 10/2026 bắt đầu lúc 00:00 ngày 1/10 giờ Việt Nam", () => {
    const window = monthWindow("2026-10");
    expect(window.month).toBe("2026-10");
    expect(window.from.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(window.to.toISOString()).toBe("2026-10-31T17:00:00.000Z");
  });

  it("tháng 12 kết thúc ở đầu năm sau", () => {
    const window = monthWindow("2026-12");
    expect(window.from.toISOString()).toBe("2026-11-30T17:00:00.000Z");
    expect(window.to.toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });

  it("tháng 2 năm nhuận có 29 ngày", () => {
    const window = monthWindow("2028-02");
    expect((window.to.getTime() - window.from.getTime()) / 86_400_000).toBe(29);
  });

  it("mặc định là tháng hiện tại theo giờ Việt Nam, không phải theo UTC", () => {
    // 18:00 UTC ngày 31/10 là 01:00 ngày 1/11 ở Việt Nam
    expect(monthWindow(undefined, new Date("2026-10-31T18:00:00Z")).month).toBe("2026-11");
    expect(monthWindow(undefined, new Date("2026-10-31T16:59:00Z")).month).toBe("2026-10");
  });
});
