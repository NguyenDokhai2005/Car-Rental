import type { Booking, BookingStatus } from "@prisma/client";
import request from "supertest";
import { BookingExpiryJob } from "../src/bookings/booking-expiry.job";
import { BookingTransitionsService } from "../src/bookings/booking-transitions.service";
import { createTestApp, DAY_MS, makeUser, makeVehicle, resetDatabase, sleep, TestContext } from "./helpers";

const MIN_MS = 60_000;
const HOUR_MS = 60 * MIN_MS;

const TOTAL = 1_300_000; // tiền thuê
const DEPOSIT = 390_000; // tiền cọc bảo đảm, thu thêm ngoài tiền thuê
const PAID = TOTAL + DEPOSIT; // số khách trả một lần khi đặt

describe("Booking payment and state machine API", () => {
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

  async function verifiedRenter() {
    const u = await makeUser(ctx, "renter");
    await ctx.prisma.user.update({
      where: { id: u.user.id },
      data: { licenseStatus: "verified", licenseFrontKey: `licenses/${u.user.id}/front.jpg` },
    });
    return u;
  }

  type Seed = {
    status?: BookingStatus;
    paid?: boolean; // mặc định: các trạng thái từ confirmed trở đi là đã thanh toán
    startInMs?: number;
    lengthMs?: number;
    expiresInMs?: number | null;
    ownerHandedOver?: boolean;
    renterReceived?: boolean;
    renterReturned?: boolean;
    ownerReceivedBack?: boolean;
    total?: number;
    deposit?: number;
  };

  // Ghi thẳng một đơn ở trạng thái tùy ý vào CSDL, đủ các cột để thỏa ràng buộc của CSDL cho trạng thái đó.
  function seedBooking(vehicleId: string, renterId: string, seed: Seed = {}) {
    const status = seed.status ?? "pending";
    const total = seed.total ?? TOTAL;
    const deposit = seed.deposit ?? DEPOSIT;
    const paid = seed.paid ?? (status === "confirmed" || status === "in_use" || status === "completed");
    const startAt = new Date(Date.now() + (seed.startInMs ?? 5 * DAY_MS));
    const endAt = new Date(startAt.getTime() + (seed.lengthMs ?? 2 * DAY_MS));
    const defaultExpiry = status === "pending" ? (paid ? 6 * HOUR_MS : 15 * MIN_MS) : null;
    const expiresInMs = seed.expiresInMs === undefined ? defaultExpiry : seed.expiresInMs;
    const handedOver = status === "in_use" || status === "completed";
    const done = status === "completed";
    // Đơn đã kết thúc mà khách từng thanh toán: tiền đã được chia hết.
    const refunded = paid && (status === "rejected" || status === "expired" || status === "cancelled");

    return ctx.prisma.booking.create({
      data: {
        vehicleId,
        renterId,
        startAt,
        endAt,
        status,
        rentalDays: 2,
        pricePerDay: total / 2,
        totalAmount: total,
        depositAmount: deposit,
        expiresAt: expiresInMs === null ? null : new Date(Date.now() + expiresInMs),
        paidAt: paid ? new Date() : null,
        paidAmount: paid ? total + deposit : 0,
        ownerApprovedAt: status === "confirmed" || handedOver ? new Date() : null,
        ownerHandedOverAt: handedOver || seed.ownerHandedOver ? new Date() : null,
        renterReceivedAt: handedOver || seed.renterReceived ? new Date() : null,
        startedAt: handedOver ? new Date() : null,
        renterReturnedAt: done || seed.renterReturned ? new Date() : null,
        ownerReceivedBackAt: done || seed.ownerReceivedBack ? new Date() : null,
        completedAt: done ? new Date() : null,
        ownerPayoutAmount: done ? total : handedOver ? Math.floor(total / 2) : 0,
        refundAmount: done ? deposit : refunded ? total + deposit : 0,
        cancelledAt: status === "cancelled" ? new Date() : null,
        rejectReason: status === "rejected" ? "Lý do có sẵn" : null,
      },
    });
  }

  async function setup(seed: Seed = {}) {
    const owner = await makeUser(ctx, "owner");
    const renter = await verifiedRenter();
    const vehicle = await makeVehicle(ctx, owner.user.id, { status: "approved" });
    const booking = await seedBooking(vehicle.id, renter.user.id, seed);
    return { owner, renter, vehicle, booking };
  }

  const row = (id: string) => ctx.prisma.booking.findUniqueOrThrow({ where: { id } });
  type Auth = Record<string, string>;
  const ownerPost = (id: string, action: string, auth: Auth, body?: object) =>
    http().post(`/api/owner/bookings/${id}/${action}`).set(auth).send(body);
  const renterPost = (id: string, action: string, auth: Auth) => http().post(`/api/bookings/${id}/${action}`).set(auth);

  // Sổ tiền không bao giờ chi ra nhiều hơn số đã thu; đơn đã kết thúc thì phải chia hết, không đồng nào bị treo.
  function expectMoney(b: Booking, expected: { paid: number; refund: number; payout: number }) {
    expect({ paid: b.paidAmount, refund: b.refundAmount, payout: b.ownerPayoutAmount }).toEqual(expected);
    expect(b.refundAmount + b.ownerPayoutAmount).toBeLessThanOrEqual(b.paidAmount);
    if (["completed", "cancelled", "rejected", "expired"].includes(b.status)) {
      expect(b.refundAmount + b.ownerPayoutAmount).toBe(b.paidAmount);
    }
  }

  const ALL: BookingStatus[] = ["pending", "confirmed", "in_use", "completed", "rejected", "cancelled", "expired"];
  const except = (...allowed: BookingStatus[]) => ALL.filter((s) => !allowed.includes(s));

  describe("POST /api/bookings/:id/pay (khách trả tiền thuê + tiền cọc)", () => {
    it("thanh toán: ghi thời điểm và số tiền, đơn vẫn pending, chủ xe có 6 giờ để duyệt", async () => {
      const { renter, booking } = await setup();
      const before = Date.now();
      const res = await renterPost(booking.id, "pay", renter.auth);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "pending", paidAmount: PAID, payableAmount: PAID, refundAmount: 0 });
      expect(Date.parse(res.body.paidAt)).toBeGreaterThanOrEqual(before - 1000);
      const window = Date.parse(res.body.expiresAt) - before;
      expect(window).toBeGreaterThan(6 * HOUR_MS - 5000);
      expect(window).toBeLessThan(6 * HOUR_MS + 10_000);
      expectMoney(await row(booking.id), { paid: PAID, refund: 0, payout: 0 });
    });

    it("giờ nhận xe còn dưới 6 giờ: hạn chủ xe duyệt là giờ nhận xe", async () => {
      const { renter, booking } = await setup({ startInMs: 2 * HOUR_MS, expiresInMs: 10 * MIN_MS });
      const res = await renterPost(booking.id, "pay", renter.auth);
      expect(res.body.expiresAt).toBe(booking.startAt.toISOString());
    });

    it("trả tiền xong thì chủ xe mới thấy đơn", async () => {
      const { owner, renter, booking } = await setup();
      expect((await http().get("/api/owner/bookings").set(owner.auth)).body.total).toBe(0);
      await renterPost(booking.id, "pay", renter.auth);
      const list = await http().get("/api/owner/bookings").set(owner.auth);
      expect(list.body.items.map((b: { id: string }) => b.id)).toEqual([booking.id]);
    });

    it("thanh toán lại lần nữa: thành công nhưng KHÔNG thu lần hai và không gia hạn thêm", async () => {
      const { renter, booking } = await setup();
      const first = await renterPost(booking.id, "pay", renter.auth);
      await sleep(30);
      const again = await renterPost(booking.id, "pay", renter.auth);
      expect(again.status).toBe(200);
      expect(again.body.paidAt).toBe(first.body.paidAt);
      expect(again.body.expiresAt).toBe(first.body.expiresAt);
      expectMoney(await row(booking.id), { paid: PAID, refund: 0, payout: 0 });
    });

    it("quá 15 phút chưa trả: 409, không ghi nhận thanh toán cho đơn đã hết hạn", async () => {
      const { renter, booking } = await setup({ expiresInMs: -MIN_MS });
      const res = await renterPost(booking.id, "pay", renter.auth);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVALID_STATE");
      expect((await row(booking.id)).paidAt).toBeNull();
    });

    it.each(["rejected", "cancelled", "expired"] as const)("đơn %s (dù trước đó đã trả tiền hay chưa): 409", async (status) => {
      for (const paid of [false, true]) {
        const { renter, booking } = await setup({ status, paid });
        const res = await renterPost(booking.id, "pay", renter.auth);
        expect(res.status).toBe(409);
        expect((await row(booking.id)).paidAmount).toBe(paid ? PAID : 0);
      }
    });

    it.each(["confirmed", "in_use", "completed"] as const)("đơn %s đã thanh toán từ trước: trả lại nguyên trạng, không thu thêm", async (status) => {
      const { renter, booking } = await setup({ status });
      const res = await renterPost(booking.id, "pay", renter.auth);
      expect(res.status).toBe(200);
      expect((await row(booking.id)).paidAmount).toBe(PAID);
    });

    it("khách khác: 404 và đơn không đổi; chủ xe: 403; chưa đăng nhập: 401", async () => {
      const { owner, booking } = await setup();
      const stranger = await verifiedRenter();
      expect((await renterPost(booking.id, "pay", stranger.auth)).status).toBe(404);
      expect((await renterPost(booking.id, "pay", owner.auth)).status).toBe(403);
      expect((await http().post(`/api/bookings/${booking.id}/pay`)).status).toBe(401);
      expect((await row(booking.id)).paidAt).toBeNull();
    });
  });

  describe("GET /api/owner/bookings", () => {
    it("chỉ gồm đơn ĐÃ THANH TOÁN trên xe của mình, mới nhất trước, kèm khách và số tiền đã ghi nhận; không lộ id nội bộ", async () => {
      const { owner, renter, vehicle, booking } = await setup({ paid: true });
      await sleep(15);
      const second = await seedBooking(vehicle.id, renter.user.id, { startInMs: 20 * DAY_MS, paid: true });
      const unpaid = await seedBooking(vehicle.id, renter.user.id, { startInMs: 30 * DAY_MS });
      const other = await setup({ paid: true }); // đơn trên xe của chủ xe khác

      const res = await http().get("/api/owner/bookings").set(owner.auth);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ total: 2, page: 1, limit: 20 });
      expect(res.body.items.map((b: { id: string }) => b.id)).toEqual([second.id, booking.id]);
      expect(res.body.items[0].renter).toEqual({ fullName: renter.user.fullName, phone: renter.user.phone });
      expect(res.body.items[0].ownerPayoutAmount).toBe(0);

      const text = JSON.stringify(res.body);
      expect(text).not.toContain(unpaid.id);
      expect(text).not.toContain(other.booking.id);
      expect(text).not.toContain(renter.user.id);
      expect(text).not.toContain(owner.user.id);
      expect(text).not.toMatch(/renterId|ownerId|email|plateNumber/);
    });

    it("lọc theo trạng thái như người dùng thấy: đơn đã trả tiền mà quá 6 giờ nằm ở expired, kèm số tiền hoàn", async () => {
      const { owner, renter, vehicle, booking } = await setup({ paid: true });
      const stale = await seedBooking(vehicle.id, renter.user.id, { startInMs: 20 * DAY_MS, paid: true, expiresInMs: -MIN_MS });

      const pending = await http().get("/api/owner/bookings?status=pending").set(owner.auth);
      const expired = await http().get("/api/owner/bookings?status=expired").set(owner.auth);
      expect(pending.body.items.map((b: { id: string }) => b.id)).toEqual([booking.id]);
      expect(expired.body.items).toHaveLength(1);
      expect(expired.body.items[0]).toMatchObject({ id: stale.id, status: "expired", refundAmount: PAID });
    });

    it("phân trang; tham số sai trả 400; chưa đăng nhập 401; khách thuê và admin 403", async () => {
      const { owner, renter, vehicle } = await setup({ paid: true });
      await seedBooking(vehicle.id, renter.user.id, { startInMs: 20 * DAY_MS, paid: true });
      const admin = await makeUser(ctx, "admin");

      const page = await http().get("/api/owner/bookings?limit=1&page=2").set(owner.auth);
      expect(page.body).toMatchObject({ total: 2, page: 2, limit: 1 });
      expect(page.body.items).toHaveLength(1);
      expect((await http().get("/api/owner/bookings?status=abc").set(owner.auth)).status).toBe(400);
      expect((await http().get("/api/owner/bookings")).status).toBe(401);
      expect((await http().get("/api/owner/bookings").set(renter.auth)).status).toBe(403);
      expect((await http().get("/api/owner/bookings").set(admin.auth)).status).toBe(403);
    });
  });

  describe("POST /api/owner/bookings/:id/approve", () => {
    it("duyệt đơn đã thanh toán: confirmed ngay, không còn hạn giữ chỗ", async () => {
      const { owner, booking } = await setup({ paid: true });
      const before = Date.now();
      const res = await ownerPost(booking.id, "approve", owner.auth);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "confirmed", expiresAt: null });
      expect(Date.parse(res.body.ownerApprovedAt)).toBeGreaterThanOrEqual(before - 1000);
      expect(res.body.renter).toBeDefined();
      expectMoney(await row(booking.id), { paid: PAID, refund: 0, payout: 0 });
    });

    it("đơn khách CHƯA thanh toán: với chủ xe nó chưa tồn tại (404) và không thể duyệt", async () => {
      const { owner, booking } = await setup();
      expect((await ownerPost(booking.id, "approve", owner.auth)).status).toBe(404);
      expect((await row(booking.id)).status).toBe("pending");
    });

    it("duyệt lại lần nữa vẫn thành công, không đổi thời điểm duyệt", async () => {
      const { owner, booking } = await setup({ paid: true });
      const first = await ownerPost(booking.id, "approve", owner.auth);
      await sleep(30);
      const again = await ownerPost(booking.id, "approve", owner.auth);
      expect(again.status).toBe(200);
      expect(again.body.ownerApprovedAt).toBe(first.body.ownerApprovedAt);
    });

    it("quá 6 giờ không duyệt: 409, đơn không được hồi sinh, khách thấy hết hạn và được hoàn toàn bộ", async () => {
      const { owner, renter, booking } = await setup({ paid: true, expiresInMs: -MIN_MS });
      const res = await ownerPost(booking.id, "approve", owner.auth);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVALID_STATE");
      expect((await row(booking.id)).status).toBe("pending");

      const seen = await http().get(`/api/bookings/${booking.id}`).set(renter.auth);
      expect(seen.body).toMatchObject({ status: "expired", refundAmount: PAID });
    });

    it.each(except("pending", "confirmed"))("đơn %s: 409 INVALID_STATE, đơn không đổi", async (status) => {
      const { owner, booking } = await setup({ status, paid: true });
      const res = await ownerPost(booking.id, "approve", owner.auth);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVALID_STATE");
      expect((await row(booking.id)).status).toBe(status);
    });

    it("chủ xe khác: 404 và đơn không đổi; khách thuê: 403; chưa đăng nhập: 401; id sai: 404", async () => {
      const { renter, booking } = await setup({ paid: true });
      const stranger = await makeUser(ctx, "owner");
      expect((await ownerPost(booking.id, "approve", stranger.auth)).status).toBe(404);
      expect((await ownerPost(booking.id, "approve", renter.auth)).status).toBe(403);
      expect((await http().post(`/api/owner/bookings/${booking.id}/approve`)).status).toBe(401);
      expect((await ownerPost("khong-phai-uuid", "approve", stranger.auth)).status).toBe(404);
      expect((await row(booking.id)).status).toBe("pending");
    });
  });

  describe("POST /api/owner/bookings/:id/reject", () => {
    it("từ chối đơn đã thanh toán: rejected, hoàn 100% cho khách, khách đọc được lý do", async () => {
      const { owner, renter, booking } = await setup({ paid: true });
      const res = await ownerPost(booking.id, "reject", owner.auth, { reason: "  Xe bận ngày đó  " });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "rejected", rejectReason: "Xe bận ngày đó", refundAmount: PAID, ownerPayoutAmount: 0 });
      expectMoney(await row(booking.id), { paid: PAID, refund: PAID, payout: 0 });

      const seen = await http().get(`/api/bookings/${booking.id}`).set(renter.auth);
      expect(seen.body).toMatchObject({ status: "rejected", rejectReason: "Xe bận ngày đó", refundAmount: PAID });
    });

    it("từ chối xong thì xe trống lại: khách khác đặt được đúng khoảng đó", async () => {
      const { owner, vehicle, booking } = await setup({ paid: true });
      await ownerPost(booking.id, "reject", owner.auth, { reason: "Không nhận" });
      const other = await verifiedRenter();
      const res = await http()
        .post("/api/bookings")
        .set(other.auth)
        .send({ vehicleId: vehicle.id, startAt: booking.startAt.toISOString(), endAt: booking.endAt.toISOString() });
      expect(res.status).toBe(201);
    });

    it.each([
      ["thiếu lý do", {}],
      ["lý do rỗng", { reason: "   " }],
      ["lý do quá 500 ký tự", { reason: "a".repeat(501) }],
      ["trường lạ", { reason: "ok", status: "confirmed" }],
    ])("%s: 400, đơn không đổi và không hoàn tiền", async (_name, body) => {
      const { owner, booking } = await setup({ paid: true });
      const res = await ownerPost(booking.id, "reject", owner.auth, body);
      expect(res.status).toBe(400);
      expectMoney(await row(booking.id), { paid: PAID, refund: 0, payout: 0 });
      expect((await row(booking.id)).status).toBe("pending");
    });

    it("từ chối lại lần nữa: thành công, giữ lý do đầu tiên, không hoàn thêm", async () => {
      const { owner, booking } = await setup({ paid: true });
      await ownerPost(booking.id, "reject", owner.auth, { reason: "Lý do một" });
      const again = await ownerPost(booking.id, "reject", owner.auth, { reason: "Lý do hai" });
      expect(again.status).toBe(200);
      expect(again.body.rejectReason).toBe("Lý do một");
      expectMoney(await row(booking.id), { paid: PAID, refund: PAID, payout: 0 });
    });

    it("đơn quá hạn: 409; đơn chưa thanh toán: 404", async () => {
      const stale = await setup({ paid: true, expiresInMs: -MIN_MS });
      expect((await ownerPost(stale.booking.id, "reject", stale.owner.auth, { reason: "x" })).status).toBe(409);
      const unpaid = await setup();
      expect((await ownerPost(unpaid.booking.id, "reject", unpaid.owner.auth, { reason: "x" })).status).toBe(404);
    });

    it.each(except("pending", "rejected"))("đơn %s: 409 INVALID_STATE, đơn không đổi", async (status) => {
      const { owner, booking } = await setup({ status, paid: true });
      const before = await row(booking.id);
      const res = await ownerPost(booking.id, "reject", owner.auth, { reason: "x" });
      expect(res.status).toBe(409);
      const after = await row(booking.id);
      expect(after.status).toBe(status);
      expect(after.refundAmount).toBe(before.refundAmount);
    });

    it("chủ xe khác: 404 và đơn không đổi", async () => {
      const { booking } = await setup({ paid: true });
      const stranger = await makeUser(ctx, "owner");
      expect((await ownerPost(booking.id, "reject", stranger.auth, { reason: "x" })).status).toBe(404);
      expect((await row(booking.id)).status).toBe("pending");
    });
  });

  describe("POST /api/bookings/:id/cancel", () => {
    it("hủy đơn chưa thanh toán: cancelled, không có tiền nào để hoàn", async () => {
      const { renter, booking } = await setup();
      const res = await renterPost(booking.id, "cancel", renter.auth);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "cancelled", refundAmount: 0 });
      expect(res.body.renter).toBeUndefined();
      expect(res.body.ownerPayoutAmount).toBeUndefined();

      const saved = await row(booking.id);
      expect(saved.cancelledById).toBe(renter.user.id);
      expect(saved.cancelledAt).not.toBeNull();
      expectMoney(saved, { paid: 0, refund: 0, payout: 0 });
    });

    it("hủy đơn đã thanh toán mà chủ xe chưa duyệt: hoàn toàn bộ, dù sát giờ nhận xe", async () => {
      const { renter, booking } = await setup({ paid: true, startInMs: 2 * HOUR_MS, expiresInMs: HOUR_MS });
      const res = await renterPost(booking.id, "cancel", renter.auth);
      expect(res.body).toMatchObject({ status: "cancelled", refundAmount: PAID });
      expectMoney(await row(booking.id), { paid: PAID, refund: PAID, payout: 0 });
    });

    it.each([
      ["còn 72 giờ: hoàn hết", 72 * HOUR_MS, PAID, 0],
      ["còn 36 giờ: hoàn cọc + 50% tiền thuê, chủ xe nhận 50%", 36 * HOUR_MS, DEPOSIT + TOTAL / 2, TOTAL / 2],
      ["còn 2 giờ: chỉ hoàn cọc, chủ xe nhận đủ tiền thuê", 2 * HOUR_MS, DEPOSIT, TOTAL],
    ])("hủy đơn confirmed, %s", async (_name, startInMs, refund, payout) => {
      const { owner, renter, booking } = await setup({ status: "confirmed", startInMs });
      const res = await renterPost(booking.id, "cancel", renter.auth);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "cancelled", refundAmount: refund });
      expectMoney(await row(booking.id), { paid: PAID, refund, payout });

      // Chủ xe thấy khoản mình được nhận từ đơn bị hủy muộn.
      const seen = await http().get(`/api/bookings/${booking.id}`).set(owner.auth);
      expect(seen.body.ownerPayoutAmount).toBe(payout);
    });

    it("hủy lại lần nữa: thành công và KHÔNG tính lại tiền", async () => {
      const { renter, booking } = await setup({ status: "confirmed", startInMs: 72 * HOUR_MS });
      const first = await renterPost(booking.id, "cancel", renter.auth);
      // Giả lập "bây giờ đã sát giờ nhận xe": nếu tính lại, tiền hoàn sẽ tụt xuống còn tiền cọc.
      await ctx.prisma.booking.update({ where: { id: booking.id }, data: { startAt: new Date(Date.now() + HOUR_MS) } });
      const again = await renterPost(booking.id, "cancel", renter.auth);
      expect(again.status).toBe(200);
      expect(again.body.refundAmount).toBe(first.body.refundAmount);
      expectMoney(await row(booking.id), { paid: PAID, refund: PAID, payout: 0 });
    });

    it("hủy xong thì xe trống lại và không còn tính vào giới hạn 3 đơn chờ", async () => {
      const { renter, vehicle, booking } = await setup();
      await seedBooking(vehicle.id, renter.user.id, { startInMs: 20 * DAY_MS });
      await seedBooking(vehicle.id, renter.user.id, { startInMs: 30 * DAY_MS });
      const body = { vehicleId: vehicle.id, startAt: booking.startAt.toISOString(), endAt: booking.endAt.toISOString() };
      const start = new Date(Date.now() + 40 * DAY_MS);
      const fourth = { vehicleId: vehicle.id, startAt: start.toISOString(), endAt: new Date(start.getTime() + DAY_MS).toISOString() };
      expect((await http().post("/api/bookings").set(renter.auth).send(fourth)).body.code).toBe("PENDING_LIMIT");

      await renterPost(booking.id, "cancel", renter.auth);
      expect((await http().post("/api/bookings").set(renter.auth).send(fourth)).status).toBe(201);
      const other = await verifiedRenter();
      expect((await http().post("/api/bookings").set(other.auth).send(body)).status).toBe(201);
    });

    it("đơn pending đã quá hạn: 409 (đơn đã hết hạn, không còn gì để hủy)", async () => {
      const { renter, booking } = await setup({ expiresInMs: -MIN_MS });
      expect((await renterPost(booking.id, "cancel", renter.auth)).status).toBe(409);
    });

    it.each(except("pending", "confirmed", "cancelled"))("đơn %s: 409 INVALID_STATE, đơn và tiền không đổi", async (status) => {
      const { renter, booking } = await setup({ status });
      const before = await row(booking.id);
      const res = await renterPost(booking.id, "cancel", renter.auth);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVALID_STATE");
      const after = await row(booking.id);
      expect([after.status, after.refundAmount, after.ownerPayoutAmount]).toEqual([status, before.refundAmount, before.ownerPayoutAmount]);
    });

    it("khách khác: 404 và đơn không đổi; chủ xe: 403; chưa đăng nhập: 401", async () => {
      const { owner, booking } = await setup();
      const stranger = await verifiedRenter();
      expect((await renterPost(booking.id, "cancel", stranger.auth)).status).toBe(404);
      expect((await renterPost(booking.id, "cancel", owner.auth)).status).toBe(403);
      expect((await http().post(`/api/bookings/${booking.id}/cancel`)).status).toBe(401);
      expect((await row(booking.id)).status).toBe("pending");
    });
  });

  describe("giao xe: cần cả chủ xe và khách xác nhận", () => {
    const READY: Seed = { status: "confirmed", startInMs: 30 * MIN_MS };

    it("chủ xe bấm trước: đơn vẫn confirmed và chưa có tiền; khách bấm sau thì thành in_use, chủ xe được 50% tiền thuê", async () => {
      const { owner, renter, booking } = await setup(READY);

      const first = await ownerPost(booking.id, "handover", owner.auth);
      expect(first.status).toBe(200);
      expect(first.body.status).toBe("confirmed");
      expect(first.body.ownerHandedOverAt).not.toBeNull();
      expect(first.body.renterReceivedAt).toBeNull();
      expectMoney(await row(booking.id), { paid: PAID, refund: 0, payout: 0 });

      const second = await renterPost(booking.id, "pickup", renter.auth);
      expect(second.status).toBe(200);
      expect(second.body.status).toBe("in_use");
      expect(second.body.startedAt).not.toBeNull();
      expectMoney(await row(booking.id), { paid: PAID, refund: 0, payout: TOTAL / 2 });
    });

    it("khách bấm trước, chủ xe bấm sau: kết quả y như vậy", async () => {
      const { owner, renter, booking } = await setup(READY);
      expect((await renterPost(booking.id, "pickup", renter.auth)).body.status).toBe("confirmed");
      const done = await ownerPost(booking.id, "handover", owner.auth);
      expect(done.body.status).toBe("in_use");
      expect(done.body.ownerPayoutAmount).toBe(TOTAL / 2);
    });

    it("một bên bấm nhiều lần cũng không thay được bên kia: đơn vẫn confirmed, chủ xe chưa có tiền", async () => {
      const a = await setup(READY);
      for (let i = 0; i < 3; i += 1) expect((await ownerPost(a.booking.id, "handover", a.owner.auth)).status).toBe(200);
      expect((await row(a.booking.id)).status).toBe("confirmed");
      expectMoney(await row(a.booking.id), { paid: PAID, refund: 0, payout: 0 });

      const b = await setup(READY);
      for (let i = 0; i < 3; i += 1) expect((await renterPost(b.booking.id, "pickup", b.renter.auth)).status).toBe(200);
      expect((await row(b.booking.id)).status).toBe("confirmed");
    });

    it("xác nhận lại sau khi đã giao xong: thành công, không cộng tiền lần hai", async () => {
      const { owner, renter, booking } = await setup(READY);
      await ownerPost(booking.id, "handover", owner.auth);
      await renterPost(booking.id, "pickup", renter.auth);
      const startedAt = (await row(booking.id)).startedAt;

      expect((await ownerPost(booking.id, "handover", owner.auth)).status).toBe(200);
      expect((await renterPost(booking.id, "pickup", renter.auth)).status).toBe(200);
      const saved = await row(booking.id);
      expect(saved.startedAt).toEqual(startedAt);
      expectMoney(saved, { paid: PAID, refund: 0, payout: TOTAL / 2 });
    });

    it("tiền thuê là số lẻ: lần đầu chủ xe nhận nửa làm tròn xuống", async () => {
      const { owner, renter, booking } = await setup({ ...READY, total: 50_005, deposit: 15_002 });
      await ownerPost(booking.id, "handover", owner.auth);
      await renterPost(booking.id, "pickup", renter.auth);
      expect((await row(booking.id)).ownerPayoutAmount).toBe(25_002);
    });

    it("còn sớm hơn 1 giờ trước giờ nhận xe: cả hai bên đều 409", async () => {
      const { owner, renter, booking } = await setup({ status: "confirmed", startInMs: 3 * DAY_MS });
      expect((await ownerPost(booking.id, "handover", owner.auth)).status).toBe(409);
      expect((await renterPost(booking.id, "pickup", renter.auth)).status).toBe(409);
      const saved = await row(booking.id);
      expect([saved.status, saved.ownerHandedOverAt, saved.renterReceivedAt]).toEqual(["confirmed", null, null]);
    });

    it("đã qua giờ trả xe: 409", async () => {
      const { owner, booking } = await setup({ status: "confirmed", startInMs: -3 * DAY_MS, lengthMs: DAY_MS });
      expect((await ownerPost(booking.id, "handover", owner.auth)).status).toBe(409);
    });

    it.each(except("confirmed", "in_use", "completed"))("đơn %s: không xác nhận giao xe được (409), đơn không đổi", async (status) => {
      const { owner, renter, booking } = await setup({ status, paid: true, startInMs: 30 * MIN_MS, expiresInMs: 20 * MIN_MS });
      expect((await ownerPost(booking.id, "handover", owner.auth)).status).toBe(409);
      expect((await renterPost(booking.id, "pickup", renter.auth)).status).toBe(409);
      expect((await row(booking.id)).status).toBe(status);
    });

    it("mỗi bên chỉ xác nhận phần của mình: người lạ 404, sai vai trò 403", async () => {
      const { owner, renter, booking } = await setup(READY);
      const otherOwner = await makeUser(ctx, "owner");
      const otherRenter = await verifiedRenter();
      expect((await ownerPost(booking.id, "handover", otherOwner.auth)).status).toBe(404);
      expect((await renterPost(booking.id, "pickup", otherRenter.auth)).status).toBe(404);
      expect((await ownerPost(booking.id, "handover", renter.auth)).status).toBe(403); // khách không bấm thay chủ xe được
      expect((await renterPost(booking.id, "pickup", owner.auth)).status).toBe(403); // chủ xe không bấm thay khách được
      const saved = await row(booking.id);
      expect([saved.status, saved.ownerHandedOverAt, saved.renterReceivedAt]).toEqual(["confirmed", null, null]);
    });
  });

  describe("trả xe: cần cả khách và chủ xe xác nhận", () => {
    const RENTING: Seed = { status: "in_use", startInMs: -HOUR_MS };

    it("khách bấm trước: đơn vẫn in_use; chủ xe bấm sau thì completed, chủ xe nhận đủ tiền thuê, khách nhận lại cọc", async () => {
      const { owner, renter, booking } = await setup(RENTING);

      const first = await renterPost(booking.id, "return", renter.auth);
      expect(first.status).toBe(200);
      expect(first.body.status).toBe("in_use");
      expect(first.body.renterReturnedAt).not.toBeNull();
      expectMoney(await row(booking.id), { paid: PAID, refund: 0, payout: TOTAL / 2 });

      const second = await ownerPost(booking.id, "receive", owner.auth);
      expect(second.status).toBe(200);
      expect(second.body).toMatchObject({ status: "completed", refundAmount: DEPOSIT, ownerPayoutAmount: TOTAL });
      expect(second.body.completedAt).not.toBeNull();
      expectMoney(await row(booking.id), { paid: PAID, refund: DEPOSIT, payout: TOTAL });
    });

    it("chủ xe bấm trước, khách bấm sau: kết quả y như vậy", async () => {
      const { owner, renter, booking } = await setup(RENTING);
      expect((await ownerPost(booking.id, "receive", owner.auth)).body.status).toBe("in_use");
      const done = await renterPost(booking.id, "return", renter.auth);
      expect(done.body).toMatchObject({ status: "completed", refundAmount: DEPOSIT });
      expectMoney(await row(booking.id), { paid: PAID, refund: DEPOSIT, payout: TOTAL });
    });

    it("một bên bấm nhiều lần cũng không hoàn tất được đơn: tiền cọc chưa hoàn, chủ xe chưa nhận phần còn lại", async () => {
      const { owner, booking } = await setup(RENTING);
      for (let i = 0; i < 3; i += 1) expect((await ownerPost(booking.id, "receive", owner.auth)).status).toBe(200);
      const saved = await row(booking.id);
      expect(saved.status).toBe("in_use");
      expectMoney(saved, { paid: PAID, refund: 0, payout: TOTAL / 2 });
    });

    it("xác nhận lại sau khi đã hoàn tất: thành công, tiền không đổi", async () => {
      const { owner, renter, booking } = await setup(RENTING);
      await renterPost(booking.id, "return", renter.auth);
      await ownerPost(booking.id, "receive", owner.auth);
      expect((await renterPost(booking.id, "return", renter.auth)).status).toBe(200);
      expect((await ownerPost(booking.id, "receive", owner.auth)).status).toBe(200);
      expectMoney(await row(booking.id), { paid: PAID, refund: DEPOSIT, payout: TOTAL });
    });

    it("tiền thuê là số lẻ: hai lần ghi nhận cho chủ xe cộng lại đúng bằng tiền thuê", async () => {
      const { owner, renter, booking } = await setup({ ...RENTING, total: 50_005, deposit: 15_002 });
      expect((await row(booking.id)).ownerPayoutAmount).toBe(25_002);
      await renterPost(booking.id, "return", renter.auth);
      await ownerPost(booking.id, "receive", owner.auth);
      expectMoney(await row(booking.id), { paid: 65_007, refund: 15_002, payout: 50_005 });
    });

    it.each(except("in_use", "completed"))("đơn %s: không xác nhận trả xe được (409), đơn không đổi", async (status) => {
      const { owner, renter, booking } = await setup({ status, paid: true });
      expect((await renterPost(booking.id, "return", renter.auth)).status).toBe(409);
      expect((await ownerPost(booking.id, "receive", owner.auth)).status).toBe(409);
      expect((await row(booking.id)).status).toBe(status);
    });

    it("người lạ 404, sai vai trò 403, đơn không đổi", async () => {
      const { owner, renter, booking } = await setup(RENTING);
      const otherOwner = await makeUser(ctx, "owner");
      const otherRenter = await verifiedRenter();
      expect((await ownerPost(booking.id, "receive", otherOwner.auth)).status).toBe(404);
      expect((await renterPost(booking.id, "return", otherRenter.auth)).status).toBe(404);
      expect((await ownerPost(booking.id, "receive", renter.auth)).status).toBe(403);
      expect((await renterPost(booking.id, "return", owner.auth)).status).toBe(403);
      const saved = await row(booking.id);
      expect([saved.status, saved.renterReturnedAt, saved.ownerReceivedBackAt]).toEqual(["in_use", null, null]);
    });
  });

  describe("trọn vòng đời qua API", () => {
    it("đặt, trả tiền, chủ xe duyệt, hai bên giao xe, hai bên trả xe: tiền được chia đúng từng bước", async () => {
      const owner = await makeUser(ctx, "owner");
      const renter = await verifiedRenter();
      const vehicle = await makeVehicle(ctx, owner.user.id, { status: "approved", pricePerDay: 650_000, depositRate: 30 });
      const startAt = new Date(Date.now() + 30 * MIN_MS);
      const endAt = new Date(startAt.getTime() + 2 * DAY_MS);

      const created = await http().post("/api/bookings").set(renter.auth).send({ vehicleId: vehicle.id, startAt, endAt });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ status: "pending", totalAmount: TOTAL, depositAmount: DEPOSIT, payableAmount: PAID });
      const id = created.body.id as string;

      expect((await renterPost(id, "pay", renter.auth)).body.paidAmount).toBe(PAID);
      expect((await ownerPost(id, "approve", owner.auth)).body.status).toBe("confirmed");

      await ownerPost(id, "handover", owner.auth);
      expect((await renterPost(id, "pickup", renter.auth)).body.status).toBe("in_use");
      expectMoney(await row(id), { paid: PAID, refund: 0, payout: 650_000 }); // ứng dụng đang giữ 1.040.000

      await renterPost(id, "return", renter.auth);
      const done = await ownerPost(id, "receive", owner.auth);
      expect(done.body.status).toBe("completed");
      expectMoney(await row(id), { paid: PAID, refund: DEPOSIT, payout: TOTAL }); // ứng dụng không còn giữ gì

      const seenByRenter = await http().get(`/api/bookings/${id}`).set(renter.auth);
      expect(seenByRenter.body).toMatchObject({ status: "completed", refundAmount: DEPOSIT });
      expect(seenByRenter.body.ownerPayoutAmount).toBeUndefined();
    });
  });

  describe("hai thao tác đồng thời trên cùng một đơn: tiền không bao giờ bị kẹt hay tính hai lần", () => {
    // Chạy song song thật thì bên nào tới trước là may rủi. Ở đây ta ép đúng tình huống xấu nhất: thao tác của bên kia xảy ra
    // NGAY SAU khi service đọc đơn và TRƯỚC khi nó ghi, để chắc chắn điều kiện trong câu UPDATE là thứ chặn việc ghi đè.
    function interfereAfterFirstRead(change: () => Promise<unknown>) {
      const service = ctx.app.get(BookingTransitionsService);
      const internals = service as unknown as { findOrThrow: (where: object) => Promise<unknown> };
      const original = internals.findOrThrow.bind(service);
      return jest.spyOn(internals, "findOrThrow").mockImplementationOnce(async (where) => {
        const stale = await original(where);
        await change();
        return stale;
      });
    }

    it("khách hủy, nhưng chủ xe đã từ chối ngay sau khi đơn được đọc: hủy trả 409 và KHÔNG ghi đè lên đơn đã bị từ chối", async () => {
      const { renter, booking } = await setup({ paid: true });
      const spy = interfereAfterFirstRead(() =>
        ctx.prisma.booking.update({ where: { id: booking.id }, data: { status: "rejected", rejectReason: "Xe bận", refundAmount: PAID } }),
      );
      const res = await renterPost(booking.id, "cancel", renter.auth);
      spy.mockRestore();

      expect(res.status).toBe(409);
      const saved = await row(booking.id);
      expect([saved.status, saved.rejectReason, saved.cancelledAt]).toEqual(["rejected", "Xe bận", null]);
      expectMoney(saved, { paid: PAID, refund: PAID, payout: 0 });
    });

    it("khách hủy, nhưng xe đã được giao ngay sau khi đơn được đọc: hủy trả 409, đơn vẫn in_use và chủ xe giữ 50% đã nhận", async () => {
      const { renter, booking } = await setup({ status: "confirmed", startInMs: 30 * MIN_MS });
      const spy = interfereAfterFirstRead(() =>
        ctx.prisma.booking.update({
          where: { id: booking.id },
          data: { status: "in_use", ownerHandedOverAt: new Date(), renterReceivedAt: new Date(), startedAt: new Date(), ownerPayoutAmount: TOTAL / 2 },
        }),
      );
      const res = await renterPost(booking.id, "cancel", renter.auth);
      spy.mockRestore();

      expect(res.status).toBe(409);
      const saved = await row(booking.id);
      expect([saved.status, saved.cancelledAt]).toEqual(["in_use", null]);
      expectMoney(saved, { paid: PAID, refund: 0, payout: TOTAL / 2 });
    });

    it("khách hủy đơn chưa trả tiền, nhưng khoản thanh toán được ghi ngay sau khi đơn được đọc: vẫn hủy được và hoàn đủ số vừa thu", async () => {
      const { renter, booking } = await setup();
      const spy = interfereAfterFirstRead(() => ctx.prisma.booking.update({ where: { id: booking.id }, data: { paidAt: new Date(), paidAmount: PAID } }));
      const res = await renterPost(booking.id, "cancel", renter.auth);
      spy.mockRestore();

      expect(res.status).toBe(200);
      const saved = await row(booking.id);
      expect(saved.status).toBe("cancelled");
      expectMoney(saved, { paid: PAID, refund: PAID, payout: 0 });
    });

    it("khách bấm thanh toán và hủy cùng lúc: đơn kết thúc ở cancelled và tiền hoàn đúng bằng số đã thu", async () => {
      for (let i = 0; i < 6; i += 1) {
        const { renter, booking } = await setup();
        const [paid, cancelled] = await Promise.all([renterPost(booking.id, "pay", renter.auth), renterPost(booking.id, "cancel", renter.auth)]);
        expect(cancelled.status).toBe(200);
        expect([200, 409]).toContain(paid.status);

        const saved = await row(booking.id);
        expect(saved.status).toBe("cancelled");
        // Dù bên nào chạy trước: nếu tiền đã được thu thì phải được hoàn hết, nếu chưa thu thì không hoàn gì.
        expect(saved.refundAmount).toBe(saved.paidAmount);
        expect([0, PAID]).toContain(saved.paidAmount);
        expect(saved.ownerPayoutAmount).toBe(0);
      }
    });

    it("bấm thanh toán hai lần cùng lúc: cả hai thành công, chỉ thu một lần", async () => {
      const { renter, booking } = await setup();
      const [a, b] = await Promise.all([renterPost(booking.id, "pay", renter.auth), renterPost(booking.id, "pay", renter.auth)]);
      expect([a.status, b.status]).toEqual([200, 200]);
      expect(a.body.paidAt).toBe(b.body.paidAt);
      expectMoney(await row(booking.id), { paid: PAID, refund: 0, payout: 0 });
    });

    it("chủ xe từ chối đúng lúc khách hủy: đúng một bên thành công, khách được hoàn hết trong cả hai trường hợp", async () => {
      for (let i = 0; i < 6; i += 1) {
        const { owner, renter, booking } = await setup({ paid: true });
        const [rejected, cancelled] = await Promise.all([
          ownerPost(booking.id, "reject", owner.auth, { reason: "Không nhận" }),
          renterPost(booking.id, "cancel", renter.auth),
        ]);
        expect([rejected.status, cancelled.status].sort()).toEqual([200, 409]);

        const saved = await row(booking.id);
        expect(saved.status).toBe(rejected.status === 200 ? "rejected" : "cancelled");
        expectMoney(saved, { paid: PAID, refund: PAID, payout: 0 });
        // Không có trạng thái lai: bị từ chối thì không có thời điểm hủy, bị hủy thì không có lý do từ chối.
        if (saved.status === "rejected") expect(saved.cancelledAt).toBeNull();
        else expect(saved.rejectReason).toBeNull();
      }
    });

    it("chủ xe duyệt đúng lúc khách hủy: khách luôn hủy được, đơn kết thúc ở cancelled và được hoàn hết", async () => {
      for (let i = 0; i < 6; i += 1) {
        const { owner, renter, booking } = await setup({ paid: true });
        const [approved, cancelled] = await Promise.all([ownerPost(booking.id, "approve", owner.auth), renterPost(booking.id, "cancel", renter.auth)]);
        expect(cancelled.status).toBe(200);
        expect([200, 409]).toContain(approved.status);
        const saved = await row(booking.id);
        expect(saved.status).toBe("cancelled");
        expectMoney(saved, { paid: PAID, refund: PAID, payout: 0 }); // nhận xe sau 5 ngày nên hủy lúc nào cũng hoàn 100%
      }
    });

    it("chủ xe và khách bấm giao xe cùng lúc: đơn thành in_use, chủ xe được cộng 50% đúng MỘT lần", async () => {
      for (let i = 0; i < 6; i += 1) {
        const { owner, renter, booking } = await setup({ status: "confirmed", startInMs: 30 * MIN_MS });
        const [a, b] = await Promise.all([ownerPost(booking.id, "handover", owner.auth), renterPost(booking.id, "pickup", renter.auth)]);
        expect([a.status, b.status]).toEqual([200, 200]);
        const saved = await row(booking.id);
        expect(saved.status).toBe("in_use");
        expectMoney(saved, { paid: PAID, refund: 0, payout: TOTAL / 2 });
      }
    });

    it("khách và chủ xe bấm trả xe cùng lúc: đơn hoàn tất, tiền chia đúng một lần", async () => {
      for (let i = 0; i < 6; i += 1) {
        const { owner, renter, booking } = await setup({ status: "in_use", startInMs: -HOUR_MS });
        const [a, b] = await Promise.all([renterPost(booking.id, "return", renter.auth), ownerPost(booking.id, "receive", owner.auth)]);
        expect([a.status, b.status]).toEqual([200, 200]);
        const saved = await row(booking.id);
        expect(saved.status).toBe("completed");
        expectMoney(saved, { paid: PAID, refund: DEPOSIT, payout: TOTAL });
      }
    });

    it("chủ xe đã bấm giao xe; khách bấm nhận xe và hủy cùng lúc: đơn chỉ đi theo một hướng, tiền khớp với hướng đó", async () => {
      for (let i = 0; i < 6; i += 1) {
        const { renter, booking } = await setup({ status: "confirmed", startInMs: 30 * MIN_MS, ownerHandedOver: true });
        const [picked, cancelled] = await Promise.all([renterPost(booking.id, "pickup", renter.auth), renterPost(booking.id, "cancel", renter.auth)]);
        expect([picked.status, cancelled.status].sort()).toEqual([200, 409]);

        const saved = await row(booking.id);
        if (picked.status === 200) {
          expect(saved.status).toBe("in_use");
          expectMoney(saved, { paid: PAID, refund: 0, payout: TOTAL / 2 });
        } else {
          expect(saved.status).toBe("cancelled");
          expectMoney(saved, { paid: PAID, refund: DEPOSIT, payout: TOTAL }); // hủy khi còn dưới 24 giờ
        }
      }
    });
  });

  describe("job dọn đơn chạy mỗi phút", () => {
    it("nhả đơn pending quá hạn: chưa thanh toán thì không hoàn gì, đã thanh toán thì hoàn 100%; đơn khác không bị đụng tới", async () => {
      const { renter, vehicle, booking: live } = await setup();
      const staleUnpaid = await seedBooking(vehicle.id, renter.user.id, { startInMs: 20 * DAY_MS, expiresInMs: -MIN_MS });
      const stalePaid = await seedBooking(vehicle.id, renter.user.id, { startInMs: 30 * DAY_MS, expiresInMs: -MIN_MS, paid: true });
      const noDeadline = await seedBooking(vehicle.id, renter.user.id, { startInMs: 40 * DAY_MS, expiresInMs: null });
      const confirmed = await seedBooking(vehicle.id, renter.user.id, { startInMs: 50 * DAY_MS, status: "confirmed" });

      expect(await ctx.app.get(BookingTransitionsService).expireOverdue()).toBe(2);
      expectMoney(await row(staleUnpaid.id), { paid: 0, refund: 0, payout: 0 });
      expect((await row(staleUnpaid.id)).status).toBe("expired");
      expectMoney(await row(stalePaid.id), { paid: PAID, refund: PAID, payout: 0 });
      expect((await row(stalePaid.id)).status).toBe("expired");
      expect((await row(live.id)).status).toBe("pending");
      expect((await row(noDeadline.id)).status).toBe("pending");
      expect((await row(confirmed.id)).status).toBe("confirmed");
    });

    it("đặt đơn mới lên chỗ của đơn đã trả tiền mà quá hạn: đơn cũ được nhả VÀ được hoàn tiền (không cần chờ job)", async () => {
      const { vehicle, booking } = await setup({ paid: true, expiresInMs: -MIN_MS });
      const other = await verifiedRenter();
      const res = await http()
        .post("/api/bookings")
        .set(other.auth)
        .send({ vehicleId: vehicle.id, startAt: booking.startAt.toISOString(), endAt: booking.endAt.toISOString() });
      expect(res.status).toBe(201);
      const old = await row(booking.id);
      expect(old.status).toBe("expired");
      expectMoney(old, { paid: PAID, refund: PAID, payout: 0 });
    });

    it("tự hoàn tất đơn đang thuê đã quá giờ trả xe 24 giờ, kể cả khi mới có một bên (hoặc chưa ai) xác nhận trả xe", async () => {
      const { renter, vehicle, booking: overdue } = await setup({ status: "in_use", startInMs: -3 * DAY_MS, lengthMs: DAY_MS });
      const halfConfirmed = await seedBooking(vehicle.id, renter.user.id, {
        status: "in_use", startInMs: -6 * DAY_MS, lengthMs: DAY_MS, renterReturned: true,
      });
      // Các khoảng thời gian không được chồng nhau (cùng một xe): [-72h,-48h], [-144h,-120h], [-47h,-23h], [-22h,+26h].
      const recent = await seedBooking(vehicle.id, renter.user.id, { status: "in_use", startInMs: -47 * HOUR_MS, lengthMs: DAY_MS });
      const stillRenting = await seedBooking(vehicle.id, renter.user.id, { status: "in_use", startInMs: -22 * HOUR_MS, lengthMs: 2 * DAY_MS });

      expect(await ctx.app.get(BookingTransitionsService).autoComplete()).toBe(2);
      for (const id of [overdue.id, halfConfirmed.id]) {
        const saved = await row(id);
        expect(saved.status).toBe("completed");
        expect(saved.completedAt).not.toBeNull();
        expectMoney(saved, { paid: PAID, refund: DEPOSIT, payout: TOTAL });
      }
      expect((await row(recent.id)).status).toBe("in_use"); // mới quá giờ trả xe 23 giờ
      expect((await row(stillRenting.id)).status).toBe("in_use"); // chưa tới giờ trả xe
    });

    it("một lần chạy của job làm cả hai việc và trả về số đơn đã xử lý; chạy lại không đổi thêm gì", async () => {
      const { renter, vehicle } = await setup({ paid: true, expiresInMs: -MIN_MS });
      await seedBooking(vehicle.id, renter.user.id, { status: "in_use", startInMs: -9 * DAY_MS, lengthMs: DAY_MS });
      const job = ctx.app.get(BookingExpiryJob);
      expect(await job.run()).toBe(2);
      expect(await job.run()).toBe(0);
    });

    it("hai lần chạy chồng nhau: lần thứ hai bỏ qua, không chạy song song", async () => {
      await setup({ expiresInMs: -MIN_MS });
      const job = ctx.app.get(BookingExpiryJob);
      const [a, b] = await Promise.all([job.run(), job.run()]);
      expect([a, b].sort()).toEqual([0, 1]);
    });

    it("CSDL lỗi thì job không ném lỗi ra ngoài (không làm sập tiến trình), lần sau chạy lại bình thường", async () => {
      const { booking } = await setup({ expiresInMs: -MIN_MS });
      const job = ctx.app.get(BookingExpiryJob);
      const service = ctx.app.get(BookingTransitionsService);
      const spy = jest.spyOn(service, "expireOverdue").mockRejectedValueOnce(new Error("mất kết nối"));

      await expect(job.run()).resolves.toBe(0);
      expect((await row(booking.id)).status).toBe("pending");
      spy.mockRestore();
      expect(await job.run()).toBe(1);
    });
  });

  describe("CSDL tự bảo vệ sổ tiền (không phụ thuộc vào code)", () => {
    it.each([
      ["hoàn nhiều hơn số đã thu", { refundAmount: PAID + 1 }],
      ["hoàn + ghi nhận cho chủ xe vượt số đã thu", { refundAmount: PAID, ownerPayoutAmount: 1 }],
      ["chủ xe nhận quá tiền thuê", { ownerPayoutAmount: TOTAL + 1 }],
      ["số đã thu không bằng tiền thuê + tiền cọc", { paidAmount: PAID - 1 }],
      ["số âm", { refundAmount: -1 }],
    ])("từ chối ghi: %s", async (_name, data) => {
      const { booking } = await setup({ status: "confirmed" });
      await expect(ctx.prisma.booking.update({ where: { id: booking.id }, data })).rejects.toThrow(/check constraint/);
    });

    it("từ chối đơn confirmed khi chưa thanh toán, và đơn in_use khi thiếu xác nhận giao xe của một bên", async () => {
      const { booking } = await setup();
      await expect(ctx.prisma.booking.update({ where: { id: booking.id }, data: { status: "confirmed" } })).rejects.toThrow(
        /bookings_active_needs_payment/,
      );
      const paid = await setup({ status: "confirmed", ownerHandedOver: true });
      await expect(ctx.prisma.booking.update({ where: { id: paid.booking.id }, data: { status: "in_use" } })).rejects.toThrow(
        /bookings_in_use_needs_both_sides/,
      );
    });
  });
});
