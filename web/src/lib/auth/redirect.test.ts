import { describe, expect, it } from "vitest";
import { loginHref, postLoginPath, safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("nhận đường dẫn nội bộ, giữ cả query", () => {
    expect(safeNextPath("/cars/abc")).toBe("/cars/abc");
    expect(safeNextPath("/cars?city=hcm&seats=7")).toBe("/cars?city=hcm&seats=7");
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "cars", "", "/a\nb"])(
    "từ chối %j",
    (raw) => {
      expect(safeNextPath(raw)).toBeNull();
    },
  );

  it("từ chối null, undefined và chuỗi quá dài", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(`/${"a".repeat(400)}`)).toBeNull();
  });

  it("không quay lại các trang xác thực (tránh lặp vòng)", () => {
    expect(safeNextPath("/login")).toBeNull();
    expect(safeNextPath("/login?next=/cars")).toBeNull();
    expect(safeNextPath("/register")).toBeNull();
    expect(safeNextPath("/loginx")).toBe("/loginx");
  });
});

describe("postLoginPath", () => {
  it("chủ xe luôn vào /owner, bỏ qua next", () => {
    expect(postLoginPath("owner", "/cars/1")).toBe("/owner");
  });

  it("admin luôn vào /admin", () => {
    expect(postLoginPath("admin", "/cars/1")).toBe("/admin");
  });

  it("khách quay lại trang đang đứng trước khi đăng nhập", () => {
    expect(postLoginPath("renter", "/cars/1?from=2026-10-10")).toBe("/cars/1?from=2026-10-10");
  });

  it("khách không có next hoặc next xấu thì về trang chủ", () => {
    expect(postLoginPath("renter", null)).toBe("/");
    expect(postLoginPath("renter", "https://evil.com")).toBe("/");
  });

  it("khách không bị đưa vào khu chủ xe hoặc quản trị", () => {
    expect(postLoginPath("renter", "/owner")).toBe("/");
    expect(postLoginPath("renter", "/owner/new")).toBe("/");
    expect(postLoginPath("renter", "/admin")).toBe("/");
    expect(postLoginPath("renter", "/ownership")).toBe("/ownership");
  });
});

describe("loginHref", () => {
  it("gắn trang hiện tại vào next, có mã hóa", () => {
    expect(loginHref("/cars/1?a=b")).toBe("/login?next=%2Fcars%2F1%3Fa%3Db");
  });

  it("bỏ next khi không hợp lệ", () => {
    expect(loginHref("/login")).toBe("/login");
    expect(loginHref(null)).toBe("/login");
  });
});
