import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { Response } from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { PrismaService } from "../src/common/prisma/prisma.service";

const PASSWORD = "Password123!";
const VALID_REGISTER = {
  email: "An@Example.com",
  password: PASSWORD,
  fullName: "Nguyễn Văn An",
  phone: "0901 234 567",
  role: "renter",
};

describe("Auth API", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const nest = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(nest);
    await nest.init();
    app = nest;
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe("TRUNCATE TABLE refresh_tokens, users CASCADE");
  });

  const http = () => request(app.getHttpServer());

  function refreshCookie(res: Response): string | undefined {
    const cookies = res.headers["set-cookie"] as unknown as string[] | undefined;
    return cookies?.find((cookie) => cookie.startsWith("refresh_token="));
  }

  function cookiePair(cookie: string): string {
    return cookie.split(";")[0];
  }

  async function register(overrides: Record<string, unknown> = {}): Promise<Response> {
    return http()
      .post("/api/auth/register")
      .send({ ...VALID_REGISTER, ...overrides });
  }

  async function login(email = "an@example.com", password = PASSWORD): Promise<Response> {
    return http().post("/api/auth/login").send({ email, password });
  }

  async function registerAndLogin(overrides: Record<string, unknown> = {}) {
    await register(overrides);
    const res = await login(String(overrides.email ?? VALID_REGISTER.email).toLowerCase());
    return { res, accessToken: res.body.accessToken as string, cookie: refreshCookie(res) as string };
  }

  describe("POST /api/auth/register", () => {
    it("tạo tài khoản, chuẩn hóa email và số điện thoại, không trả mật khẩu", async () => {
      const res = await register();

      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({
        email: "an@example.com",
        fullName: "Nguyễn Văn An",
        phone: "0901234567",
        role: "renter",
        status: "active",
        licenseStatus: "none",
      });
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|argon2/);
      // Chưa đăng nhập: không có cookie phiên
      expect(refreshCookie(res)).toBeUndefined();
    });

    it("lưu mật khẩu đã băm argon2id, không lưu mật khẩu gốc", async () => {
      await register();
      const row = await prisma.user.findUniqueOrThrow({ where: { email: "an@example.com" } });
      expect(row.passwordHash).toMatch(/^\$argon2id\$/);
      expect(row.passwordHash).not.toContain(PASSWORD);
    });

    it("từ chối email đã đăng ký, kể cả khác chữ hoa chữ thường", async () => {
      await register();
      const res = await register({ email: "AN@example.COM" });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ code: "EMAIL_TAKEN", message: expect.any(String) });
    });

    it("không cho tự đăng ký làm admin", async () => {
      const res = await register({ role: "admin" });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(await prisma.user.count()).toBe(0);
    });

    it("cho đăng ký làm chủ xe", async () => {
      const res = await register({ role: "owner" });
      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe("owner");
    });

    it.each([
      ["mật khẩu quá ngắn", { password: "short1" }],
      ["email sai định dạng", { email: "khong-phai-email" }],
      ["số điện thoại sai", { phone: "12345" }],
      ["tên quá ngắn", { fullName: "A" }],
      ["thiếu trường bắt buộc", { fullName: undefined }],
    ])("trả 400 VALIDATION_ERROR khi %s", async (_label, overrides) => {
      const res = await register(overrides);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(typeof res.body.message).toBe("string");
    });

    it("từ chối trường lạ trong body (chống tự gán status, license...)", async () => {
      const res = await register({ status: "active", licenseStatus: "verified" });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      await register();
    });

    it("trả access token, thông tin người dùng và đặt refresh token trong cookie httpOnly", async () => {
      const res = await login("AN@example.com");

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ expiresIn: 900, user: { email: "an@example.com", role: "renter" } });
      expect(typeof res.body.accessToken).toBe("string");
      expect(res.body.refreshToken).toBeUndefined();

      const cookie = refreshCookie(res);
      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Path=\/api\/auth/);
      expect(cookie).toMatch(/Max-Age=604800/);
    });

    it("access token chứa id và có hạn 15 phút", async () => {
      const res = await login();
      const payload = jwt.decode(res.body.accessToken) as { sub: string; role: string; iat: number; exp: number };
      expect(payload.sub).toBe(res.body.user.id);
      expect(payload.role).toBe("renter");
      expect(payload.exp - payload.iat).toBe(900);
    });

    it("chỉ lưu băm của refresh token trong DB", async () => {
      const res = await login();
      const raw = cookiePair(refreshCookie(res) as string).replace("refresh_token=", "");
      const rows = await prisma.refreshToken.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0].tokenHash).not.toBe(raw);
      expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("sai mật khẩu và sai email cùng trả 401 INVALID_CREDENTIALS với cùng thông báo", async () => {
      const wrongPassword = await login("an@example.com", "SaiMatKhau1!");
      const unknownEmail = await login("khong-ton-tai@example.com");

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body).toEqual(unknownEmail.body);
      expect(wrongPassword.body.code).toBe("INVALID_CREDENTIALS");
      expect(refreshCookie(wrongPassword)).toBeUndefined();
    });

    it("tài khoản bị khóa không đăng nhập được", async () => {
      await prisma.user.update({ where: { email: "an@example.com" }, data: { status: "blocked" } });
      const res = await login();
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ACCOUNT_BLOCKED");
    });

    it("không tiết lộ tài khoản bị khóa khi nhập sai mật khẩu", async () => {
      await prisma.user.update({ where: { email: "an@example.com" }, data: { status: "blocked" } });
      const res = await login("an@example.com", "SaiMatKhau1!");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_CREDENTIALS");
    });
  });

  describe("GET/PATCH /api/me", () => {
    it("mặc định chặn mọi truy cập không có token", async () => {
      const res = await http().get("/api/me");
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ code: "UNAUTHORIZED", message: expect.any(String) });
    });

    it("trả hồ sơ của chính người đăng nhập", async () => {
      const { accessToken } = await registerAndLogin();
      const res = await http().get("/api/me").set("Authorization", `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ email: "an@example.com", fullName: "Nguyễn Văn An" });
      expect(res.body.passwordHash).toBeUndefined();
    });

    it("sửa được tên và số điện thoại", async () => {
      const { accessToken } = await registerAndLogin();
      const res = await http()
        .patch("/api/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ fullName: "  Nguyễn An Mới ", phone: "+84 912 345 678" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ fullName: "Nguyễn An Mới", phone: "+84912345678" });
    });

    it.each([
      ["role", { role: "admin" }],
      ["email", { email: "khac@example.com" }],
      ["status", { status: "blocked" }],
      ["licenseStatus", { licenseStatus: "verified" }],
    ])("không cho tự sửa %s", async (_field, body) => {
      const { accessToken } = await registerAndLogin();
      const res = await http().patch("/api/me").set("Authorization", `Bearer ${accessToken}`).send(body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");

      const row = await prisma.user.findUniqueOrThrow({ where: { email: "an@example.com" } });
      expect(row.role).toBe("renter");
      expect(row.status).toBe("active");
      expect(row.licenseStatus).toBe("none");
    });

    it("body rỗng trả 400", async () => {
      const { accessToken } = await registerAndLogin();
      const res = await http().patch("/api/me").set("Authorization", `Bearer ${accessToken}`).send({});
      expect(res.status).toBe(400);
    });
  });

  describe("kiểm tra access token", () => {
    async function meWith(token: string): Promise<Response> {
      return http().get("/api/me").set("Authorization", `Bearer ${token}`);
    }

    it("từ chối token đã hết hạn", async () => {
      const { res } = await registerAndLogin();
      const expired = await jwt.signAsync({ sub: res.body.user.id, role: "renter" }, { expiresIn: "-1s" });
      const out = await meWith(expired);
      expect(out.status).toBe(401);
      expect(out.body.code).toBe("UNAUTHORIZED");
    });

    it("từ chối token bị sửa chữ ký", async () => {
      const { accessToken } = await registerAndLogin();
      const tampered = `${accessToken.slice(0, -4)}${accessToken.endsWith("AAAA") ? "BBBB" : "AAAA"}`;
      expect((await meWith(tampered)).status).toBe(401);
    });

    it("từ chối token ký bằng secret khác", async () => {
      const { res } = await registerAndLogin();
      const forged = await new JwtService({ secret: "mot-secret-khac-hoan-toan-0123456789" }).signAsync({
        sub: res.body.user.id,
        role: "admin",
      });
      expect((await meWith(forged)).status).toBe(401);
    });

    it("từ chối token alg=none", async () => {
      const { res } = await registerAndLogin();
      const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
      const unsigned = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: res.body.user.id, role: "admin" })}.`;
      expect((await meWith(unsigned)).status).toBe(401);
    });

    it("từ chối khi không dùng scheme Bearer", async () => {
      const { accessToken } = await registerAndLogin();
      const out = await http().get("/api/me").set("Authorization", accessToken);
      expect(out.status).toBe(401);
    });

    it("tài khoản bị khóa mất quyền ngay dù access token còn hạn", async () => {
      const { accessToken } = await registerAndLogin();
      await prisma.user.update({ where: { email: "an@example.com" }, data: { status: "blocked" } });
      const out = await meWith(accessToken);
      expect(out.status).toBe(403);
      expect(out.body.code).toBe("ACCOUNT_BLOCKED");
    });

    it("tài khoản đã bị xóa thì token vô hiệu", async () => {
      const { accessToken } = await registerAndLogin();
      await prisma.$executeRawUnsafe("TRUNCATE TABLE refresh_tokens, users CASCADE");
      expect((await meWith(accessToken)).status).toBe(401);
    });

    it("quyền lấy theo vai trò hiện tại trong DB, không theo vai trò ghi trong token", async () => {
      const { res } = await registerAndLogin();
      // Token tự khai role=admin nhưng đã ký đúng secret: hệ thống vẫn phải coi người này là renter.
      const claimsAdmin = await jwt.signAsync({ sub: res.body.user.id, role: "admin" });
      const out = await meWith(claimsAdmin);
      expect(out.status).toBe(200);
      expect(out.body.role).toBe("renter");
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("đổi refresh token lấy access token mới và xoay vòng cookie", async () => {
      const { cookie } = await registerAndLogin();

      const res = await http().post("/api/auth/refresh").set("Cookie", cookiePair(cookie));
      expect(res.status).toBe(200);
      expect(typeof res.body.accessToken).toBe("string");

      const next = refreshCookie(res) as string;
      expect(next).toBeDefined();
      expect(cookiePair(next)).not.toBe(cookiePair(cookie));

      const me = await http().get("/api/me").set("Authorization", `Bearer ${res.body.accessToken}`);
      expect(me.status).toBe(200);
    });

    it("thiếu cookie trả 401 INVALID_REFRESH_TOKEN", async () => {
      const res = await http().post("/api/auth/refresh");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_REFRESH_TOKEN");
    });

    it("cookie rác trả 401", async () => {
      const res = await http().post("/api/auth/refresh").set("Cookie", "refresh_token=khong-hop-le");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_REFRESH_TOKEN");
    });

    it("dùng lại refresh token cũ bị coi là bị lộ: thu hồi mọi phiên của người dùng", async () => {
      const { cookie: first } = await registerAndLogin();

      const rotated = await http().post("/api/auth/refresh").set("Cookie", cookiePair(first));
      expect(rotated.status).toBe(200);
      const second = refreshCookie(rotated) as string;

      const replay = await http().post("/api/auth/refresh").set("Cookie", cookiePair(first));
      expect(replay.status).toBe(401);

      // Token mới cấp hợp lệ trước đó cũng bị thu hồi
      const afterReplay = await http().post("/api/auth/refresh").set("Cookie", cookiePair(second));
      expect(afterReplay.status).toBe(401);
      expect(await prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
    });

    it("hai request đồng thời với cùng một token chỉ một request thành công", async () => {
      const { cookie } = await registerAndLogin();
      const results = await Promise.all([
        http().post("/api/auth/refresh").set("Cookie", cookiePair(cookie)),
        http().post("/api/auth/refresh").set("Cookie", cookiePair(cookie)),
      ]);
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(results.filter((r) => r.status === 401)).toHaveLength(1);
    });

    it("từ chối refresh token đã hết hạn", async () => {
      const { cookie } = await registerAndLogin();
      await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      const res = await http().post("/api/auth/refresh").set("Cookie", cookiePair(cookie));
      expect(res.status).toBe(401);
    });

    it("tài khoản bị khóa không refresh được và mọi phiên bị thu hồi", async () => {
      const { cookie } = await registerAndLogin();
      await prisma.user.update({ where: { email: "an@example.com" }, data: { status: "blocked" } });
      const res = await http().post("/api/auth/refresh").set("Cookie", cookiePair(cookie));
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ACCOUNT_BLOCKED");
      expect(await prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("thu hồi refresh token và xóa cookie", async () => {
      const { cookie } = await registerAndLogin();

      const out = await http().post("/api/auth/logout").set("Cookie", cookiePair(cookie));
      expect(out.status).toBe(204);
      expect(refreshCookie(out)).toMatch(/refresh_token=;/);

      const refresh = await http().post("/api/auth/refresh").set("Cookie", cookiePair(cookie));
      expect(refresh.status).toBe(401);
    });

    it("không cần access token còn hạn và gọi lặp lại vẫn trả 204", async () => {
      const first = await http().post("/api/auth/logout");
      const second = await http().post("/api/auth/logout").set("Cookie", "refresh_token=khong-hop-le");
      expect(first.status).toBe(204);
      expect(second.status).toBe(204);
    });

    it("đăng xuất một thiết bị không ảnh hưởng thiết bị khác", async () => {
      await register();
      const deviceA = refreshCookie(await login()) as string;
      const deviceB = refreshCookie(await login()) as string;

      await http().post("/api/auth/logout").set("Cookie", cookiePair(deviceA));

      const stillOk = await http().post("/api/auth/refresh").set("Cookie", cookiePair(deviceB));
      expect(stillOk.status).toBe(200);
    });
  });

  describe("định dạng lỗi và bảo mật chung", () => {
    it("route không tồn tại trả { code, message }", async () => {
      const res = await http().get("/api/khong-co");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ code: "NOT_FOUND", message: expect.any(String) });
    });

    it("có header bảo mật của helmet", async () => {
      const res = await http().get("/api/me");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });

    it("CORS chỉ cho phép origin đã khai báo và có credentials", async () => {
      const allowed = await http().options("/api/auth/login").set("Origin", "http://localhost:3000");
      expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
      expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

      const denied = await http().options("/api/auth/login").set("Origin", "http://ke-tan-cong.example");
      expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("giới hạn số lần đăng nhập theo IP (429 TOO_MANY_REQUESTS)", async () => {
      process.env.THROTTLE_DISABLED = "0";
      try {
        const statuses: number[] = [];
        for (let i = 0; i < 6; i++) {
          statuses.push((await login("an@example.com", "SaiMatKhau1!")).status);
        }
        expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
        expect(statuses[5]).toBe(429);

        const blocked = await login("an@example.com", "SaiMatKhau1!");
        expect(blocked.body.code).toBe("TOO_MANY_REQUESTS");
      } finally {
        process.env.THROTTLE_DISABLED = "1";
      }
    });
  });
});
