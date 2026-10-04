import { describe, expect, it } from "vitest";
import { pageWindow, parseFilters, rentalDays, toApiQuery, toUrlQuery, vnToday } from "./search-params";

const TODAY = "2026-10-10";
const parse = (raw: Record<string, string | string[] | undefined>) => parseFilters(raw, TODAY);

describe("vnToday", () => {
  it("tính theo giờ Việt Nam (UTC+7), không theo UTC", () => {
    expect(vnToday(new Date("2026-10-10T16:59:00Z"))).toBe("2026-10-10");
    expect(vnToday(new Date("2026-10-10T17:00:00Z"))).toBe("2026-10-11");
  });
});

describe("rentalDays", () => {
  it("tính cả ngày nhận và ngày trả", () => {
    expect(rentalDays("2026-10-12", "2026-10-12")).toBe(1);
    expect(rentalDays("2026-10-12", "2026-10-14")).toBe(3);
    expect(rentalDays("2026-12-30", "2027-01-02")).toBe(4);
  });

  it.each([
    ["ngày trả trước ngày nhận", "2026-10-14", "2026-10-12"],
    ["ngày không có thật", "2026-02-31", "2026-03-02"],
    ["sai định dạng", "12/10/2026", "14/10/2026"],
    ["rỗng", "", ""],
  ])("%s: null", (_name, a, b) => {
    expect(rentalDays(a, b)).toBeNull();
  });
});

describe("parseFilters", () => {
  it("mặc định khi không có tham số", () => {
    const { filters, notices } = parse({});
    expect(filters).toMatchObject({ city: "", startDate: "", endDate: "", sort: "newest", seats: [], fuel: [], transmission: [], page: 1 });
    expect(filters.minPrice).toBeUndefined();
    expect(notices).toEqual([]);
  });

  it("đọc đầy đủ bộ lọc hợp lệ", () => {
    const { filters, notices } = parse({
      city: "  Hà Nội ",
      startDate: "2026-10-12",
      endDate: "2026-10-14",
      sort: "price_asc",
      minPrice: "300000",
      maxPrice: "2000000",
      seats: ["5", "7"],
      fuel: "petrol,electric",
      transmission: "automatic",
      page: "3",
    });
    expect(notices).toEqual([]);
    expect(filters).toEqual({
      city: "Hà Nội",
      startDate: "2026-10-12",
      endDate: "2026-10-14",
      sort: "price_asc",
      minPrice: 300000,
      maxPrice: 2000000,
      seats: [5, 7],
      fuel: ["petrol", "electric"],
      transmission: ["automatic"],
      page: 3,
    });
  });

  it("giá trị sai bị bỏ qua, không làm hỏng trang", () => {
    const { filters } = parse({
      sort: "rẻ-nhất",
      minPrice: "abc",
      maxPrice: "-5",
      seats: ["abc", "1", "99", "5"],
      fuel: "gas,diesel",
      transmission: "cvt",
      page: "-2",
    });
    expect(filters).toMatchObject({ sort: "newest", seats: [5], fuel: ["diesel"], transmission: [], page: 1 });
    expect(filters.minPrice).toBeUndefined();
    expect(filters.maxPrice).toBeUndefined();
  });

  it("loại giá trị trùng và cắt trang quá lớn", () => {
    expect(parse({ seats: ["5", "5,5"] }).filters.seats).toEqual([5]);
    expect(parse({ page: "99999999" }).filters.page).toBe(1000);
    expect(parse({ page: "1.5" }).filters.page).toBe(1);
  });

  it("giá bắt đầu lớn hơn giá kết thúc thì đổi chỗ và báo", () => {
    const { filters, notices } = parse({ minPrice: "900", maxPrice: "100" });
    expect(filters).toMatchObject({ minPrice: 100, maxPrice: 900 });
    expect(notices).toHaveLength(1);
  });

  it.each([
    ["chỉ có ngày nhận", { startDate: "2026-10-12" }],
    ["chỉ có ngày trả", { endDate: "2026-10-12" }],
    ["ngày trả trước ngày nhận", { startDate: "2026-10-14", endDate: "2026-10-12" }],
    ["ngày nhận đã qua", { startDate: "2026-10-09", endDate: "2026-10-12" }],
    ["ngày không có thật", { startDate: "2026-02-31", endDate: "2026-03-05" }],
    ["khoảng quá 366 ngày", { startDate: "2026-10-12", endDate: "2028-01-01" }],
  ])("%s: bỏ cả hai ngày và có thông báo", (_name, raw) => {
    const { filters, notices } = parse(raw);
    expect(filters.startDate).toBe("");
    expect(filters.endDate).toBe("");
    expect(notices).toHaveLength(1);
  });

  it("ngày nhận đúng hôm nay là hợp lệ", () => {
    const { filters, notices } = parse({ startDate: TODAY, endDate: TODAY });
    expect(notices).toEqual([]);
    expect(filters.startDate).toBe(TODAY);
  });

  it("tham số lặp và dạng dấu phẩy cho kết quả giống nhau", () => {
    expect(parse({ seats: ["5", "7"] }).filters.seats).toEqual(parse({ seats: "5,7" }).filters.seats);
  });
});

