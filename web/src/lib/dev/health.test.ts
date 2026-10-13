import { describe, expect, it } from "vitest";
import type { SystemStatus } from "./api";
import { apiHealth, databaseHealth, serverHealth, webHealth } from "./health";

type Ok<T> = Extract<T, { ok: true }>;

const server: Ok<SystemStatus["server"]> = {
  ok: true,
  hostname: "may-chu",
  platform: "Linux 6.8",
  uptimeSeconds: 1000,
  cpuCount: 1,
  loadAverage: [0.2, 0.1, 0.1],
  memoryMb: { total: 1600, available: 800 },
  swapMb: { total: 6200, used: 100 },
  containerMemoryLimitMb: null,
  uploadDisk: { totalGb: 60, freeGb: 30 },
};

const api: SystemStatus["api"] = {
  ok: true,
  environment: "production",
  nodeVersion: "v22",
  pid: 1,
  uptimeSeconds: 10,
  memoryMb: { rss: 120, heapUsed: 40, heapLimit: 256 },
  eventLoopDelayMs: { mean: 1, p99: 5, max: 9 },
  last5Minutes: { count: 10, clientErrors: 2, serverErrors: 0, avgMs: 12 },
};

const database: Ok<SystemStatus["database"]> = {
  ok: true,
  pingMs: 2,
  uptimeSeconds: 500,
  cacheHitPercent: 99.5,
  longestQuerySeconds: 0,
  deadlocks: 0,
  rollbacks: 0,
  version: "PostgreSQL 16.4",
  sizeMb: 39,
  connections: { max: 100, total: 4, active: 1 },
  tables: [],
  migrations: { applied: 12, latest: "x" },
};

describe("đánh giá sức khỏe từng phần", () => {
  it("mọi thứ bình thường", () => {
    expect([serverHealth(server), apiHealth(api), webHealth({ ok: true, status: 200, responseMs: 50, healthy: true }), databaseHealth(database)]).toEqual([
      "good",
      "good",
      "good",
      "good",
    ]);
  });

  it("không lấy được thông tin thì coi là sự cố", () => {
    const failed = { ok: false as const, error: "Error ECONNREFUSED" };
    expect([serverHealth(failed), webHealth(failed), databaseHealth(failed)]).toEqual(["bad", "bad", "bad"]);
  });

  it("máy chủ: RAM hoặc đĩa gần đầy, tải vượt số CPU", () => {
    expect(serverHealth({ ...server, memoryMb: { total: 1600, available: 100 } })).toBe("bad");
    expect(serverHealth({ ...server, uploadDisk: { totalGb: 60, freeGb: 12 } })).toBe("warn");
    expect(serverHealth({ ...server, loadAverage: [1.8, 1, 1] })).toBe("warn");
  });

  it("backend: lỗi 4xx của người dùng không phải sự cố, lỗi 5xx thì có", () => {
    expect(apiHealth(api)).toBe("good");
    expect(apiHealth({ ...api, last5Minutes: { ...api.last5Minutes, serverErrors: 1 } })).toBe("bad");
    expect(apiHealth({ ...api, eventLoopDelayMs: { mean: 50, p99: 400, max: 900 } })).toBe("warn");
  });

  it("web trả mã lỗi hoặc phản hồi chậm", () => {
    expect(webHealth({ ok: true, status: 502, responseMs: 20, healthy: false })).toBe("bad");
    expect(webHealth({ ok: true, status: 200, responseMs: 2000, healthy: true })).toBe("warn");
  });

  it("CSDL: gần hết kết nối, truy vấn treo lâu", () => {
    expect(databaseHealth({ ...database, connections: { max: 100, total: 95, active: 90 } })).toBe("bad");
    expect(databaseHealth({ ...database, longestQuerySeconds: 45 })).toBe("warn");
  });
});
