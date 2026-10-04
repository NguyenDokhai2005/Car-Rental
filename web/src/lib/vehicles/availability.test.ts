import { describe, expect, it } from "vitest";
import { busyDays, currentMonth, isMonth, monthGrid, shiftMonth } from "./availability";

describe("isMonth", () => {
  it.each(["2026-10", "2026-01", "2026-12"])("nhận %s", (m) => expect(isMonth(m)).toBe(true));
  it.each(["2026-13", "2026-00", "2026-1", "26-10", "2026-10-01", "", undefined])("từ chối %j", (m) =>
    expect(isMonth(m)).toBe(false),
  );
});

describe("currentMonth", () => {
  it("tính theo giờ Việt Nam: 17:00 UTC ngày cuối tháng đã là tháng sau", () => {
    expect(currentMonth(new Date("2026-10-31T16:59:00Z"))).toBe("2026-10");
    expect(currentMonth(new Date("2026-10-31T17:00:00Z"))).toBe("2026-11");
  });
});

describe("shiftMonth", () => {
  it("qua năm", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-10", 0)).toBe("2026-10");
    expect(shiftMonth("2026-10", 14)).toBe("2027-12");
  });
});

describe("monthGrid", () => {
  it("1/10/2026 là thứ Năm: 3 ô trống đầu tháng (thứ Hai là cột đầu); tháng có 31 ngày", () => {
    expect(monthGrid("2026-10")).toEqual({ leadingBlanks: 3, days: 31 });
  });
  it("tháng 2 năm nhuận và không nhuận", () => {
    expect(monthGrid("2028-02").days).toBe(29);
    expect(monthGrid("2027-02").days).toBe(28);
  });
  it("thứ Hai ngày 1 thì không có ô trống", () => {
    expect(monthGrid("2026-06").leadingBlanks).toBe(0); // 1/6/2026 là thứ Hai
  });
});

describe("busyDays", () => {
  it("đánh dấu mọi ngày mà khoảng bận chạm tới (giờ Việt Nam)", () => {
    // 12/10 08:00 đến 14/10 08:00 giờ VN
    const days = busyDays("2026-10", [{ startAt: "2026-10-12T01:00:00Z", endAt: "2026-10-14T01:00:00Z" }]);
    expect([...days]).toEqual([12, 13, 14]);
  });

  it("kết thúc đúng 00:00 ngày kế tiếp thì ngày kế tiếp vẫn trống", () => {
    // đến hết ngày 14 giờ VN (14/10 17:00 UTC = 15/10 00:00 VN)
    const days = busyDays("2026-10", [{ startAt: "2026-10-12T00:00:00+07:00", endAt: "2026-10-15T00:00:00+07:00" }]);
    expect([...days]).toEqual([12, 13, 14]);
  });

  it("khoảng bận bắt đầu trước tháng hoặc kéo dài sang tháng sau", () => {
    const days = busyDays("2026-10", [
      { startAt: "2026-09-29T00:00:00+07:00", endAt: "2026-10-02T00:00:00+07:00" },
      { startAt: "2026-10-30T12:00:00+07:00", endAt: "2026-11-03T00:00:00+07:00" },
    ]);
    expect([...days].sort((a, b) => a - b)).toEqual([1, 30, 31]);
  });

  it("không có khoảng bận thì không có ngày nào", () => {
    expect(busyDays("2026-10", []).size).toBe(0);
  });
});
