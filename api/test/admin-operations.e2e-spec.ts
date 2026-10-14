import request from "supertest";
import { createTestApp, DAY_MS, makeBooking, makeUser, makeVehicle, resetDatabase, TestContext } from "./helpers";

type Made = Awaited<ReturnType<typeof makeUser>>;

describe("Admin: tổng quan và các thao tác can thiệp", () => {
  let ctx: TestContext;
  let admin: Made;
  let owner: Made;
  let renter: Made;
  const http = () => request(ctx.app.getHttpServer());
  const actions = () => ctx.prisma.adminAction.findMany({ orderBy: { id: "asc" } });
  const inDays = (days: number) => new Date(Date.now() + days * DAY_MS);

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    admin = await makeUser(ctx, "admin");
    owner = await makeUser(ctx, "owner");
    renter = await makeUser(ctx, "renter");
  });

  describe("phân quyền", () => {
    it("các endpoint mới: chưa đăng nhập 401; khách, chủ xe và dev 403", async () => {
      const vehicle = await makeVehicle(ctx, owner.user.id);
      const booking = await makeBooking(ctx, vehicle.id, renter.user.id, inDays(3), inDays(4));
      const calls: ["get" | "post", string][] = [
        ["get", "/api/admin/overview"],
        ["get", `/api/admin/users/${renter.user.id}`],
        ["post", `/api/admin/users/${renter.user.id}/reset-password`],
        ["post", `/api/admin/vehicles/${vehicle.id}/takedown`],
        ["post", `/api/admin/bookings/${booking.id}/cancel`],
      ];
      const dev = await makeUser(ctx, "dev");
      for (const [method, path] of calls) {
        expect([path, (await http()[method](path)).status]).toEqual([path, 401]);
        for (const who of [renter, owner, dev]) {
          expect([path, (await http()[method](path).set(who.auth).send({ reason: "x", rentalRefundPercent: 100 })).status]).toEqual([path, 403]);
        }
      }
      expect(await actions()).toEqual([]);
    });
  });

  describe("GET /admin/overview", () => {
    it("hàng chờ, tổng số, chuỗi theo ngày và phễu đơn", async () => {
      const approved = await makeVehicle(ctx, owner.user.id, { city: "Đà Nẵng" });
      await makeVehicle(ctx, owner.user.id, { status: "pending" });
      await ctx.prisma.user.update({ where: { id: renter.user.id }, data: { licenseStatus: "pending", licenseFrontKey: "licenses/x/front.webp" } });
      await makeBooking(ctx, approved.id, renter.user.id, inDays(-6), inDays(-5), "completed");
      await makeBooking(ctx, approved.id, renter.user.id, inDays(-1), inDays(1), "in_use");
      await makeBooking(ctx, approved.id, renter.user.id, inDays(5), inDays(6), "confirmed");
      await makeBooking(ctx, approved.id, renter.user.id, inDays(9), inDays(10), "cancelled");
      await makeBooking(ctx, approved.id, renter.user.id, inDays(12), inDays(13), "pending");

      const res = await http().get("/api/admin/overview?days=7").set(admin.auth);
      expect(res.status).toBe(200);
      expect(res.body.days).toBe(7);
      expect(res.body.queues).toEqual({ pendingVehicles: 1, pendingLicenses: 1, awaitingOwnerApproval: 0, inUse: 1 });
      expect(res.body.totals).toMatchObject({
        users: { admin: 1, owner: 1, renter: 1 },
        vehicles: { approved: 1, pending: 1 },
        bookings: 5,
        paidAmount: 3 * 845000,
      });

      expect(res.body.series).toHaveLength(7);
      const today = res.body.series[6];
      expect(today).toMatchObject({ newUsers: 3, newVehicles: 2, bookingsCreated: 5, bookingsPaid: 3, paidAmount: 3 * 845000 });
      expect(today.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(res.body.series[0]).toMatchObject({ newUsers: 0, bookingsCreated: 0, paidAmount: 0 });

      expect(res.body.performance).toMatchObject({ created: 5, paid: 3, completed: 1, cancelled: 1, rejected: 0, expired: 0, avgBookingValue: 650000, avgRentalDays: 1 });
      expect(res.body.performance.topCities).toEqual([{ city: "Đà Nẵng", bookings: 5, paidAmount: 3 * 845000 }]);
      // Hai ngày-xe đã thuê (một đơn hoàn tất, một ngày của đơn đang thuê) trên một xe trong khoảng gần 7 ngày.
      expect(res.body.performance.utilizationPercent).toBeGreaterThan(20);
      expect(res.body.performance.utilizationPercent).toBeLessThan(40);
    });

    it("chưa có dữ liệu: chỉ số không tính được là null, không phải 0; days sai trả 400", async () => {
      const res = await http().get("/api/admin/overview").set(admin.auth);
      expect(res.body.days).toBe(30);
      expect(res.body.series).toHaveLength(30);
      expect(res.body.performance).toMatchObject({
        created: 0, avgOwnerResponseHours: null, avgVehicleReviewHours: null, avgBookingValue: null, avgRentalDays: null, utilizationPercent: null, topCities: [],
      });
      expect((await http().get("/api/admin/overview?days=15").set(admin.auth)).status).toBe(400);
    });
  });

  describe("POST /admin/vehicles/:id/takedown", () => {
    it("gỡ xe đã duyệt: thành rejected kèm lý do, biến mất khỏi trang công khai, có nhật ký; gọi lại giữ lý do đầu", async () => {
      const vehicle = await makeVehicle(ctx, owner.user.id);
      expect((await http().get(`/api/vehicles/${vehicle.id}`)).status).toBe(200);

      const res = await http().post(`/api/admin/vehicles/${vehicle.id}/takedown`).set(admin.auth).send({ reason: "Ảnh không đúng xe" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: vehicle.id, status: "rejected", rejectReason: "Ảnh không đúng xe" });
      expect((await http().get(`/api/vehicles/${vehicle.id}`)).status).toBe(404);

      const again = await http().post(`/api/admin/vehicles/${vehicle.id}/takedown`).set(admin.auth).send({ reason: "Lý do khác" });
      expect(again.body.rejectReason).toBe("Ảnh không đúng xe");
      expect(await actions()).toMatchObject([
        { action: "vehicle.takedown", adminId: admin.user.id, targetVehicleId: vehicle.id, reason: "Ảnh không đúng xe", details: { previousStatus: "approved" } },
      ]);
    });

    it("gỡ được xe đang ẩn; không gỡ xe đang chờ duyệt; thiếu lý do 400; đơn đã có giữ nguyên", async () => {
      const hidden = await makeVehicle(ctx, owner.user.id, { status: "hidden" });
      const pending = await makeVehicle(ctx, owner.user.id, { status: "pending" });
      const booking = await makeBooking(ctx, hidden.id, renter.user.id, inDays(3), inDays(4), "confirmed");

      expect((await http().post(`/api/admin/vehicles/${hidden.id}/takedown`).set(admin.auth).send({})).status).toBe(400);
      expect((await http().post(`/api/admin/vehicles/${hidden.id}/takedown`).set(admin.auth).send({ reason: "Có khiếu nại" })).body.status).toBe("rejected");
      expect((await http().post(`/api/admin/vehicles/${pending.id}/takedown`).set(admin.auth).send({ reason: "x" })).status).toBe(409);
      expect((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("confirmed");
    });

    it("tìm xe theo tiêu đề, biển số (gõ có dấu gạch) và email chủ xe", async () => {
      const car = await makeVehicle(ctx, owner.user.id, { title: "Mazda CX-5 2022", plateNumber: "43A12345" });
      await makeVehicle(ctx, (await makeUser(ctx, "owner")).user.id, { title: "Kia Morning 2020", plateNumber: "30F99999" });
      const ids = async (q: string) =>
        ((await http().get(`/api/admin/vehicles?q=${encodeURIComponent(q)}`).set(admin.auth)).body.items as { id: string }[]).map((v) => v.id);

      expect(await ids("cx-5")).toEqual([car.id]);
      expect(await ids("43a-123.45")).toEqual([car.id]);
      expect(await ids(owner.user.email)).toEqual([car.id]);
      expect(await ids("không có xe này")).toEqual([]);
    });
  });

  describe("POST /admin/bookings/:id/cancel", () => {
    const cancel = (id: string, body: object) => http().post(`/api/admin/bookings/${id}/cancel`).set(admin.auth).send(body);
    const money = async (id: string) => {
      const b = await ctx.prisma.booking.findUniqueOrThrow({ where: { id } });
      return { status: b.status, refund: b.refundAmount, payout: b.ownerPayoutAmount, paid: b.paidAmount };
    };

    it("đơn đã xác nhận: admin quyết định phần tiền thuê hoàn, cọc luôn về khách, không đồng nào bị treo", async () => {
      const vehicle = await makeVehicle(ctx, owner.user.id);
      const booking = await makeBooking(ctx, vehicle.id, renter.user.id, inDays(3), inDays(4), "confirmed");

      const res = await cancel(booking.id, { reason: "Chủ xe báo xe hỏng", rentalRefundPercent: 100 });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "cancelled", cancelReason: "Chủ xe báo xe hỏng", refundAmount: 845000, ownerPayoutAmount: 0 });
      expect(res.body.owner.fullName).toBe(owner.user.fullName);
      expect(await actions()).toMatchObject([
        { action: "booking.cancel", targetBookingId: booking.id, reason: "Chủ xe báo xe hỏng", details: { previousStatus: "confirmed", rentalRefundPercent: 100, refundAmount: 845000, ownerPayoutAmount: 0 } },
      ]);
      const saved = await ctx.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(saved.cancelledById).toBe(admin.user.id);
      expect(saved.cancelledAt).not.toBeNull();
    });

    it.each([
      [0, 195000, 650000],
      [30, 390000, 455000],
      [50, 520000, 325000],
    ])("đơn đang thuê, hoàn %i%% tiền thuê: khách nhận %i, chủ xe nhận %i (thay cho 50%% đã ghi lúc giao xe)", async (percent, refund, payout) => {
      const vehicle = await makeVehicle(ctx, owner.user.id);
      const booking = await makeBooking(ctx, vehicle.id, renter.user.id, inDays(-1), inDays(1), "in_use");
      await ctx.prisma.booking.update({ where: { id: booking.id }, data: { ownerPayoutAmount: 325000 } });

      expect((await cancel(booking.id, { reason: "Xe hỏng giữa chuyến", rentalRefundPercent: percent })).status).toBe(200);
      expect(await money(booking.id)).toEqual({ status: "cancelled", refund, payout, paid: 845000 });
      expect(refund + payout).toBe(845000);
    });

    it("đơn chờ chưa thanh toán: hủy được, không có tiền nào để chia", async () => {
      const vehicle = await makeVehicle(ctx, owner.user.id);
      const booking = await makeBooking(ctx, vehicle.id, renter.user.id, inDays(3), inDays(4), "pending");
      expect((await cancel(booking.id, { reason: "Tài khoản đặt xe gian lận", rentalRefundPercent: 0 })).status).toBe(200);
      expect(await money(booking.id)).toEqual({ status: "cancelled", refund: 0, payout: 0, paid: 0 });
    });

    it("hủy xong thì lịch của xe được nhả cho khách khác", async () => {
      const vehicle = await makeVehicle(ctx, owner.user.id);
      const booking = await makeBooking(ctx, vehicle.id, renter.user.id, inDays(3), inDays(4), "confirmed");
      await cancel(booking.id, { reason: "Tranh chấp", rentalRefundPercent: 100 });
      await expect(makeBooking(ctx, vehicle.id, renter.user.id, inDays(3), inDays(4), "confirmed")).resolves.toBeDefined();
    });

    it("gọi lại trên đơn đã hủy: giữ nguyên tiền và lý do, không ghi thêm nhật ký", async () => {
      const vehicle = await makeVehicle(ctx, owner.user.id);
      const booking = await makeBooking(ctx, vehicle.id, renter.user.id, inDays(3), inDays(4), "confirmed");
      await cancel(booking.id, { reason: "Lần đầu", rentalRefundPercent: 100 });
      const again = await cancel(booking.id, { reason: "Lần hai", rentalRefundPercent: 0 });
      expect(again.body).toMatchObject({ status: "cancelled", cancelReason: "Lần đầu", refundAmount: 845000 });
      expect(await actions()).toHaveLength(1);
    });

    it("không can thiệp được đơn đã hoàn tất, bị từ chối hay hết hạn; dữ liệu sai trả 400", async () => {
      const vehicle = await makeVehicle(ctx, owner.user.id);
      const completed = await makeBooking(ctx, vehicle.id, renter.user.id, inDays(-6), inDays(-5), "completed");
      const rejected = await makeBooking(ctx, vehicle.id, renter.user.id, inDays(3), inDays(4), "rejected");
      const overdue = await makeBooking(ctx, vehicle.id, renter.user.id, inDays(6), inDays(7), "pending");
      await ctx.prisma.booking.update({ where: { id: overdue.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
      for (const booking of [completed, rejected, overdue]) {
        expect((await cancel(booking.id, { reason: "x", rentalRefundPercent: 100 })).status).toBe(409);
      }
      expect((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: completed.id } })).status).toBe("completed");

      const live = await makeBooking(ctx, vehicle.id, renter.user.id, inDays(9), inDays(10), "confirmed");
      for (const body of [{ rentalRefundPercent: 100 }, { reason: "x" }, { reason: "x", rentalRefundPercent: 101 }, { reason: "x", rentalRefundPercent: -1 }, { reason: "x", rentalRefundPercent: 12.5 }, { reason: " ", rentalRefundPercent: 50 }]) {
        expect([JSON.stringify(body), (await cancel(live.id, body)).status]).toEqual([JSON.stringify(body), 400]);
      }
      expect((await cancel("00000000-0000-4000-8000-000000000000", { reason: "x", rentalRefundPercent: 0 })).status).toBe(404);
      expect(await actions()).toEqual([]);
    });

    it("khách và chủ xe đọc được lý do hủy trên đơn của mình", async () => {
      const vehicle = await makeVehicle(ctx, owner.user.id);
      const booking = await makeBooking(ctx, vehicle.id, renter.user.id, inDays(3), inDays(4), "confirmed");
      await cancel(booking.id, { reason: "Chủ xe không giao xe", rentalRefundPercent: 100 });
      for (const who of [renter, owner]) {
        const res = await http().get(`/api/bookings/${booking.id}`).set(who.auth);
        expect(res.body).toMatchObject({ status: "cancelled", cancelReason: "Chủ xe không giao xe" });
      }
    });
  });

  describe("khóa tài khoản kèm lý do và chi tiết người dùng", () => {
    it("khóa phải có lý do; lý do hiện ở chi tiết; mỗi lần đổi trạng thái thật mới ghi nhật ký", async () => {
      const block = (body: object) => http().post(`/api/admin/users/${renter.user.id}/block`).set(admin.auth).send(body);
      expect((await block({})).status).toBe(400);
      expect((await block({ reason: "  " })).status).toBe(400);
      expect((await block({ reason: "Đặt xe rồi không đến nhiều lần" })).status).toBe(200);
      expect((await block({ reason: "Bấm lần nữa" })).status).toBe(200);

      const detail = await http().get(`/api/admin/users/${renter.user.id}`).set(admin.auth);
      expect(detail.body).toMatchObject({ id: renter.user.id, status: "blocked", blockReason: "Đặt xe rồi không đến nhiều lần" });
      expect(detail.body.actions).toMatchObject([{ action: "user.block", reason: "Đặt xe rồi không đến nhiều lần", adminName: admin.user.fullName }]);

      await http().post(`/api/admin/users/${renter.user.id}/unblock`).set(admin.auth);
      await http().post(`/api/admin/users/${renter.user.id}/unblock`).set(admin.auth);
      const after = await http().get(`/api/admin/users/${renter.user.id}`).set(admin.auth);
      expect(after.body.blockReason).toBeNull();
      expect((after.body.actions as { action: string }[]).map((a) => a.action)).toEqual(["user.unblock", "user.block"]);
    });

    it("chi tiết gồm xe, đơn và không lộ dữ liệu bí mật", async () => {
      const vehicle = await makeVehicle(ctx, owner.user.id, { title: "Honda City 2021" });
      await makeBooking(ctx, vehicle.id, renter.user.id, inDays(3), inDays(4), "confirmed");

      const ownerDetail = await http().get(`/api/admin/users/${owner.user.id}`).set(admin.auth);
      expect(ownerDetail.body.vehicles).toMatchObject([{ id: vehicle.id, title: "Honda City 2021", status: "approved" }]);
      expect(ownerDetail.body.bookings).toEqual([]);

      const renterDetail = await http().get(`/api/admin/users/${renter.user.id}`).set(admin.auth);
      expect(renterDetail.body.bookings).toMatchObject([{ status: "confirmed", vehicleTitle: "Honda City 2021", totalAmount: 650000 }]);
      expect(JSON.stringify(renterDetail.body)).not.toMatch(/passwordHash|khong-dung-de-dang-nhap|licenseFrontKey/);

      expect((await http().get("/api/admin/users/00000000-0000-4000-8000-000000000000").set(admin.auth)).status).toBe(404);
    });
  });

  describe("đặt lại và đổi mật khẩu", () => {
    const login = (email: string, password: string) => http().post("/api/auth/login").send({ email, password });

    it("admin đặt lại: mật khẩu tạm đăng nhập được, phiên cũ bị thu hồi, nhật ký không chứa mật khẩu", async () => {
      await ctx.prisma.refreshToken.create({ data: { userId: renter.user.id, tokenHash: "phien-cu", expiresAt: inDays(7) } });

      const res = await http().post(`/api/admin/users/${renter.user.id}/reset-password`).set(admin.auth);
      expect(res.status).toBe(200);
      const temporary = res.body.temporaryPassword as string;
      expect(temporary).toMatch(/^[A-Za-z0-9]{14}$/);

      expect((await login(renter.user.email, temporary)).status).toBe(200);
      expect((await login(renter.user.email, "khong-dung-de-dang-nhap")).status).toBe(401);
      expect((await ctx.prisma.refreshToken.findFirstOrThrow({ where: { tokenHash: "phien-cu" } })).revokedAt).not.toBeNull();

      const log = await actions();
      expect(log).toMatchObject([{ action: "user.reset_password", targetUserId: renter.user.id }]);
      expect(JSON.stringify(log.map((entry) => [entry.reason, entry.details]))).not.toContain(temporary);
    });

    it("không đặt lại được cho chính mình hay admin khác", async () => {
      const other = await makeUser(ctx, "admin");
      for (const id of [admin.user.id, other.user.id]) {
        expect((await http().post(`/api/admin/users/${id}/reset-password`).set(admin.auth)).status).toBe(409);
      }
      expect(await actions()).toEqual([]);
    });

    it("người dùng tự đổi mật khẩu: cần đúng mật khẩu hiện tại, mật khẩu mới hợp lệ và khác cũ", async () => {
      const temporary = (await http().post(`/api/admin/users/${renter.user.id}/reset-password`).set(admin.auth)).body.temporaryPassword as string;
      const change = (body: object) => http().post("/api/me/password").set(renter.auth).send(body);

      expect((await http().post("/api/me/password").send({ currentPassword: temporary, newPassword: "MatKhauMoi123!" })).status).toBe(401);
      expect((await change({ currentPassword: "sai-mat-khau", newPassword: "MatKhauMoi123!" })).status).toBe(400);
      expect((await change({ currentPassword: temporary, newPassword: "ngan" })).status).toBe(400);
      expect((await change({ currentPassword: temporary, newPassword: temporary })).status).toBe(400);
      expect((await login(renter.user.email, temporary)).status).toBe(200);

      expect((await change({ currentPassword: temporary, newPassword: "MatKhauMoi123!" })).status).toBe(204);
      expect((await login(renter.user.email, "MatKhauMoi123!")).status).toBe(200);
      expect((await login(renter.user.email, temporary)).status).toBe(401);
      expect(await ctx.prisma.refreshToken.count({ where: { userId: renter.user.id, revokedAt: null } })).toBe(1);
    });
  });

  it("nhật ký thao tác chỉ thêm dòng: CSDL từ chối sửa và xóa", async () => {
    await http().post(`/api/admin/users/${renter.user.id}/block`).set(admin.auth).send({ reason: "Thử" });
    await expect(ctx.prisma.adminAction.updateMany({ data: { reason: "sửa lại" } })).rejects.toThrow();
    await expect(ctx.prisma.adminAction.deleteMany({})).rejects.toThrow();
    expect(await actions()).toMatchObject([{ reason: "Thử" }]);
  });
});
