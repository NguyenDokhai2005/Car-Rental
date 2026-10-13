import request from "supertest";
import { MetricsHistoryService } from "../src/dev/metrics-history.service";
import { createTestApp, makeUser, resetDatabase, TestContext } from "./helpers";

type RequestRow = { method: string; path: string; route: string | null; status: number; userId: string | null; role: string | null };

describe("Dev console (vai trò dev)", () => {
  let ctx: TestContext;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    const dev = await makeUser(ctx, "dev");
    await http().delete("/api/dev/requests").set(dev.auth);
    await http().delete("/api/dev/logs?source=server").set(dev.auth);
    await http().delete("/api/dev/logs?source=browser").set(dev.auth);
  });

  const DEV_ROUTES: ["get" | "delete", string][] = [
    ["get", "/api/dev/status"],
    ["get", "/api/dev/metrics"],
    ["get", "/api/dev/requests"],
    ["delete", "/api/dev/requests"],
    ["get", "/api/dev/logs?source=server"],
    ["delete", "/api/dev/logs?source=server"],
  ];

  it("chưa đăng nhập: 401; renter, owner và cả admin: 403", async () => {
    for (const [method, path] of DEV_ROUTES) {
      expect((await http()[method](path)).status).toBe(401);
    }
    for (const role of ["renter", "owner", "admin"] as const) {
      const user = await makeUser(ctx, role);
      for (const [method, path] of DEV_ROUTES) {
        const res = await http()[method](path).set(user.auth);
        expect([role, path, res.status]).toEqual([role, path, 403]);
      }
    }
  });

  it("dev không có quyền nghiệp vụ: bị từ chối ở endpoint của admin, chủ xe và khách", async () => {
    const dev = await makeUser(ctx, "dev");
    const id = "00000000-0000-4000-8000-000000000000";
    const forbidden: ["get" | "post", string][] = [
      ["get", "/api/admin/users"],
      ["get", "/api/admin/bookings"],
      ["get", "/api/admin/vehicles"],
      ["post", `/api/admin/users/${id}/block`],
      ["get", `/api/admin/users/${id}/license`],
      ["get", `/api/admin/users/${id}/license/front`],
      ["get", "/api/owner/vehicles"],
      ["get", "/api/owner/bookings"],
      ["get", "/api/bookings"],
      ["post", "/api/bookings"],
      ["get", "/api/me/license"],
    ];
    for (const [method, path] of forbidden) {
      const res = await http()[method](path).set(dev.auth);
      expect([path, res.status]).toEqual([path, 403]);
    }
  });

  it("không đăng ký được tài khoản dev qua API", async () => {
    const res = await http()
      .post("/api/auth/register")
      .send({ email: "muon-lam-dev@test.vn", password: "Password123!", fullName: "Người Lạ", phone: "0901234567", role: "dev" });
    expect(res.status).toBe(400);
    expect(await ctx.prisma.user.count({ where: { role: "dev", email: "muon-lam-dev@test.vn" } })).toBe(0);
  });

  it("nhật ký yêu cầu: ghi siêu dữ liệu, không ghi query string; bỏ qua /health và /dev", async () => {
    const dev = await makeUser(ctx, "dev");
    const renter = await makeUser(ctx, "renter");

    await http().get("/api/vehicles?city=bi-mat-trong-query&limit=1");
    await http().get("/api/bookings").set(renter.auth);
    await http().get("/api/admin/users").set(renter.auth);
    await http().get("/api/khong-ton-tai");
    await http().get("/api/health");

    const res = await http().get("/api/dev/requests").set(dev.auth);
    expect(res.status).toBe(200);
    const items = res.body.items as RequestRow[];

    expect(JSON.stringify(res.body)).not.toContain("bi-mat-trong-query");
    expect(JSON.stringify(res.body)).not.toContain(renter.token);
    expect(items.map((row) => row.path)).toEqual(["/api/khong-ton-tai", "/api/admin/users", "/api/bookings", "/api/vehicles"]);

    const [missing, denied, own, search] = items;
    expect(missing).toMatchObject({ status: 404, route: null, userId: null });
    expect(denied).toMatchObject({ status: 403, userId: renter.user.id, role: "renter" });
    expect(own).toMatchObject({ status: 200, route: "/api/bookings", userId: renter.user.id });
    expect(search).toMatchObject({ method: "GET", status: 200, route: "/api/vehicles", userId: null, role: null });

    const stats = res.body.stats as { route: string; count: number; clientErrors: number }[];
    expect(stats.find((row) => row.route === "GET /api/admin/users")).toMatchObject({ count: 1, clientErrors: 1 });
  });

  it("lọc nhật ký yêu cầu theo lỗi, đường dẫn và limit; tham số sai trả 400", async () => {
    const dev = await makeUser(ctx, "dev");
    await http().get("/api/vehicles");
    await http().get("/api/vehicles");
    await http().get("/api/khong-ton-tai");

    const errors = await http().get("/api/dev/requests?onlyErrors=true").set(dev.auth);
    expect((errors.body.items as RequestRow[]).map((row) => row.status)).toEqual([404]);

    const byPath = await http().get("/api/dev/requests?q=VEHICLES&limit=1").set(dev.auth);
    expect((byPath.body.items as RequestRow[]).map((row) => row.path)).toEqual(["/api/vehicles"]);

    expect((await http().get("/api/dev/requests?limit=501").set(dev.auth)).status).toBe(400);
    expect((await http().get("/api/dev/requests?onlyErrors=co").set(dev.auth)).status).toBe(400);
    expect((await http().get("/api/dev/logs").set(dev.auth)).status).toBe(400);
    expect((await http().get("/api/dev/logs?source=database").set(dev.auth)).status).toBe(400);
    expect((await http().delete("/api/dev/logs").set(dev.auth)).status).toBe(400);
  });

  it("xóa nhật ký yêu cầu", async () => {
    const dev = await makeUser(ctx, "dev");
    await http().get("/api/vehicles");
    expect((await http().delete("/api/dev/requests").set(dev.auth)).status).toBe(204);
    const res = await http().get("/api/dev/requests").set(dev.auth);
    expect(res.body).toEqual({ items: [], stats: [] });
  });

  it("lỗi trình duyệt: ai cũng gửi được, dev đọc và xóa được, nội dung giữ nguyên dạng chữ", async () => {
    const dev = await makeUser(ctx, "dev");
    const message = "<img src=x onerror=alert(1)> TypeError: x is undefined";

    const sent = await http()
      .post("/api/client-logs")
      .set("User-Agent", "TrinhDuyetThu/1.0")
      .send({ level: "error", message, stack: "at render (page.js:1:2)", url: "http://localhost:3000/cars" });
    expect(sent.status).toBe(204);

    const list = await http().get("/api/dev/logs?source=browser").set(dev.auth);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({
      level: "error",
      message,
      stack: "at render (page.js:1:2)",
      url: "http://localhost:3000/cars",
      userAgent: "TrinhDuyetThu/1.0",
    });

    expect((await http().get("/api/dev/logs?source=browser&level=warn").set(dev.auth)).body.items).toEqual([]);
    expect((await http().delete("/api/dev/logs?source=browser").set(dev.auth)).status).toBe(204);
    expect((await http().get("/api/dev/logs?source=browser").set(dev.auth)).body.items).toEqual([]);
  });

  it("lỗi trình duyệt: từ chối dữ liệu sai dạng hoặc quá dài, và không ghi gì", async () => {
    const dev = await makeUser(ctx, "dev");
    const bad = [
      {},
      { level: "info", message: "x" },
      { level: "error", message: "" },
      { level: "error", message: "x".repeat(2001) },
      { level: "error", message: "x", stack: "s".repeat(4001) },
      { level: "error", message: "x", url: "u".repeat(501) },
      { level: "error", message: "x", cookie: "khong-duoc-nhan" },
    ];
    for (const body of bad) {
      expect((await http().post("/api/client-logs").send(body)).status).toBe(400);
    }
    expect((await http().get("/api/dev/logs?source=browser").set(dev.auth)).body.items).toEqual([]);
  });

  it("lịch sử chỉ số: mỗi mẫu đếm đúng yêu cầu của chu kỳ đó; phần không đo được là null", async () => {
    const dev = await makeUser(ctx, "dev");
    const metrics = ctx.app.get(MetricsHistoryService);
    await metrics.sample(); // khép chu kỳ đang dở, để mẫu kế tiếp chỉ gồm các yêu cầu bên dưới
    const before = metrics.list().length;

    await http().get("/api/vehicles");
    await http().get("/api/vehicles");
    await http().get("/api/khong-ton-tai");
    await metrics.sample();
    await metrics.sample();

    const res = await http().get("/api/dev/metrics").set(dev.auth);
    expect(res.status).toBe(200);
    expect(res.body.intervalSeconds).toBe(10);
    expect(res.body.samples).toHaveLength(before + 2);

    const [busy, quiet] = (res.body.samples as Record<string, number | string | null>[]).slice(-2);
    expect(busy).toMatchObject({ requests: 3, clientErrors: 1, serverErrors: 0 });
    expect(busy.avgMs).toEqual(expect.any(Number));
    expect(busy.p95Ms).toEqual(expect.any(Number));
    expect(busy.dbPingMs).toEqual(expect.any(Number));
    expect(busy.dbConnections).toBeGreaterThan(0);
    expect(busy.memoryUsedPercent).toBeGreaterThan(0);
    expect(busy.rssMb).toBeGreaterThan(0);
    // Test trỏ máy chủ web vào một cổng đóng.
    expect(busy.webResponseMs).toBeNull();
    // Chu kỳ không có yêu cầu nào: không có thời gian xử lý để tính, không phải 0 ms.
    expect(quiet).toMatchObject({ requests: 0, clientErrors: 0, serverErrors: 0, avgMs: null, p95Ms: null });
    expect(Date.parse(String(quiet.at))).toBeGreaterThanOrEqual(Date.parse(String(busy.at)));
  });

  it("trạng thái hệ thống: đủ bốn phần; phần web hỏng không làm hỏng cả phản hồi", async () => {
    const dev = await makeUser(ctx, "dev");
    await http().get("/api/vehicles");

    const res = await http().get("/api/dev/status").set(dev.auth);
    expect(res.status).toBe(200);

    expect(res.body.api).toMatchObject({ ok: true, environment: "test" });
    expect(res.body.api.memoryMb.rss).toBeGreaterThan(0);
    expect(res.body.api.last5Minutes.count).toBe(1);

    expect(res.body.server.ok).toBe(true);
    expect(res.body.server.cpuCount).toBeGreaterThan(0);
    expect(res.body.server.memoryMb.available).toBeGreaterThan(0);
    expect(res.body.api.eventLoopDelayMs.mean).toBeGreaterThanOrEqual(0);
    expect(res.body.server.uploadDisk.totalGb).toBeGreaterThan(0);

    expect(res.body.database.ok).toBe(true);
    expect(res.body.database.version).toMatch(/^PostgreSQL \d+/);
    expect(res.body.database.migrations.applied).toBeGreaterThan(0);
    expect(res.body.database.uptimeSeconds).toBeGreaterThan(0);
    expect(res.body.database.longestQuerySeconds).toBeGreaterThanOrEqual(0);
    expect(typeof res.body.server.hostname).toBe("string");
    expect(res.body.api.last5Minutes).toMatchObject({ count: 1, clientErrors: 0, serverErrors: 0 });
    expect((res.body.database.tables as { name: string }[]).map((table) => table.name)).toEqual(
      expect.arrayContaining(["users", "vehicles", "bookings"]),
    );

    // Test không chạy máy chủ web ở cổng này, nên phần web phải tự báo hỏng thay vì ném lỗi.
    expect(res.body.web.ok).toBe(false);
    expect(JSON.stringify(res.body)).not.toMatch(/postgres(ql)?:\/\//);
  });

  it("admin khóa được tài khoản dev, và dev bị khóa mất quyền ngay", async () => {
    const admin = await makeUser(ctx, "admin");
    const dev = await makeUser(ctx, "dev");

    expect((await http().post(`/api/admin/users/${dev.user.id}/block`).set(admin.auth).send({ reason: "Nghỉ việc" })).status).toBeLessThan(300);
    expect((await http().get("/api/dev/status").set(dev.auth)).status).toBeGreaterThanOrEqual(401);
  });
});
