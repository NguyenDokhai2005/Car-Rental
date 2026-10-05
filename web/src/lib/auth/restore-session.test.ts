import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { isTransientError, RETRY_DELAYS_MS, restoreSession } from "./restore-session";
import type { SessionPayload } from "./types";

const SESSION = { accessToken: "t", expiresIn: 900, user: { id: "u1" } } as unknown as SessionPayload;
const network = () => new ApiError(0, "NETWORK_ERROR", "x");
const http = (status: number) => new ApiError(status, "ERROR", "x");

function harness(outcomes: (SessionPayload | null | Error)[]) {
  const refresh = vi.fn(async () => {
    const next = outcomes.shift();
    if (next instanceof Error) throw next;
    return next ?? null;
  });
  const slept: number[] = [];
  const sleep = vi.fn(async (ms: number) => {
    slept.push(ms);
  });
  return { refresh, sleep, slept };
}

describe("isTransientError", () => {
  it.each([0, 429, 500, 502, 503, 504])("status %i là lỗi tạm thời", (status) => {
    expect(isTransientError(http(status))).toBe(true);
  });
  it.each([400, 401, 403, 404, 409])("status %i là lỗi dứt khoát", (status) => {
    expect(isTransientError(http(status))).toBe(false);
  });
  it("lỗi không phải ApiError không được coi là tạm thời", () => {
    expect(isTransientError(new Error("bug"))).toBe(false);
    expect(isTransientError(null)).toBe(false);
  });
});

describe("restoreSession", () => {
  it("có phiên: trả session, không thử lại", async () => {
    const h = harness([SESSION]);
    expect(await restoreSession(h)).toEqual({ kind: "session", session: SESSION });
    expect(h.refresh).toHaveBeenCalledTimes(1);
    expect(h.slept).toEqual([]);
  });

  it("máy chủ trả lời rõ là không có phiên (null): guest, không thử lại", async () => {
    const h = harness([null]);
    expect(await restoreSession(h)).toEqual({ kind: "guest" });
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });

  it("API đang khởi động lại (502) rồi sống lại: vẫn khôi phục được phiên, KHÔNG bị coi là chưa đăng nhập", async () => {
    const h = harness([http(502), network(), SESSION]);
    expect(await restoreSession(h)).toEqual({ kind: "session", session: SESSION });
    expect(h.refresh).toHaveBeenCalledTimes(3);
    expect(h.slept).toEqual([1000, 2000]);
  });

  it("lỗi tạm thời rồi máy chủ trả lời không có phiên: guest", async () => {
    const h = harness([http(503), null]);
    expect(await restoreSession(h)).toEqual({ kind: "guest" });
  });

  it("lỗi tạm thời kéo dài: thử lại đúng số lần, giãn cách tăng dần, rồi trả unknown (không phải guest)", async () => {
    const h = harness([network(), network(), network(), network(), network(), network()]);
    expect(await restoreSession(h)).toEqual({ kind: "unknown" });
    expect(h.refresh).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1);
    expect(h.slept).toEqual(RETRY_DELAYS_MS);
  });

  it("bị giới hạn tốc độ (429) cũng là tạm thời: không đẩy người dùng ra khỏi phiên", async () => {
    const h = harness([http(429), SESSION]);
    expect((await restoreSession(h)).kind).toBe("session");
  });

  it("lỗi dứt khoát (403 tài khoản bị khóa): guest ngay, không thử lại", async () => {
    const h = harness([http(403), SESSION]);
    expect(await restoreSession(h)).toEqual({ kind: "guest" });
    expect(h.refresh).toHaveBeenCalledTimes(1);
    expect(h.slept).toEqual([]);
  });

  it("bị hủy (component gỡ khỏi trang) thì dừng, không tiếp tục gọi máy chủ", async () => {
    const h = harness([network(), network(), SESSION]);
    let cancelled = false;
    const sleep = async (ms: number) => {
      h.slept.push(ms);
      cancelled = true; // bị hủy trong lúc đang chờ
    };
    expect(await restoreSession({ refresh: h.refresh, sleep, isCancelled: () => cancelled })).toEqual({ kind: "unknown" });
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });

  it("dùng được dãy thời gian chờ tùy chỉnh", async () => {
    const h = harness([network(), network()]);
    expect(await restoreSession({ ...h, delays: [5] })).toEqual({ kind: "unknown" });
    expect(h.slept).toEqual([5]);
  });
});
