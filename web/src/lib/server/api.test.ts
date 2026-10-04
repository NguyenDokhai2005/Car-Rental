import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.fn();
vi.mock("next/headers", () => ({ headers: () => headersMock() }));

import { ServerApiError, serverGet } from "./api";

const fetchMock = vi.fn<typeof fetch>();

function sentHeaders(): Headers {
  return new Headers(fetchMock.mock.calls[0][1]?.headers);
}

beforeEach(() => {
  fetchMock.mockReset();
  headersMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.API_URL;
});

describe("serverGet", () => {
  it("chuyển tiếp X-Forwarded-For của yêu cầu đang render, nguyên văn", async () => {
    headersMock.mockResolvedValue(new Headers({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" }));
    await serverGet("/vehicles");
    expect(sentHeaders().get("x-forwarded-for")).toBe("9.9.9.9, 203.0.113.7");
  });

  it("không có X-Forwarded-For thì không tự tạo", async () => {
    headersMock.mockResolvedValue(new Headers());
    await serverGet("/vehicles");
    expect(sentHeaders().has("x-forwarded-for")).toBe(false);
  });

  it("ngoài phạm vi yêu cầu (headers() ném lỗi, ví dụ lúc build) vẫn gọi được", async () => {
    headersMock.mockRejectedValue(new Error("headers was called outside a request scope"));
    await expect(serverGet("/vehicles")).resolves.toEqual({ ok: true });
    expect(sentHeaders().has("x-forwarded-for")).toBe(false);
  });

  it("gọi tới API_URL và không cache", async () => {
    process.env.API_URL = "http://api:4000";
    headersMock.mockResolvedValue(new Headers());
    await serverGet("/vehicles?limit=4");
    expect(fetchMock.mock.calls[0][0]).toBe("http://api:4000/api/vehicles?limit=4");
    expect(fetchMock.mock.calls[0][1]?.cache).toBe("no-store");
  });

  it("lỗi từ API thành ServerApiError mang mã và thông điệp", async () => {
    headersMock.mockResolvedValue(new Headers());
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: "NOT_FOUND", message: "Không tìm thấy xe." }), { status: 404 }));
    await expect(serverGet("/vehicles/x")).rejects.toMatchObject({ status: 404, code: "NOT_FOUND", message: "Không tìm thấy xe." });
  });

  it("lỗi mạng thành NETWORK_ERROR", async () => {
    headersMock.mockResolvedValue(new Headers());
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const error = await serverGet("/vehicles").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServerApiError);
    expect((error as ServerApiError).code).toBe("NETWORK_ERROR");
  });
});
