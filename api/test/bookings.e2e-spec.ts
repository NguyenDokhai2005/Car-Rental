import request from "supertest";
import { createTestApp, DAY_MS, makeBooking, makeUser, makeVehicle, resetDatabase, TestContext } from "./helpers";

const HOUR_MS = 60 * 60 * 1000;

describe("Bookings API", () => {
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

  // Mốc thời gian cố định cho cả bài test, đủ xa trong tương lai và không phụ thuộc lúc chạy từng phép thử.
  const BASE = Date.now() + 10 * DAY_MS;
  const iso = (ms: number) => new Date(ms).toISOString();
  const range = (startDay: number, endDay: number) => ({ startAt: iso(BASE + startDay * DAY_MS), endAt: iso(BASE + endDay * DAY_MS) });

  async function renter(licenseStatus: "verified" | "none" | "pending" | "rejected" = "verified") {
    const u = await makeUser(ctx, "renter");
    if (licenseStatus !== "none") {
      // CSDL không cho GPLX ở trạng thái đã nộp mà thiếu ảnh mặt trước (users_license_front_when_submitted).
      await ctx.prisma.user.update({
        where: { id: u.user.id },
        data: { licenseStatus, licenseFrontKey: `licenses/${u.user.id}/front.jpg` },
      });
    }
    return u;
  }

  async function setup(vehicleOverrides: Parameters<typeof makeVehicle>[2] = {}) {
    const owner = await makeUser(ctx, "owner");
    const vehicle = await makeVehicle(ctx, owner.user.id, { status: "approved", ...vehicleOverrides });
    const who = await renter();
    const book = (body: Record<string, unknown>, by = who) => http().post("/api/bookings").set(by.auth).send(body);
    return { owner, vehicle, who, book };
  }

  describe("POST /api/bookings", () => {
    it("tạo đơn: pending chưa thanh toán, khách có 15 phút để trả; tiền do hệ thống tính (2 ngày x 650.000đ, cọc 30% thu thêm)", async () => {
      const { vehicle, who, book } = await setup({ pricePerDay: 650000, depositRate: 30 });
      const before = Date.now();
      const res = await book({ vehicleId: vehicle.id, ...range(1, 3) });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        vehicleId: vehicle.id,
        status: "pending",
        rentalDays: 2,
        pricePerDay: 650000,
        totalAmount: 1_300_000,
        depositAmount: 390_000,
        payableAmount: 1_690_000,
        paidAt: null,
        paidAmount: 0,
        ownerApprovedAt: null,
        rejectReason: null,
        refundAmount: 0,
      });
      const holdMs = Date.parse(res.body.expiresAt) - before;
      expect(holdMs).toBeGreaterThan(15 * 60_000 - 5_000);
      expect(holdMs).toBeLessThan(15 * 60_000 + 10_000);
      expect(res.body.vehicle).toMatchObject({ id: vehicle.id, title: vehicle.title, city: vehicle.city, district: vehicle.district, coverUrl: null });

      const row = await ctx.prisma.booking.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row.renterId).toBe(who.user.id);
    });

    it("nhận xe sớm hơn 15 phút nữa: hạn thanh toán là giờ nhận xe, không vượt quá lúc chuyến đi bắt đầu", async () => {
      const { vehicle, book } = await setup();
      const startAt = iso(Date.now() + 5 * 60_000);
      const res = await book({ vehicleId: vehicle.id, startAt, endAt: iso(Date.now() + 5 * 60_000 + DAY_MS) });
      expect(res.status).toBe(201);
      expect(res.body.expiresAt).toBe(startAt);
    });

    it("không lộ renterId, ownerId, biển số hay thông tin chủ xe", async () => {
      const { owner, vehicle, who, book } = await setup();
      const res = await book({ vehicleId: vehicle.id, ...range(1, 2) });
      const text = JSON.stringify(res.body);
      expect(text).not.toContain(who.user.id);
      expect(text).not.toContain(owner.user.id);
      expect(text).not.toContain(vehicle.plateNumber);
      expect(text).not.toMatch(/renterId|ownerId|cancelledBy|plateNumber|email|phone|ownerPayoutAmount/);
    });

    it("tỷ lệ cọc lấy theo từng xe và làm tròn VND", async () => {
      const { vehicle, book } = await setup({ pricePerDay: 50_005, depositRate: 30 });
      const res = await book({ vehicleId: vehicle.id, ...range(1, 2) });
      expect(res.body).toMatchObject({ totalAmount: 50_005, depositAmount: 15_002, payableAmount: 65_007 }); // 15.001,5 làm tròn lên
    });

    it("làm tròn LÊN theo 24 giờ: 25 giờ là 2 ngày, đúng 24 giờ là 1 ngày", async () => {
      const { vehicle, who, book } = await setup({ pricePerDay: 100_000 });
      const a = await book({ vehicleId: vehicle.id, startAt: iso(BASE), endAt: iso(BASE + 25 * HOUR_MS) });
      expect(a.body.rentalDays).toBe(2);
      expect(a.body.totalAmount).toBe(200_000);
      const b = await book({ vehicleId: vehicle.id, startAt: iso(BASE + 5 * DAY_MS), endAt: iso(BASE + 5 * DAY_MS + 24 * HOUR_MS) }, who);
      expect(b.body.rentalDays).toBe(1);
    });

    it("chụp giá lúc đặt: chủ xe đổi giá sau đó không làm đổi đơn đã tạo", async () => {
      const { vehicle, book } = await setup({ pricePerDay: 600_000 });
      const res = await book({ vehicleId: vehicle.id, ...range(1, 2) });
      await ctx.prisma.vehicle.update({ where: { id: vehicle.id }, data: { pricePerDay: 900_000 } });
      const row = await ctx.prisma.booking.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row).toMatchObject({ pricePerDay: 600_000, totalAmount: 600_000 });
    });

    it("xe giá trần, thuê 30 ngày, cọc 100%: tạo được VÀ thanh toán được (số khách trả vừa số nguyên 32 bit)", async () => {
      const { vehicle, who, book } = await setup({ pricePerDay: 35_000_000, depositRate: 100 });
      const res = await book({ vehicleId: vehicle.id, startAt: iso(BASE), endAt: iso(BASE + 30 * DAY_MS) });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ rentalDays: 30, totalAmount: 1_050_000_000, depositAmount: 1_050_000_000, payableAmount: 2_100_000_000 });

      const paid = await http().post(`/api/bookings/${res.body.id}/pay`).set(who.auth);
      expect(paid.status).toBe(200);
      expect(paid.body.paidAmount).toBe(2_100_000_000);
    });

    describe("kiểm tra dữ liệu", () => {
      it.each([
        ["nhận xe ở quá khứ", () => ({ startAt: iso(Date.now() - DAY_MS), endAt: iso(Date.now() + DAY_MS) })],
        ["trả xe không sau nhận xe", () => ({ startAt: iso(BASE), endAt: iso(BASE) })],
        ["trả xe trước nhận xe", () => ({ startAt: iso(BASE + DAY_MS), endAt: iso(BASE) })],
        ["thuê hơn 30 ngày", () => ({ startAt: iso(BASE), endAt: iso(BASE + 30 * DAY_MS + 1) })],
        ["nhận xe quá 365 ngày tới", () => ({ startAt: iso(Date.now() + 366 * DAY_MS), endAt: iso(Date.now() + 367 * DAY_MS) })],
        ["ngày không có giờ và múi giờ", () => ({ startAt: "2030-01-01", endAt: "2030-01-03" })],
        ["thiếu startAt", () => ({ endAt: iso(BASE) })],
      ])("%s: 400 VALIDATION_ERROR, không tạo đơn", async (_name, body) => {
        const { vehicle, book } = await setup();
        const res = await book({ vehicleId: vehicle.id, ...body() });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("VALIDATION_ERROR");
        expect(await ctx.prisma.booking.count()).toBe(0);
      });

      it("không nhận trường do hệ thống quản lý (renterId, status, giá, tiền...)", async () => {
        const { vehicle, book } = await setup();
        for (const extra of [{ renterId: "x" }, { status: "confirmed" }, { totalAmount: 1 }, { pricePerDay: 1 }, { expiresAt: iso(BASE) }]) {
          const res = await book({ vehicleId: vehicle.id, ...range(1, 2), ...extra });
          expect(res.status).toBe(400);
        }
        expect(await ctx.prisma.booking.count()).toBe(0);
      });

      it("vehicleId sai định dạng: 400", async () => {
        const { book } = await setup();
        expect((await book({ vehicleId: "khong-phai-uuid", ...range(1, 2) })).status).toBe(400);
      });
    });

    describe("quyền", () => {
      it("chưa đăng nhập: 401; chủ xe và admin: 403", async () => {
        const { vehicle, owner } = await setup();
        const admin = await makeUser(ctx, "admin");
        expect((await http().post("/api/bookings").send({ vehicleId: vehicle.id, ...range(1, 2) })).status).toBe(401);
        expect((await http().post("/api/bookings").set(owner.auth).send({ vehicleId: vehicle.id, ...range(1, 2) })).status).toBe(403);
        expect((await http().post("/api/bookings").set(admin.auth).send({ vehicleId: vehicle.id, ...range(1, 2) })).status).toBe(403);
      });

      it.each(["none", "pending", "rejected"] as const)("GPLX %s: 403 LICENSE_NOT_VERIFIED", async (license) => {
        const { vehicle, book } = await setup();
        const res = await book({ vehicleId: vehicle.id, ...range(1, 2) }, await renter(license));
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("LICENSE_NOT_VERIFIED");
        expect(await ctx.prisma.booking.count()).toBe(0);
      });

      it("tài khoản bị khóa không đặt được", async () => {
        const { vehicle, who, book } = await setup();
        await ctx.prisma.user.update({ where: { id: who.user.id }, data: { status: "blocked" } });
        const res = await book({ vehicleId: vehicle.id, ...range(1, 2) });
        expect(res.status).toBe(403);
      });
    });

    describe("xe", () => {
      it.each(["pending", "hidden", "rejected"] as const)("xe %s: 404 như không tồn tại", async (status) => {
        const { book } = await setup();
        const owner = await makeUser(ctx, "owner");
        const vehicle = await makeVehicle(ctx, owner.user.id, { status, ...(status === "rejected" ? { rejectReason: "x" } : {}) });
        const res = await book({ vehicleId: vehicle.id, ...range(1, 2) });
        expect(res.status).toBe(404);
      });

      it("xe không tồn tại: 404", async () => {
        const { book } = await setup();
        const res = await book({ vehicleId: "00000000-0000-4000-8000-000000000000", ...range(1, 2) });
        expect(res.status).toBe(404);
      });
    });

    describe("chống đặt trùng lịch", () => {
      it("trùng một phần hoặc trùng hoàn toàn với đơn đang giữ lịch: 409 BOOKING_OVERLAP", async () => {
        const { vehicle, book } = await setup();
        expect((await book({ vehicleId: vehicle.id, ...range(1, 4) })).status).toBe(201);

        const other = await renter();
        for (const [a, b] of [[1, 4], [2, 3], [0, 2], [3, 6], [0, 10]]) {
          const res = await book({ vehicleId: vehicle.id, ...range(a, b) }, other);
          expect(res.status).toBe(409);
          expect(res.body.code).toBe("BOOKING_OVERLAP");
        }
        expect(await ctx.prisma.booking.count()).toBe(1);
      });

      it("hai khoảng chạm đầu mút (trả xe đúng lúc người sau nhận xe) không tính là trùng", async () => {
        const { vehicle, book } = await setup();
        expect((await book({ vehicleId: vehicle.id, ...range(1, 3) })).status).toBe(201);
        const other = await renter();
        expect((await book({ vehicleId: vehicle.id, ...range(3, 5) }, other)).status).toBe(201);
        expect((await book({ vehicleId: vehicle.id, ...range(0, 1) }, await renter())).status).toBe(201);
      });

      it("xe khác không bị ảnh hưởng", async () => {
        const { vehicle, owner, book } = await setup();
        const other = await makeVehicle(ctx, owner.user.id, { status: "approved" });
        expect((await book({ vehicleId: vehicle.id, ...range(1, 3) })).status).toBe(201);
        expect((await book({ vehicleId: other.id, ...range(1, 3) }, await renter())).status).toBe(201);
      });

      it.each(["pending", "confirmed", "in_use"] as const)("đơn %s giữ lịch: 409", async (status) => {
        const { vehicle, book } = await setup();
        const other = await renter();
        await makeBooking(ctx, vehicle.id, other.user.id, new Date(BASE + DAY_MS), new Date(BASE + 3 * DAY_MS), status);
        const res = await book({ vehicleId: vehicle.id, ...range(2, 4) });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe("BOOKING_OVERLAP");
      });

      it.each(["cancelled", "expired", "rejected", "completed"] as const)("đơn %s không giữ lịch: đặt được", async (status) => {
        const { vehicle, book } = await setup();
        const other = await renter();
        await makeBooking(ctx, vehicle.id, other.user.id, new Date(BASE + DAY_MS), new Date(BASE + 3 * DAY_MS), status);
        expect((await book({ vehicleId: vehicle.id, ...range(1, 3) })).status).toBe(201);
      });

      it("trùng lịch chặn của chủ xe: 409 BOOKING_OVERLAP; chạm đầu mút thì được", async () => {
        const { vehicle, book } = await setup();
        await ctx.prisma.vehicleBlock.create({
          data: { vehicleId: vehicle.id, startAt: new Date(BASE + 2 * DAY_MS), endAt: new Date(BASE + 4 * DAY_MS), reason: "Bảo dưỡng" },
        });
        const overlapping = await book({ vehicleId: vehicle.id, ...range(3, 5) });
        expect(overlapping.status).toBe(409);
        expect(overlapping.body.code).toBe("BOOKING_OVERLAP");
        expect(JSON.stringify(overlapping.body)).not.toContain("Bảo dưỡng"); // không lộ lý do chặn của chủ xe

        expect((await book({ vehicleId: vehicle.id, ...range(0, 2) })).status).toBe(201);
        expect((await book({ vehicleId: vehicle.id, ...range(4, 6) }, await renter())).status).toBe(201);
      });

      it("5 khách đặt CÙNG LÚC một khoảng thời gian: đúng một người thành công, 4 người còn lại nhận 409", async () => {
        const { vehicle } = await setup();
        const renters = await Promise.all([1, 2, 3, 4, 5].map(() => renter()));
        const results = await Promise.all(
          renters.map((r) => http().post("/api/bookings").set(r.auth).send({ vehicleId: vehicle.id, ...range(1, 3) })),
        );

        expect(results.filter((r) => r.status === 201)).toHaveLength(1);
        expect(results.filter((r) => r.status === 409)).toHaveLength(4);
        expect(results.filter((r) => r.status === 409).every((r) => r.body.code === "BOOKING_OVERLAP")).toBe(true);
        expect(await ctx.prisma.booking.count({ where: { vehicleId: vehicle.id } })).toBe(1);
      });

      it("đặt cùng lúc các khoảng KHÔNG trùng nhau: tất cả thành công", async () => {
        const { vehicle } = await setup();
        const renters = await Promise.all([0, 1, 2].map(() => renter()));
        const results = await Promise.all(
          renters.map((r, i) => http().post("/api/bookings").set(r.auth).send({ vehicleId: vehicle.id, ...range(i * 3 + 1, i * 3 + 3) })),
        );
        expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
      });

      it("đặt đơn đồng thời với việc chủ xe chặn lịch: không bao giờ cùng thành công", async () => {
        const { vehicle, owner, who } = await setup();
        const [bookRes, blockRes] = await Promise.all([
          http().post("/api/bookings").set(who.auth).send({ vehicleId: vehicle.id, ...range(1, 3) }),
          http().post(`/api/owner/vehicles/${vehicle.id}/blocks`).set(owner.auth).send(range(2, 4)),
        ]);
        const bothOk = bookRes.status === 201 && blockRes.status === 201;
        expect(bothOk).toBe(false);
        expect([bookRes.status, blockRes.status].sort()).toEqual([201, 409]);
      });
    });

    describe("giới hạn đơn chờ và nhả đơn hết hạn", () => {
      it("tối đa 3 đơn pending cùng lúc: đơn thứ 4 nhận 409 PENDING_LIMIT", async () => {
        const { vehicle, who, book } = await setup();
        for (let i = 0; i < 3; i += 1) {
          expect((await book({ vehicleId: vehicle.id, ...range(i * 3 + 1, i * 3 + 2) }, who)).status).toBe(201);
        }
        const res = await book({ vehicleId: vehicle.id, ...range(20, 21) }, who);
        expect(res.status).toBe(409);
        expect(res.body.code).toBe("PENDING_LIMIT");
        expect(await ctx.prisma.booking.count({ where: { renterId: who.user.id } })).toBe(3);
      });

      it("khách khác không bị tính vào giới hạn của người này", async () => {
        const { vehicle, who, book } = await setup();
        for (let i = 0; i < 3; i += 1) await book({ vehicleId: vehicle.id, ...range(i * 3 + 1, i * 3 + 2) }, who);
        expect((await book({ vehicleId: vehicle.id, ...range(30, 31) }, await renter())).status).toBe(201);
      });

      it("hủy bớt một đơn thì đặt thêm được; đơn confirmed không tính vào giới hạn", async () => {
        const { vehicle, who, book } = await setup();
        const first = await book({ vehicleId: vehicle.id, ...range(1, 2) }, who);
        await book({ vehicleId: vehicle.id, ...range(4, 5) }, who);
        await book({ vehicleId: vehicle.id, ...range(7, 8) }, who);
        expect((await book({ vehicleId: vehicle.id, ...range(10, 11) }, who)).status).toBe(409);

        await ctx.prisma.booking.update({ where: { id: first.body.id }, data: { status: "cancelled", cancelledAt: new Date() } });
        expect((await book({ vehicleId: vehicle.id, ...range(10, 11) }, who)).status).toBe(201);

        // CSDL chỉ cho đơn confirmed khi đã thanh toán, nên ghi luôn khoản thanh toán.
        await ctx.prisma.$executeRaw`
          UPDATE bookings SET status = 'confirmed', paid_at = now(), paid_amount = total_amount + deposit_amount
          WHERE renter_id = ${who.user.id}::uuid AND status = 'pending'`;
        expect((await book({ vehicleId: vehicle.id, ...range(13, 14) }, who)).status).toBe(201);
      });

      it("7 yêu cầu song song của cùng một khách, trên 7 xe KHÁC NHAU: không vượt giới hạn 3 đơn", async () => {
        // Phải là xe khác nhau: nếu cùng một xe thì khóa theo xe đã xếp hàng các yêu cầu và che mất việc thiếu khóa theo khách.
        const { owner, who } = await setup();
        const vehicles = await Promise.all([0, 1, 2, 3, 4, 5, 6].map(() => makeVehicle(ctx, owner.user.id, { status: "approved" })));
        const results = await Promise.all(
          vehicles.map((v) => http().post("/api/bookings").set(who.auth).send({ vehicleId: v.id, ...range(1, 2) })),
        );
        expect(results.filter((r) => r.status === 201)).toHaveLength(3);
        expect(results.filter((r) => r.status === 409 && r.body.code === "PENDING_LIMIT")).toHaveLength(4);
        expect(await ctx.prisma.booking.count({ where: { renterId: who.user.id, status: "pending" } })).toBe(3);
      });

      it("đơn pending đã quá hạn giữ chỗ (job chưa kịp chạy) không chặn người đặt sau và được nhả thành expired", async () => {
        const { vehicle, book } = await setup();
        const other = await renter();
        const stale = await ctx.prisma.booking.create({
          data: {
            vehicleId: vehicle.id, renterId: other.user.id, startAt: new Date(BASE + DAY_MS), endAt: new Date(BASE + 3 * DAY_MS),
            status: "pending", rentalDays: 2, pricePerDay: 650000, totalAmount: 1_300_000, depositAmount: 390_000,
            expiresAt: new Date(Date.now() - 60_000),
          },
        });
        const res = await book({ vehicleId: vehicle.id, ...range(1, 3) });
        expect(res.status).toBe(201);
        expect((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe("expired");
      });

      it("đơn pending đã quá hạn không tính vào giới hạn 3 đơn", async () => {
        const { vehicle, who, book } = await setup();
        for (let i = 0; i < 3; i += 1) {
          await ctx.prisma.booking.create({
            data: {
              vehicleId: vehicle.id, renterId: who.user.id, startAt: new Date(BASE + (i * 3 + 1) * DAY_MS), endAt: new Date(BASE + (i * 3 + 2) * DAY_MS),
              status: "pending", rentalDays: 1, pricePerDay: 650000, totalAmount: 650000, depositAmount: 195000,
              expiresAt: new Date(Date.now() - 60_000),
            },
          });
        }
        expect((await book({ vehicleId: vehicle.id, ...range(20, 21) }, who)).status).toBe(201);
      });
    });
  });

  // Đơn pending quá hạn giữ chỗ mà job nhả lịch chưa chạy (hoặc đang ngừng) không được chiếm lịch ở BẤT KỲ đâu, không chỉ
  // lúc tạo đơn: nếu không, xe bị ẩn khỏi kết quả tìm kiếm dù thực ra đang trống.
  describe("đơn pending quá hạn giữ chỗ không còn chiếm lịch", () => {
    async function withHold(expiresInMs: number) {
      const s = await setup();
      const other = await renter();
      await ctx.prisma.booking.create({
        data: {
          vehicleId: s.vehicle.id, renterId: other.user.id, startAt: new Date(BASE + DAY_MS), endAt: new Date(BASE + 3 * DAY_MS),
          status: "pending", rentalDays: 2, pricePerDay: 650000, totalAmount: 1_300_000, depositAmount: 390_000,
          expiresAt: new Date(Date.now() + expiresInMs),
        },
      });
      const q = `startAt=${encodeURIComponent(iso(BASE + DAY_MS))}&endAt=${encodeURIComponent(iso(BASE + 3 * DAY_MS))}`;
      const month = iso(BASE + DAY_MS + 7 * HOUR_MS).slice(0, 7); // tháng theo giờ Việt Nam
      return { ...s, q, month };
    }

    it("còn hạn: xe bị loại khỏi tìm kiếm theo ngày, lịch trống báo bận, chủ xe không chặn chồng lên được", async () => {
      const { vehicle, owner, q, month } = await withHold(10 * 60_000);
      expect((await http().get(`/api/vehicles?${q}`)).body.total).toBe(0);
      expect((await http().get(`/api/vehicles/${vehicle.id}/availability?month=${month}`)).body.busy).toHaveLength(1);
      expect((await http().get(`/api/owner/vehicles/${vehicle.id}/calendar?month=${month}`).set(owner.auth)).body.busy).toHaveLength(1);
      const block = await http().post(`/api/owner/vehicles/${vehicle.id}/blocks`).set(owner.auth).send(range(1, 3));
      expect(block.status).toBe(409);
      expect(block.body.code).toBe("BLOCK_CONFLICTS_BOOKING");
    });

    it("quá hạn: xe hiện lại trong tìm kiếm, lịch trống không còn báo bận, chủ xe chặn ngày được", async () => {
      const { vehicle, owner, q, month } = await withHold(-60_000);
      expect((await http().get(`/api/vehicles?${q}`)).body.total).toBe(1);
      expect((await http().get(`/api/vehicles/${vehicle.id}/availability?month=${month}`)).body.busy).toHaveLength(0);
      expect((await http().get(`/api/owner/vehicles/${vehicle.id}/calendar?month=${month}`).set(owner.auth)).body.busy).toHaveLength(0);
      expect((await http().post(`/api/owner/vehicles/${vehicle.id}/blocks`).set(owner.auth).send(range(1, 3))).status).toBe(201);
    });
  });

  // Bấm "Đặt xe" hai lần, hoặc mạng rớt sau khi máy chủ đã tạo đơn rồi trình duyệt gửi lại: lần gửi lại phải nhận đúng đơn đã
  // tạo, không phải lỗi "xe không còn trống" (đơn chiếm chỗ lúc đó chính là đơn của người này).
  describe("gửi lại cùng một yêu cầu đặt xe", () => {
    it("cùng khách, cùng xe, cùng thời gian: trả lại đúng đơn đã tạo, không tạo đơn thứ hai", async () => {
      const { vehicle, who, book } = await setup();
      const first = await book({ vehicleId: vehicle.id, ...range(1, 3) });
      const again = await book({ vehicleId: vehicle.id, ...range(1, 3) });

      expect(first.status).toBe(201);
      expect(again.status).toBe(201);
      expect(again.body.id).toBe(first.body.id);
      expect(await ctx.prisma.booking.count({ where: { renterId: who.user.id } })).toBe(1);
    });

    it("hai yêu cầu giống hệt nhau gửi CÙNG LÚC: cả hai nhận cùng một đơn, chỉ có một đơn trong CSDL", async () => {
      const { vehicle, who } = await setup();
      const body = { vehicleId: vehicle.id, ...range(1, 3) };
      const [a, b] = await Promise.all([
        http().post("/api/bookings").set(who.auth).send(body),
        http().post("/api/bookings").set(who.auth).send(body),
      ]);
      expect([a.status, b.status]).toEqual([201, 201]);
      expect(a.body.id).toBe(b.body.id);
      expect(await ctx.prisma.booking.count({ where: { vehicleId: vehicle.id } })).toBe(1);
    });

    it("gửi lại không bị tính là đơn mới: đủ 3 đơn chờ vẫn gửi lại được đơn cũ", async () => {
      const { vehicle, who, book } = await setup();
      const first = await book({ vehicleId: vehicle.id, ...range(1, 2) }, who);
      await book({ vehicleId: vehicle.id, ...range(4, 5) }, who);
      await book({ vehicleId: vehicle.id, ...range(7, 8) }, who);

      const again = await book({ vehicleId: vehicle.id, ...range(1, 2) }, who);
      expect(again.status).toBe(201);
      expect(again.body.id).toBe(first.body.id);
    });

    it("khách KHÁC gửi đúng khoảng thời gian đó vẫn nhận 409, không được nhận đơn của người khác", async () => {
      const { vehicle, who, book } = await setup();
      const mine = await book({ vehicleId: vehicle.id, ...range(1, 3) }, who);
      const other = await book({ vehicleId: vehicle.id, ...range(1, 3) }, await renter());
      expect(other.status).toBe(409);
      expect(other.body.code).toBe("BOOKING_OVERLAP");
      expect(JSON.stringify(other.body)).not.toContain(mine.body.id);
    });

    it("cùng khách nhưng khác khoảng thời gian (chỉ trùng một phần) vẫn là đơn khác: 409", async () => {
      const { vehicle, who, book } = await setup();
      await book({ vehicleId: vehicle.id, ...range(1, 3) }, who);
      expect((await book({ vehicleId: vehicle.id, ...range(1, 4) }, who)).status).toBe(409);
    });

    it("đơn cũ đã bị hủy thì gửi lại là tạo đơn MỚI, không trả lại đơn đã hủy", async () => {
      const { vehicle, who, book } = await setup();
      const first = await book({ vehicleId: vehicle.id, ...range(1, 3) }, who);
      await ctx.prisma.booking.update({ where: { id: first.body.id }, data: { status: "cancelled", cancelledAt: new Date() } });
      const again = await book({ vehicleId: vehicle.id, ...range(1, 3) }, who);
      expect(again.status).toBe(201);
      expect(again.body.id).not.toBe(first.body.id);
    });
  });

  // Đơn pending đã quá hạn mà job chưa đổi thành expired: người dùng phải thấy nó là "hết hạn", không phải "chờ duyệt".
  describe("đơn quá hạn hiện đúng trạng thái dù job chưa chạy", () => {
    async function withStale() {
      const s = await setup();
      // Tạo đơn còn hạn TRƯỚC. Nếu tạo sau, chính việc tạo đơn sẽ nhả đơn quá hạn của xe này trong CSDL và bài test không còn
      // thử được trường hợp "job chưa chạy".
      const live = await s.book({ vehicleId: s.vehicle.id, ...range(10, 11) }, s.who);
      const stale = await ctx.prisma.booking.create({
        data: {
          vehicleId: s.vehicle.id, renterId: s.who.user.id, startAt: new Date(BASE + DAY_MS), endAt: new Date(BASE + 3 * DAY_MS),
          status: "pending", rentalDays: 2, pricePerDay: 650000, totalAmount: 1_300_000, depositAmount: 390_000,
          // Khách đã thanh toán nhưng chủ xe không trả lời trong 6 giờ.
          paidAt: new Date(Date.now() - 7 * HOUR_MS), paidAmount: 1_690_000,
          expiresAt: new Date(Date.now() - 60_000),
        },
      });
      const saved = await ctx.prisma.booking.findUniqueOrThrow({ where: { id: stale.id } });
      expect(saved).toMatchObject({ status: "pending", refundAmount: 0 }); // CSDL vẫn ghi pending và chưa ghi tiền hoàn
      return { ...s, staleId: stale.id, liveId: live.body.id as string };
    }
    const idsOf = (body: { items: { id: string }[] }) => body.items.map((b) => b.id).sort();

    it("chi tiết đơn: trả expired và số tiền hoàn đầy đủ cho khách, chủ xe và admin, dù job chưa ghi", async () => {
      const { who, owner, staleId } = await withStale();
      const admin = await makeUser(ctx, "admin");
      for (const viewer of [who, owner, admin]) {
        const res = await http().get(`/api/bookings/${staleId}`).set(viewer.auth);
        expect(res.body).toMatchObject({ status: "expired", refundAmount: 1_690_000 });
      }
    });

    it("danh sách: đơn quá hạn hiện là expired, đơn còn hạn vẫn pending", async () => {
      const { who, staleId, liveId } = await withStale();
      const res = await http().get("/api/bookings").set(who.auth);
      const byId = Object.fromEntries(res.body.items.map((b: { id: string; status: string }) => [b.id, b.status]));
      expect(byId[staleId]).toBe("expired");
      expect(byId[liveId]).toBe("pending");
    });

    it("lọc status=pending không gồm đơn quá hạn; lọc status=expired thì có", async () => {
      const { who, staleId, liveId } = await withStale();
      const pending = await http().get("/api/bookings?status=pending").set(who.auth);
      const expired = await http().get("/api/bookings?status=expired").set(who.auth);
      expect(idsOf(pending.body)).toEqual([liveId]);
      expect(pending.body.total).toBe(1);
      expect(idsOf(expired.body)).toEqual([staleId]);
      expect(expired.body.total).toBe(1);
    });

    it("lọc status=expired gồm cả đơn đã được đổi hẳn thành expired trong CSDL", async () => {
      const { who, vehicle, staleId } = await withStale();
      const other = await renter();
      const done = await makeBooking(ctx, vehicle.id, who.user.id, new Date(BASE + 20 * DAY_MS), new Date(BASE + 21 * DAY_MS), "expired");
      await makeBooking(ctx, vehicle.id, other.user.id, new Date(BASE + 30 * DAY_MS), new Date(BASE + 31 * DAY_MS), "expired");
      const expired = await http().get("/api/bookings?status=expired").set(who.auth);
      expect(idsOf(expired.body)).toEqual([staleId, done.id].sort());
    });
  });

  describe("GET /api/bookings", () => {
    it("chỉ trả đơn của chính mình, mới nhất trước, kèm tóm tắt xe và ảnh bìa", async () => {
      const { vehicle, who, book } = await setup();
      await ctx.prisma.vehicleImage.create({ data: { vehicleId: vehicle.id, storageKey: "vehicles/v/0.webp", position: 0 } });
      const first = await book({ vehicleId: vehicle.id, ...range(1, 2) }, who);
      const second = await book({ vehicleId: vehicle.id, ...range(4, 5) }, who);
      const stranger = await renter();
      await book({ vehicleId: vehicle.id, ...range(7, 8) }, stranger);

      const res = await http().get("/api/bookings").set(who.auth);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ total: 2, page: 1, limit: 20 });
      expect(res.body.items.map((b: { id: string }) => b.id)).toEqual([second.body.id, first.body.id]);
      expect(res.body.items[0].vehicle).toMatchObject({ id: vehicle.id, coverUrl: "/uploads/vehicles/v/0.webp" });
    });

    it("lọc theo trạng thái và phân trang; tham số sai trả 400", async () => {
      const { vehicle, who, book } = await setup();
      const a = await book({ vehicleId: vehicle.id, ...range(1, 2) }, who);
      await book({ vehicleId: vehicle.id, ...range(4, 5) }, who);
      await ctx.prisma.booking.update({ where: { id: a.body.id }, data: { status: "cancelled", cancelledAt: new Date() } });

      const cancelled = await http().get("/api/bookings?status=cancelled").set(who.auth);
      expect(cancelled.body.total).toBe(1);
      const page = await http().get("/api/bookings?limit=1&page=2").set(who.auth);
      expect(page.body).toMatchObject({ total: 2, page: 2, limit: 1 });
      expect(page.body.items).toHaveLength(1);

      expect((await http().get("/api/bookings?status=abc").set(who.auth)).status).toBe(400);
      expect((await http().get("/api/bookings?limit=999").set(who.auth)).status).toBe(400);
    });

    it("chưa đăng nhập: 401; chủ xe và admin: 403", async () => {
      const { owner } = await setup();
      const admin = await makeUser(ctx, "admin");
      expect((await http().get("/api/bookings")).status).toBe(401);
      expect((await http().get("/api/bookings").set(owner.auth)).status).toBe(403);
      expect((await http().get("/api/bookings").set(admin.auth)).status).toBe(403);
    });
  });

  describe("GET /api/bookings/:id", () => {
    async function withBooking({ pay = true } = {}) {
      const ctxData = await setup();
      const res = await ctxData.book({ vehicleId: ctxData.vehicle.id, ...range(1, 3) });
      const id = res.body.id as string;
      if (pay) expect((await http().post(`/api/bookings/${id}/pay`).set(ctxData.who.auth)).status).toBe(200);
      return { ...ctxData, id };
    }

    it("đơn khách chưa thanh toán: chủ xe chưa thấy (404), khách và admin vẫn xem được", async () => {
      const { owner, who, id } = await withBooking({ pay: false });
      const admin = await makeUser(ctx, "admin");
      expect((await http().get(`/api/bookings/${id}`).set(owner.auth)).status).toBe(404);
      expect((await http().get(`/api/bookings/${id}`).set(who.auth)).status).toBe(200);
      expect((await http().get(`/api/bookings/${id}`).set(admin.auth)).status).toBe(200);
    });

    it("khách xem đơn của mình: không có thông tin liên hệ khách", async () => {
      const { who, id } = await withBooking();
      const res = await http().get(`/api/bookings/${id}`).set(who.auth);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.renter).toBeUndefined();
      expect(res.body.ownerPayoutAmount).toBeUndefined();
    });

    it("chủ xe của chiếc xe đó và admin xem được, kèm tên và số điện thoại khách", async () => {
      const { owner, who, id } = await withBooking();
      const admin = await makeUser(ctx, "admin");
      for (const viewer of [owner, admin]) {
        const res = await http().get(`/api/bookings/${id}`).set(viewer.auth);
        expect(res.status).toBe(200);
        expect(res.body.renter).toEqual({ fullName: who.user.fullName, phone: who.user.phone });
        expect(res.body.ownerPayoutAmount).toBe(0);
      }
    });

    it("khách khác và chủ xe khác nhận 404 (không lộ sự tồn tại của đơn)", async () => {
      const { id } = await withBooking();
      const strangerRenter = await renter();
      const strangerOwner = await makeUser(ctx, "owner");
      expect((await http().get(`/api/bookings/${id}`).set(strangerRenter.auth)).status).toBe(404);
      expect((await http().get(`/api/bookings/${id}`).set(strangerOwner.auth)).status).toBe(404);
    });

    it("không lộ renterId và ownerId; id không tồn tại hoặc sai định dạng: 404; chưa đăng nhập: 401", async () => {
      const { owner, who, id } = await withBooking();
      const text = JSON.stringify((await http().get(`/api/bookings/${id}`).set(owner.auth)).body);
      expect(text).not.toContain(who.user.id);
      expect(text).not.toContain(owner.user.id);
      expect(text).not.toMatch(/renterId|ownerId/);

      expect((await http().get("/api/bookings/00000000-0000-4000-8000-000000000000").set(who.auth)).status).toBe(404);
      expect((await http().get("/api/bookings/khong-phai-uuid").set(who.auth)).status).toBe(404);
      expect((await http().get(`/api/bookings/${id}`)).status).toBe(401);
    });
  });
});
