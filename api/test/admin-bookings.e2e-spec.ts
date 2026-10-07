import request from "supertest";
import { createTestApp, DAY_MS, makeBooking, makeUser, makeVehicle, resetDatabase, TestContext } from "./helpers";

describe("Admin bookings API", () => {
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

  // Mỗi đơn một khoảng ngày riêng: ràng buộc bookings_no_overlap không cho hai đơn đang giữ chỗ trùng lịch trên một xe.
  const range = (slot: number) => {
    const start = new Date(Date.now() + (3 + slot * 3) * DAY_MS);
    return [start, new Date(start.getTime() + DAY_MS)] as const;
  };

  async function setup() {
    const admin = await makeUser(ctx, "admin");
    const owner = await makeUser(ctx, "owner");
    const renter = await makeUser(ctx, "renter");
    const vehicle = await makeVehicle(ctx, owner.user.id, { status: "approved" });
    return { admin, owner, renter, vehicle };
  }

  it("chưa đăng nhập: 401; chủ xe và khách thuê: 403", async () => {
    const { owner, renter } = await setup();
    expect((await http().get("/api/admin/bookings")).status).toBe(401);
    for (const who of [owner, renter]) {
      expect((await http().get("/api/admin/bookings").set(who.auth)).status).toBe(403);
    }
  });

  it("thấy đơn của mọi người, kèm khách, chủ xe và tiền đã ghi nhận cho chủ xe", async () => {
    const { admin, owner, renter, vehicle } = await setup();
    const otherOwner = await makeUser(ctx, "owner");
    const otherVehicle = await makeVehicle(ctx, otherOwner.user.id, { status: "approved" });
    const first = await makeBooking(ctx, vehicle.id, renter.user.id, ...range(0));
    await makeBooking(ctx, otherVehicle.id, renter.user.id, ...range(1));

    const res = await http().get("/api/admin/bookings").set(admin.auth);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    const item = res.body.items.find((b: { id: string }) => b.id === first.id);
    expect(item).toMatchObject({
      status: "confirmed",
      totalAmount: 650000,
      depositAmount: 195000,
      payableAmount: 845000,
      ownerPayoutAmount: 0,
      renter: { fullName: renter.user.fullName, phone: renter.user.phone },
      owner: { fullName: owner.user.fullName, phone: owner.user.phone },
      vehicle: { id: vehicle.id },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/renterId|ownerId|passwordHash/);
  });

  it("khác chủ xe: admin thấy cả đơn khách chưa thanh toán", async () => {
    const { admin, renter, vehicle } = await setup();
    const pending = await makeBooking(ctx, vehicle.id, renter.user.id, ...range(0), "pending");

    const res = await http().get("/api/admin/bookings").set(admin.auth);

    expect(res.body.items.map((b: { id: string }) => b.id)).toEqual([pending.id]);
  });

  it("lọc theo trạng thái hiệu lực: đơn pending quá hạn tính là expired", async () => {
    const { admin, renter, vehicle } = await setup();
    const confirmed = await makeBooking(ctx, vehicle.id, renter.user.id, ...range(0));
    const stale = await makeBooking(ctx, vehicle.id, renter.user.id, ...range(1), "pending");
    await ctx.prisma.booking.update({ where: { id: stale.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });

    const ids = async (status: string) =>
      (await http().get(`/api/admin/bookings?status=${status}`).set(admin.auth)).body.items.map((b: { id: string }) => b.id);

    expect(await ids("confirmed")).toEqual([confirmed.id]);
    expect(await ids("expired")).toEqual([stale.id]);
    expect(await ids("pending")).toEqual([]);
  });

  it("sổ tiền cộng trên mọi đơn, không theo bộ lọc hay trang, và phần đang giữ = đã thu - đã hoàn - đã trả chủ xe", async () => {
    const { admin, renter, vehicle } = await setup();
    await makeBooking(ctx, vehicle.id, renter.user.id, ...range(0));
    const done = await makeBooking(ctx, vehicle.id, renter.user.id, ...range(1), "completed");
    await ctx.prisma.booking.update({ where: { id: done.id }, data: { ownerPayoutAmount: 650000, refundAmount: 195000 } });
    await makeBooking(ctx, vehicle.id, renter.user.id, ...range(2), "pending");

    const expected = { paidAmount: 1690000, refundAmount: 195000, ownerPayoutAmount: 650000, heldAmount: 845000 };
    for (const query of ["", "?status=pending", "?limit=1&page=3"]) {
      expect((await http().get(`/api/admin/bookings${query}`).set(admin.auth)).body.totals).toEqual(expected);
    }
  });

  it("không có đơn nào: danh sách rỗng và sổ tiền bằng 0", async () => {
    const { admin } = await setup();
    const res = await http().get("/api/admin/bookings").set(admin.auth);
    expect(res.body).toMatchObject({ items: [], total: 0, totals: { paidAmount: 0, refundAmount: 0, ownerPayoutAmount: 0, heldAmount: 0 } });
  });

  it("phân trang và từ chối tham số sai", async () => {
    const { admin, renter, vehicle } = await setup();
    for (let slot = 0; slot < 3; slot += 1) await makeBooking(ctx, vehicle.id, renter.user.id, ...range(slot));

    const page = await http().get("/api/admin/bookings?limit=2&page=2").set(admin.auth);
    expect(page.body).toMatchObject({ total: 3, page: 2, limit: 2 });
    expect(page.body.items).toHaveLength(1);

    for (const query of ["status=done", "limit=51", "page=0"]) {
      expect((await http().get(`/api/admin/bookings?${query}`).set(admin.auth)).status).toBe(400);
    }
  });
});
