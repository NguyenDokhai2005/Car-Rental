import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  apiFetch,
  getAccessToken,
  onSessionLost,
  refreshSession,
  resetApiClientForTests,
  setAccessToken,
} from "./client";

const USER = {
  id: "u1",
  email: "a@b.vn",
  fullName: "Nguyễn Văn A",
  phone: "0900000000",
  role: "renter",
  status: "active",
  licenseStatus: "none",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  resetApiClientForTests();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  // Môi trường Node không có Web Locks: client tự bỏ qua khóa.
  vi.stubGlobal("navigator", {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("gắn Bearer token và trả JSON", async () => {
    setAccessToken("tok");
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));

    await expect(apiFetch("/me")).resolves.toEqual({ ok: true });
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer tok");
  });

  it("chuyển lỗi { code, message } thành ApiError", async () => {
    fetchMock.mockResolvedValueOnce(json(409, { code: "EMAIL_TAKEN", message: "Email đã tồn tại" }));

    await expect(apiFetch("/auth/register", { method: "POST", body: {}, auth: false })).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      code: "EMAIL_TAKEN",
    });
  });

  it("lỗi mạng thành NETWORK_ERROR", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fail"));
    const error = await apiFetch("/me").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("NETWORK_ERROR");
  });

  it("401 của đăng nhập (auth: false) KHÔNG kích hoạt làm mới phiên", async () => {
    fetchMock.mockResolvedValueOnce(json(401, { code: "INVALID_CREDENTIALS", message: "sai" }));

    await expect(apiFetch("/auth/login", { method: "POST", body: {}, auth: false })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("401 khi token hết hạn: làm mới rồi thử lại đúng một lần", async () => {
    setAccessToken("old");
    fetchMock
      .mockResolvedValueOnce(json(401, { code: "UNAUTHORIZED", message: "hết hạn" }))
      .mockResolvedValueOnce(json(200, { accessToken: "new", expiresIn: 900, user: USER }))
      .mockResolvedValueOnce(json(200, { data: 1 }));

    await expect(apiFetch("/me")).resolves.toEqual({ data: 1 });
    expect(getAccessToken()).toBe("new");
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(["/api/me", "/api/auth/refresh", "/api/me"]);
    const retryHeaders = new Headers(fetchMock.mock.calls[2][1]?.headers);
    expect(retryHeaders.get("Authorization")).toBe("Bearer new");
  });

  it("làm mới thất bại: báo mất phiên và trả lỗi gốc", async () => {
    setAccessToken("old");
    const lost = vi.fn();
    onSessionLost(lost);
    fetchMock
      .mockResolvedValueOnce(json(401, { code: "UNAUTHORIZED", message: "hết hạn" }))
      .mockResolvedValueOnce(json(401, { code: "INVALID_REFRESH_TOKEN", message: "hết phiên" }));

    await expect(apiFetch("/me")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(getAccessToken()).toBeNull();
    expect(lost).toHaveBeenCalledTimes(1);
  });
});

describe("refreshSession", () => {
  it("gộp các lần gọi đồng thời thành một request (tránh dùng lại refresh token)", async () => {
    fetchMock.mockResolvedValue(json(200, { accessToken: "t", expiresIn: 900, user: USER }));

    const [a, b, c] = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("chưa đăng nhập: 401 trả null và không báo mất phiên", async () => {
    const lost = vi.fn();
    onSessionLost(lost);
    fetchMock.mockResolvedValueOnce(json(401, { code: "INVALID_REFRESH_TOKEN", message: "x" }));

    await expect(refreshSession()).resolves.toBeNull();
    expect(lost).not.toHaveBeenCalled();
  });
});
