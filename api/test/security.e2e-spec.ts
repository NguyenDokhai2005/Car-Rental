import request from "supertest";
import { createTestApp, makeUser, resetDatabase, TestContext } from "./helpers";

type Route = { method: "get" | "post" | "patch" | "delete" | "put"; path: string };

// Những route cố ý mở cho người chưa đăng nhập. Thêm route công khai mới thì phải thêm vào đây một cách có chủ đích;
// mọi route khác bắt buộc trả 401 khi không có token.
const PUBLIC_ROUTES = new Set([
  "POST /api/auth/register",
  "POST /api/auth/login",
  "POST /api/auth/refresh",
  "POST /api/auth/logout",
  "GET /api/health",
  "GET /api/vehicles",
  "GET /api/vehicles/:id",
  "GET /api/vehicles/:id/availability",
]);

const SAMPLE_ID = "00000000-0000-4000-8000-000000000000";

// Đọc danh sách route thật từ Express, nên test tự bao phủ cả những endpoint thêm sau này.
function listRoutes(ctx: TestContext): Route[] {
  const instance = ctx.app.getHttpAdapter().getInstance() as { router?: { stack: unknown[] }; _router?: { stack: unknown[] } };
  const stack = (instance.router ?? instance._router)?.stack ?? [];
  const routes: Route[] = [];
  for (const layer of stack as { route?: { path: unknown; methods: Record<string, boolean> } }[]) {
    if (!layer.route || typeof layer.route.path !== "string") continue;
    for (const method of Object.keys(layer.route.methods)) {
      if (method === "get" || method === "post" || method === "patch" || method === "delete" || method === "put") {
        routes.push({ method, path: layer.route.path });
      }
    }
  }
  return routes.filter((route) => route.path.startsWith("/api/"));
}

const label = (route: Route) => `${route.method.toUpperCase()} ${route.path}`;
const concrete = (path: string) => path.replace(/:side\b/g, "front").replace(/:[A-Za-z]+/g, SAMPLE_ID);

