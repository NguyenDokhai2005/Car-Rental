import request from "supertest";
import { createTestApp, DAY_MS, makeBooking, makeUser, makeVehicle, resetDatabase, TestContext } from "./helpers";

describe("Admin users API", () => {
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
  });

  const statusOf = async (id: string) => (await ctx.prisma.user.findUniqueOrThrow({ where: { id } })).status;

  describe("quyền truy cập", () => {
    it("chưa đăng nhập: 401", async () => {
      const renter = await makeUser(ctx, "renter");
      expect((await http().get("/api/admin/users")).status).toBe(401);
      expect((await http().post(`/api/admin/users/${renter.user.id}/block`)).status).toBe(401);
    });

    it("chủ xe và khách thuê bị 403, và không khóa được ai", async () => {
      const owner = await makeUser(ctx, "owner");
      const renter = await makeUser(ctx, "renter");
      for (const who of [owner, renter]) {
        expect((await http().get("/api/admin/users").set(who.auth)).status).toBe(403);
        expect((await http().post(`/api/admin/users/${renter.user.id}/block`).set(who.auth)).status).toBe(403);
        expect((await http().post(`/api/admin/users/${renter.user.id}/unblock`).set(who.auth)).status).toBe(403);
      }
      expect(await statusOf(renter.user.id)).toBe("active");
    });
  });

  describe("GET /admin/users", () => {
    it("trả người dùng kèm số xe và số đơn, không lộ mật khẩu hay khóa file GPLX", async () => {
      const admin = await makeUser(ctx, "admin");
      const owner = await makeUser(ctx, "owner");
      const renter = await makeUser(ctx, "renter");
      const vehicle = await makeVehicle(ctx, owner.user.id, { status: "approved" });
      const start = new Date(Date.now() + 3 * DAY_MS);
      await makeBooking(ctx, vehicle.id, renter.user.id, start, new Date(start.getTime() + DAY_MS));

      const res = await http().get("/api/admin/users").set(admin.auth);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
      const byId = new Map<string, Record<string, unknown>>(res.body.items.map((u: { id: string }) => [u.id, u]));
      expect(byId.get(owner.user.id)).toMatchObject({ role: "owner", vehicleCount: 1, bookingCount: 0 });
      expect(byId.get(renter.user.id)).toMatchObject({ role: "renter", vehicleCount: 0, bookingCount: 1 });
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|khong-dung-de-dang-nhap|licenseFrontKey|licenseBackKey/);
    });

    it("lọc theo vai trò, trạng thái và trạng thái GPLX", async () => {
      const admin = await makeUser(ctx, "admin");
      const renter = await makeUser(ctx, "renter");
      const blocked = await makeUser(ctx, "renter");
      await makeUser(ctx, "owner");
      await ctx.prisma.user.update({ where: { id: blocked.user.id }, data: { status: "blocked" } });
      // CSDL buộc hồ sơ GPLX đã nộp phải có ảnh mặt trước (ràng buộc users_license_front_when_submitted).
      await ctx.prisma.user.update({
        where: { id: renter.user.id },
        data: { licenseStatus: "verified", licenseFrontKey: `licenses/${renter.user.id}/front.webp` },
      });

      const ids = async (query: string) =>
        (await http().get(`/api/admin/users?${query}`).set(admin.auth)).body.items.map((u: { id: string }) => u.id);

      expect((await ids("role=renter")).sort()).toEqual([renter.user.id, blocked.user.id].sort());
      expect(await ids("status=blocked")).toEqual([blocked.user.id]);
      expect(await ids("licenseStatus=verified")).toEqual([renter.user.id]);
      expect(await ids("role=owner&status=blocked")).toEqual([]);
    });

    it("tìm theo họ tên, email hoặc số điện thoại, không phân biệt hoa thường", async () => {
      const admin = await makeUser(ctx, "admin");
      const target = await makeUser(ctx, "renter");
      await makeUser(ctx, "renter");
      await ctx.prisma.user.update({
        where: { id: target.user.id },
        data: { fullName: "Trần Thị Bích", email: "bich.tran@test.vn", phone: "0987654321" },
      });

      for (const q of ["bích", "BICH.TRAN", "0987654"]) {
        const res = await http().get("/api/admin/users").query({ q }).set(admin.auth);
        expect(res.body.items.map((u: { id: string }) => u.id)).toEqual([target.user.id]);
      }
    });

    it("phân trang và từ chối tham số sai", async () => {
      const admin = await makeUser(ctx, "admin");
      await makeUser(ctx, "renter");
      await makeUser(ctx, "renter");

      const page = await http().get("/api/admin/users?limit=2&page=2").set(admin.auth);
      expect(page.body).toMatchObject({ total: 3, page: 2, limit: 2 });
      expect(page.body.items).toHaveLength(1);

      for (const query of ["role=boss", "status=deleted", "licenseStatus=ok", "limit=51", "page=0", `q=${"a".repeat(101)}`]) {
        expect((await http().get(`/api/admin/users?${query}`).set(admin.auth)).status).toBe(400);
      }
    });
  });

  describe("POST /admin/users/:id/block và /unblock", () => {
    it("khóa có hiệu lực ngay với token đang dùng, mở khóa thì dùng lại được", async () => {
      const admin = await makeUser(ctx, "admin");
      const renter = await makeUser(ctx, "renter");
      expect((await http().get("/api/me").set(renter.auth)).status).toBe(200);

      const blocked = await http().post(`/api/admin/users/${renter.user.id}/block`).set(admin.auth);
      expect(blocked.status).toBe(200);
      expect(blocked.body).toMatchObject({ id: renter.user.id, status: "blocked", vehicleCount: 0, bookingCount: 0 });
      expect((await http().get("/api/me").set(renter.auth)).status).not.toBe(200);

      const unblocked = await http().post(`/api/admin/users/${renter.user.id}/unblock`).set(admin.auth);
      expect(unblocked.body.status).toBe("active");
      expect((await http().get("/api/me").set(renter.auth)).status).toBe(200);
    });

    it("gọi lặp lại vẫn thành công", async () => {
      const admin = await makeUser(ctx, "admin");
      const owner = await makeUser(ctx, "owner");
      for (let i = 0; i < 2; i += 1) {
        expect((await http().post(`/api/admin/users/${owner.user.id}/block`).set(admin.auth)).status).toBe(200);
      }
      expect(await statusOf(owner.user.id)).toBe("blocked");
      for (let i = 0; i < 2; i += 1) {
        expect((await http().post(`/api/admin/users/${owner.user.id}/unblock`).set(admin.auth)).status).toBe(200);
      }
      expect(await statusOf(owner.user.id)).toBe("active");
    });

    it("không khóa được chính mình hay admin khác: 409 và trạng thái giữ nguyên", async () => {
      const admin = await makeUser(ctx, "admin");
      const other = await makeUser(ctx, "admin");

      for (const id of [admin.user.id, other.user.id]) {
        const res = await http().post(`/api/admin/users/${id}/block`).set(admin.auth);
        expect(res.status).toBe(409);
        expect(res.body.code).toBe("INVALID_STATE");
        expect(await statusOf(id)).toBe("active");
      }
    });

    it("người dùng không tồn tại hoặc id sai định dạng: 404", async () => {
      const admin = await makeUser(ctx, "admin");
      for (const id of ["00000000-0000-4000-8000-000000000000", "khong-phai-uuid"]) {
        expect((await http().post(`/api/admin/users/${id}/block`).set(admin.auth)).status).toBe(404);
      }
    });

    it("khóa người dùng không đụng tới đơn đang có của họ", async () => {
      const admin = await makeUser(ctx, "admin");
      const owner = await makeUser(ctx, "owner");
      const renter = await makeUser(ctx, "renter");
      const vehicle = await makeVehicle(ctx, owner.user.id, { status: "approved" });
      const start = new Date(Date.now() + 3 * DAY_MS);
      const booking = await makeBooking(ctx, vehicle.id, renter.user.id, start, new Date(start.getTime() + DAY_MS));

      await http().post(`/api/admin/users/${renter.user.id}/block`).set(admin.auth);

      expect((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("confirmed");
    });
  });
});
