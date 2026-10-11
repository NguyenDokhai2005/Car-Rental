import { isValidFutureDate, licenseVersion, vnToday } from "./license-rules";

describe("license-rules", () => {
  // 18:30 UTC ngày 06/10 là 01:30 ngày 07/10 giờ Việt Nam.
  const now = new Date("2026-10-06T18:30:00Z");

  it("hôm nay tính theo giờ Việt Nam, không theo UTC", () => {
    expect(vnToday(now)).toBe("2026-10-07");
  });

  describe("isValidFutureDate", () => {
    it("nhận hôm nay và các ngày sau", () => {
      expect(isValidFutureDate("2026-10-07", now)).toBe(true);
      expect(isValidFutureDate("2031-01-15", now)).toBe(true);
    });

    it("từ chối ngày đã qua, kể cả ngày vẫn là 'hôm nay' theo UTC", () => {
      expect(isValidFutureDate("2026-10-06", now)).toBe(false);
    });

    it.each(["2026-02-31", "2026-13-01", "07/10/2026", "2026-10-7", "", "abc"])("từ chối ngày không có thật hoặc sai dạng: %s", (value) => {
      expect(isValidFutureDate(value, now)).toBe(false);
    });
  });

  describe("licenseVersion", () => {
    it("chưa có ảnh mặt trước thì chưa có version", () => {
      expect(licenseVersion(null, null)).toBeNull();
    });

    it("cùng bộ file cho cùng version, đổi bất kỳ file nào cũng đổi version", () => {
      const base = licenseVersion("licenses/u/a.webp", "licenses/u/b.webp");
      expect(licenseVersion("licenses/u/a.webp", "licenses/u/b.webp")).toBe(base);
      expect(licenseVersion("licenses/u/c.webp", "licenses/u/b.webp")).not.toBe(base);
      expect(licenseVersion("licenses/u/a.webp", null)).not.toBe(base);
    });

    it("không chứa đường dẫn file", () => {
      expect(licenseVersion("licenses/user-1/front.webp", null)).toMatch(/^[0-9a-f]{32}$/);
    });
  });
});
