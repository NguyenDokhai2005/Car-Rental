import { afterEach, describe, expect, it, vi } from "vitest";
import { clearGuest, GUEST_HINT_TTL_MS, isKnownGuest, markGuest } from "./guest-hint";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("guest hint", () => {
  it("chưa có ghi nhớ gì: KHÔNG phải khách đã biết (phải hỏi máy chủ, không bỏ sót phiên đang có)", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage() });
    expect(isKnownGuest()).toBe(false);
  });

  it("đánh dấu rồi thì là khách đã biết; xóa dấu thì hết", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage() });
    markGuest();
    expect(isKnownGuest()).toBe(true);
    clearGuest();
    expect(isKnownGuest()).toBe(false);
  });

  it("dấu hết hạn sau 24 giờ: hỏi lại máy chủ một lần", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage() });
    const t0 = 1_000_000_000_000;
    markGuest(t0);
    expect(isKnownGuest(t0 + GUEST_HINT_TTL_MS - 1)).toBe(true);
    expect(isKnownGuest(t0 + GUEST_HINT_TTL_MS)).toBe(false);
  });

  it("giá trị bị sửa bậy hoặc thuộc về tương lai: coi như không có dấu", () => {
    const s = fakeStorage();
    vi.stubGlobal("window", { localStorage: s });
    for (const bad of ["abc", "", "0", "-5", "NaN", String(Date.now() + 60_000)]) {
      s.data.set("carrental.guest", bad);
      expect(isKnownGuest()).toBe(false);
    }
  });

  it("không có window (render ở máy chủ): không lỗi, không phải khách đã biết", () => {
    vi.stubGlobal("window", undefined);
    expect(() => markGuest()).not.toThrow();
    expect(() => clearGuest()).not.toThrow();
    expect(isKnownGuest()).toBe(false);
  });

  it("localStorage ném lỗi (chế độ riêng tư, bị chặn): không lỗi, quay về hành vi hỏi máy chủ", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    vi.stubGlobal("window", { localStorage: throwing });
    expect(() => markGuest()).not.toThrow();
    expect(() => clearGuest()).not.toThrow();
    expect(isKnownGuest()).toBe(false);
  });

  it("truy cập window.localStorage ném lỗi ngay (trình duyệt chặn lưu trữ): vẫn không lỗi", () => {
    vi.stubGlobal(
      "window",
      Object.defineProperty({}, "localStorage", {
        get() {
          throw new Error("SecurityError");
        },
      }),
    );
    expect(isKnownGuest()).toBe(false);
    expect(() => markGuest()).not.toThrow();
  });
});