describe("Security: every route is guarded", () => {
  let ctx: TestContext;
  let routes: Route[];
  const http = () => request(ctx.app.getHttpServer());
  const call = (route: Route, auth?: { Authorization: string }) => {
    const req = http()[route.method](concrete(route.path));
    return auth ? req.set(auth) : req;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    routes = listRoutes(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  it("đọc được danh sách route, và danh sách công khai không có tên route đã bị xóa", () => {
    expect(routes.length).toBeGreaterThan(30);
    const known = new Set(routes.map(label));
    expect([...PUBLIC_ROUTES].filter((name) => !known.has(name))).toEqual([]);
  });

  it("mọi route không nằm trong danh sách công khai đều trả 401 khi chưa đăng nhập", async () => {
    const leaked: string[] = [];
    for (const route of routes.filter((r) => !PUBLIC_ROUTES.has(label(r)))) {
      const res = await call(route);
      if (res.status !== 401) leaked.push(`${label(route)} -> ${res.status}`);
    }
    expect(leaked).toEqual([]);
  });

  it("token giả, token ký bằng khóa khác, token không ký: đều 401", async () => {
    const renter = await makeUser(ctx, "renter");
    const [header, payload] = renter.token.split(".");
    const unsigned = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${payload}.`;
    const forged = [
      "khong-phai-jwt",
      `${header}.${payload}.chu-ky-sai`,
      unsigned,
      // Đổi vai trò trong payload nhưng giữ chữ ký cũ: chữ ký không còn khớp.
      `${header}.${Buffer.from(JSON.stringify({ sub: renter.user.id, role: "admin" })).toString("base64url")}.${renter.token.split(".")[2]}`,
    ];
    for (const token of forged) {
      expect((await http().get("/api/me").set({ Authorization: `Bearer ${token}` })).status).toBe(401);
      expect((await http().get("/api/admin/users").set({ Authorization: `Bearer ${token}` })).status).toBe(401);
    }
  });

  it("token hợp lệ nhưng vai trò trong token không khớp CSDL: quyền tính theo CSDL, không theo token", async () => {
    const renter = await makeUser(ctx, "renter");
    const elevated = await ctx.jwt.signAsync({ sub: renter.user.id, role: "admin" });
    expect((await http().get("/api/admin/users").set({ Authorization: `Bearer ${elevated}` })).status).toBe(403);
  });

  it("mọi route /api/admin/* từ chối khách thuê và chủ xe bằng 403", async () => {
    const renter = await makeUser(ctx, "renter");
    const owner = await makeUser(ctx, "owner");
    const adminRoutes = routes.filter((r) => r.path.startsWith("/api/admin/"));
    expect(adminRoutes.length).toBeGreaterThan(8);

    const leaked: string[] = [];
    for (const route of adminRoutes) {
      for (const [name, who] of [["renter", renter], ["owner", owner]] as const) {
        const res = await call(route, who.auth);
        if (res.status !== 403) leaked.push(`${label(route)} với ${name} -> ${res.status}`);
      }
    }
    expect(leaked).toEqual([]);
  });

  it("mọi route /api/owner/* từ chối khách thuê bằng 403", async () => {
    const renter = await makeUser(ctx, "renter");
    const ownerRoutes = routes.filter((r) => r.path.startsWith("/api/owner/"));
    expect(ownerRoutes.length).toBeGreaterThan(10);

    const leaked: string[] = [];
    for (const route of ownerRoutes) {
      const res = await call(route, renter.auth);
      if (res.status !== 403) leaked.push(`${label(route)} -> ${res.status}`);
    }
    expect(leaked).toEqual([]);
  });

  it("tài khoản bị khóa bị từ chối ở mọi route cần đăng nhập, dù token còn hạn", async () => {
    const renter = await makeUser(ctx, "renter");
    await ctx.prisma.user.update({ where: { id: renter.user.id }, data: { status: "blocked" } });

    const allowed: string[] = [];
    for (const route of routes.filter((r) => !PUBLIC_ROUTES.has(label(r)))) {
      const res = await call(route, renter.auth);
      if (res.status < 400) allowed.push(`${label(route)} -> ${res.status}`);
    }
    expect(allowed).toEqual([]);
  });

  it("lỗi không lộ chi tiết kỹ thuật: không có stack trace, tên bảng hay câu SQL", async () => {
    const renter = await makeUser(ctx, "renter");
    const responses = [
      await http().get("/api/khong-ton-tai"),
      await http().post("/api/auth/login").send({ email: "a'; DROP TABLE users;--@x.vn", password: "x" }),
      await http().post("/api/bookings").set(renter.auth).send({ vehicleId: "' OR 1=1 --", startAt: "x", endAt: "y" }),
      await http().get("/api/vehicles?seats=abc&minPrice[$gt]=1"),
      await http().post("/api/auth/login").set("Content-Type", "application/json").send("{sai json"),
    ];
    for (const res of responses) {
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(Object.keys(res.body).sort()).toEqual(["code", "message"]);
      expect(JSON.stringify(res.body)).not.toMatch(/prisma|postgres|stack|node_modules|SELECT |\bat [A-Za-z.]+ \(/i);
    }
  });

  it("GET /api/health công khai, chỉ trả trạng thái; CSDL hỏng thì 503 và không lộ lý do", async () => {
    const ok = await http().get("/api/health");
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ status: "ok" });

    const spy = jest.spyOn(ctx.prisma, "$queryRaw").mockRejectedValueOnce(new Error("connect ECONNREFUSED 10.0.0.5:5432"));
    try {
      const down = await http().get("/api/health");
      expect(down.status).toBe(503);
      expect(down.body.code).toBe("UNAVAILABLE");
      expect(JSON.stringify(down.body)).not.toMatch(/ECONNREFUSED|5432|10\.0\.0\.5/);
    } finally {
      spy.mockRestore();
    }
  });

  it("header bảo mật có mặt và không quảng cáo công nghệ đang dùng", async () => {
    const res = await http().get("/api/vehicles");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["strict-transport-security"]).toBeDefined();
  });

  it("CORS chỉ chấp nhận nguồn đã khai báo", async () => {
    const allowed = await http().get("/api/vehicles").set("Origin", "http://localhost:3000");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");

    const other = await http().get("/api/vehicles").set("Origin", "https://trang-la.example");
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("trường lạ trong body bị từ chối: không tự nâng quyền hay đổi tiền qua body", async () => {
    const renter = await makeUser(ctx, "renter");
    const patches = [{ fullName: "Tên Mới", role: "admin" }, { licenseStatus: "verified" }, { status: "active", email: "khac@test.vn" }];
    for (const body of patches) {
      expect((await http().patch("/api/me").set(renter.auth).send(body)).status).toBe(400);
    }
    const register = { email: "moi@test.vn", password: "Password123!", fullName: "Người Mới", phone: "0901234567", role: "admin" };
    expect((await http().post("/api/auth/register").send(register)).status).toBe(400);

    const row = await ctx.prisma.user.findUniqueOrThrow({ where: { id: renter.user.id } });
    expect(row).toMatchObject({ role: "renter", licenseStatus: "none", fullName: renter.user.fullName });
    expect(await ctx.prisma.user.count({ where: { role: "admin" } })).toBe(0);
  });
});
