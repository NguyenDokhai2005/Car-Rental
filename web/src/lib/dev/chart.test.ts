import { describe, expect, it } from "vitest";
import { indexAt, linePath, niceMax, seriesMax } from "./chart";

describe("biểu đồ đường", () => {
  it("đỉnh trục dọc là số tròn vừa đủ chứa dữ liệu", () => {
    expect([niceMax(0), niceMax(0.4), niceMax(7), niceMax(12), niceMax(100), niceMax(101), niceMax(1840)]).toEqual([1, 0.5, 10, 20, 100, 200, 2000]);
    expect(niceMax(Number.NaN)).toBe(1);
  });

  it("giá trị lớn nhất bỏ qua chỗ thiếu dữ liệu", () => {
    expect(seriesMax([{ values: [1, null, 9] }, { values: [null, 4] }])).toBe(9);
    expect(seriesMax([{ values: [null] }])).toBe(0);
  });

  it("đường vẽ đi từ trái sang phải, giá trị lớn nằm trên cao", () => {
    expect(linePath([0, 50, 100], 100)).toBe("M0.00,100.00L50.00,50.00L100.00,0.00");
  });

  it("chỗ thiếu dữ liệu làm đứt nét", () => {
    expect(linePath([10, null, 10, 10], 10)).toBe("M0.00,0.00M66.67,0.00L100.00,0.00");
    expect(linePath([null, null], 10)).toBe("");
  });

  it("giá trị vượt đỉnh trục bị chặn ở mép trên", () => {
    expect(linePath([200, 0], 100)).toBe("M0.00,0.00L100.00,100.00");
  });

  it("điểm gần con trỏ nhất luôn nằm trong mảng", () => {
    expect([indexAt(-0.2, 5), indexAt(0, 5), indexAt(0.5, 5), indexAt(0.9, 5), indexAt(1.4, 5)]).toEqual([0, 0, 2, 4, 4]);
  });
});