describe("toApiQuery", () => {
  it("đổi ngày thành khoảng đầu ngày nhận đến hết ngày trả theo giờ Việt Nam", () => {
    const { filters } = parse({ startDate: "2026-10-12", endDate: "2026-10-14", seats: ["5", "7"], city: "Hà Nội" });
    const q = toApiQuery(filters);
    expect(q.get("startAt")).toBe("2026-10-12T00:00:00+07:00");
    expect(q.get("endAt")).toBe("2026-10-14T23:59:59+07:00");
    expect(q.get("seats")).toBe("5,7");
    expect(q.get("city")).toBe("Hà Nội");
    expect(q.get("limit")).toBe("12");
    expect(q.get("sort")).toBe("newest");
  });

  it("không gửi tham số nào không có giá trị", () => {
    const q = toApiQuery(parse({}).filters);
    expect([...q.keys()].sort()).toEqual(["limit", "page", "sort"]);
  });
});

describe("toUrlQuery", () => {
  it("chỉ giữ giá trị khác mặc định và cho ghi đè trang", () => {
    const { filters } = parse({ city: "Hà Nội", seats: ["5", "7"], sort: "price_desc", page: "2" });
    expect(toUrlQuery(filters, { page: 4 })).toBe("city=H%C3%A0+N%E1%BB%99i&seats=5&seats=7&sort=price_desc&page=4");
    expect(toUrlQuery(parse({}).filters)).toBe("");
  });

  it("đọc lại chính nó cho ra bộ lọc ban đầu (không mất thông tin khi chuyển trang)", () => {
    const original = parse({ city: "Đà Nẵng", startDate: "2026-10-12", endDate: "2026-10-13", seats: ["4", "7"], fuel: ["electric"], minPrice: "500000", sort: "price_asc" }).filters;
    const params = Object.fromEntries(
      [...new URLSearchParams(toUrlQuery(original))].reduce<Map<string, string[]>>((m, [k, v]) => m.set(k, [...(m.get(k) ?? []), v]), new Map()),
    );
    expect(parse(params).filters).toEqual(original);
  });
});

describe("pageWindow", () => {
  it("ít trang thì hiện hết", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(pageWindow(1, 0)).toEqual([]);
  });

  it("nhiều trang thì rút gọn bằng dấu ... (null)", () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, null, 20]);
    expect(pageWindow(10, 20)).toEqual([1, null, 9, 10, 11, null, 20]);
    expect(pageWindow(20, 20)).toEqual([1, null, 19, 20]);
    expect(pageWindow(2, 9)).toEqual([1, 2, 3, null, 9]);
  });
});
