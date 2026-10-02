import request from "supertest";
import { monthWindow } from "../src/vehicles/availability.service";
import { lockVehicle } from "../src/common/vehicle-lock";
import {
  createTestApp,
  DAY_MS,
  makeBooking,
  makeUser,
  makeVehicle,
  resetDatabase,
  sleep,
  TestContext,
  vehiclePayload,
} from "./helpers";

describe("Vehicles API", () => {
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

  describe("POST /api/owner/vehicles", () => {
    it("chủ xe tạo xe: trạng thái pending, tiêu đề tự sinh, biển số về dạng chuẩn, cọc mặc định 30%", async () => {
      const owner = await makeUser(ctx, "owner");
      const res = await http()
        .post("/api/owner/vehicles")
        .set(owner.auth)
        .send(vehiclePayload({ plateNumber: "  51k-123.45 " }));

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        title: "Toyota Vios 2022",
        plateNumber: "51K12345",
        status: "pending",
        depositRate: 30,
        rejectReason: null,
        pricePerDay: 650000,
      });
      expect(res.body.ownerId).toBeUndefined();

      const row = await ctx.prisma.vehicle.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row.ownerId).toBe(owner.user.id);
    });

    it("nhận tỷ lệ cọc tùy chỉnh", async () => {
      const owner = await makeUser(ctx, "owner");
      const res = await http().post("/api/owner/vehicles").set(owner.auth).send(vehiclePayload({ depositRate: 50 }));
      expect(res.status).toBe(201);
      expect(res.body.depositRate).toBe(50);
    });

    it("khách thuê và admin không tạo được xe (403 FORBIDDEN)", async () => {
      for (const role of ["renter", "admin"] as const) {
        const user = await makeUser(ctx, role);
        const res = await http().post("/api/owner/vehicles").set(user.auth).send(vehiclePayload());
        expect(res.status).toBe(403);
        expect(res.body.code).toBe("FORBIDDEN");
      }
      expect(await ctx.prisma.vehicle.count()).toBe(0);
    });

    it("không có token trả 401", async () => {
      const res = await http().post("/api/owner/vehicles").send(vehiclePayload());
      expect(res.status).toBe(401);
    });

    it.each([
      ["số chỗ dưới 2", { seats: 1 }],
      ["số chỗ trên 16", { seats: 17 }],
      ["giá âm", { pricePerDay: -1 }],
      ["giá quá thấp", { pricePerDay: 1000 }],
      ["giá không phải số nguyên", { pricePerDay: 650000.5 }],
      ["giá là chuỗi", { pricePerDay: "650000" }],
      ["tỷ lệ cọc trên 100", { depositRate: 101 }],
      ["năm sản xuất quá cũ", { year: 1900 }],
      ["năm sản xuất ở tương lai xa", { year: 3000 }],
      ["hộp số sai", { transmission: "cvt" }],
      ["nhiên liệu sai", { fuel: "hydro" }],
      ["biển số quá ngắn", { plateNumber: "A-1" }],
      ["biển số quá dài", { plateNumber: "1234567890123" }],
      ["biển số chỉ có ký hiệu", { plateNumber: "-----" }],
      ["thiếu hãng xe", { brand: undefined }],
      ["thiếu quận", { district: "" }],
    ])("trả 400 VALIDATION_ERROR khi %s", async (_label, overrides) => {
      const owner = await makeUser(ctx, "owner");
      const res = await http().post("/api/owner/vehicles").set(owner.auth).send(vehiclePayload(overrides));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(await ctx.prisma.vehicle.count()).toBe(0);
    });

    it.each([
      ["status", { status: "approved" }],
      ["ownerId", { ownerId: "00000000-0000-4000-8000-000000000000" }],
      ["title", { title: "Xe giả" }],
      ["rejectReason", { rejectReason: "x" }],
    ])("từ chối trường %s do client gửi lên (không thể tự duyệt xe)", async (_field, extra) => {
      const owner = await makeUser(ctx, "owner");
      const res = await http().post("/api/owner/vehicles").set(owner.auth).send(vehiclePayload(extra));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("biển số đã có trả 409 PLATE_TAKEN, kể cả của chủ xe khác", async () => {
      const a = await makeUser(ctx, "owner");
      const b = await makeUser(ctx, "owner");
      await http().post("/api/owner/vehicles").set(a.auth).send(vehiclePayload({ plateNumber: "51K-999.99" })).expect(201);

      const res = await http().post("/api/owner/vehicles").set(b.auth).send(vehiclePayload({ plateNumber: "51K-999.99" }));
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("PLATE_TAKEN");
    });

    it.each(["51k-999.99", "51K 999 99", "51K.999.99", "  51k99999  ", "51K–999.99"])(
      "viết biển số theo kiểu khác (%s) vẫn bị coi là trùng",
      async (variant) => {
        const a = await makeUser(ctx, "owner");
        const b = await makeUser(ctx, "owner");
        await http().post("/api/owner/vehicles").set(a.auth).send(vehiclePayload({ plateNumber: "51K-999.99" })).expect(201);

        const res = await http().post("/api/owner/vehicles").set(b.auth).send(vehiclePayload({ plateNumber: variant }));
        expect(res.status).toBe(409);
        expect(res.body.code).toBe("PLATE_TAKEN");
        expect(await ctx.prisma.vehicle.count()).toBe(1);
      },
    );
  });

  describe("GET /api/owner/vehicles", () => {
    it("chỉ trả xe của chính chủ xe, mới nhất trước, có phân trang", async () => {
      const a = await makeUser(ctx, "owner");
      const b = await makeUser(ctx, "owner");
      for (let i = 0; i < 3; i++) await http().post("/api/owner/vehicles").set(a.auth).send(vehiclePayload()).expect(201);
      await http().post("/api/owner/vehicles").set(b.auth).send(vehiclePayload()).expect(201);

      const all = await http().get("/api/owner/vehicles").set(a.auth);
      expect(all.status).toBe(200);
      expect(all.body).toMatchObject({ total: 3, page: 1, limit: 20 });
      expect(all.body.items).toHaveLength(3);

      const page = await http().get("/api/owner/vehicles?page=2&limit=2").set(a.auth);
      expect(page.body).toMatchObject({ total: 3, page: 2, limit: 2 });
      expect(page.body.items).toHaveLength(1);
    });

    it("lọc theo trạng thái", async () => {
      const owner = await makeUser(ctx, "owner");
      await makeVehicle(ctx, owner.user.id, { status: "approved" });
      await makeVehicle(ctx, owner.user.id, { status: "pending" });
      await makeVehicle(ctx, owner.user.id, { status: "pending" });

      const res = await http().get("/api/owner/vehicles?status=pending").set(owner.auth);
      expect(res.body.total).toBe(2);
      expect(res.body.items.every((v: { status: string }) => v.status === "pending")).toBe(true);
    });

    it.each([["status=xyz"], ["page=0"], ["limit=500"], ["limit=abc"]])("tham số sai (%s) trả 400", async (query) => {
      const owner = await makeUser(ctx, "owner");
      const res = await http().get(`/api/owner/vehicles?${query}`).set(owner.auth);
      expect(res.status).toBe(400);
    });

    it("khách thuê không xem được danh sách này", async () => {
      const renter = await makeUser(ctx, "renter");
      expect((await http().get("/api/owner/vehicles").set(renter.auth)).status).toBe(403);
    });
  });

  describe("GET /api/owner/vehicles/:id (quyền sở hữu)", () => {
    it("xem được xe của mình", async () => {
      const owner = await makeUser(ctx, "owner");
      const vehicle = await makeVehicle(ctx, owner.user.id);
      const res = await http().get(`/api/owner/vehicles/${vehicle.id}`).set(owner.auth);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(vehicle.id);
    });

    it("xe của chủ xe khác trả 404, y như xe không tồn tại", async () => {
      const a = await makeUser(ctx, "owner");
      const b = await makeUser(ctx, "owner");
      const vehicle = await makeVehicle(ctx, a.user.id);

      const other = await http().get(`/api/owner/vehicles/${vehicle.id}`).set(b.auth);
      const missing = await http().get("/api/owner/vehicles/00000000-0000-4000-8000-000000000000").set(b.auth);
      expect(other.status).toBe(404);
      expect(other.body).toEqual(missing.body);
    });

    it("id không phải UUID cũng trả 404", async () => {
      const owner = await makeUser(ctx, "owner");
      const res = await http().get("/api/owner/vehicles/khong-phai-uuid").set(owner.auth);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("NOT_FOUND");
    });
  });

  describe("PATCH /api/owner/vehicles/:id", () => {
    it("xe pending sửa giá vẫn pending", async () => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id, { status: "pending" });
      const res = await http().patch(`/api/owner/vehicles/${v.id}`).set(owner.auth).send({ pricePerDay: 700000 });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "pending", pricePerDay: 700000 });
    });

    it("xe approved: đổi mô tả, thành phố, quận thì giữ approved", async () => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id, { status: "approved" });
      const res = await http()
        .patch(`/api/owner/vehicles/${v.id}`)
        .set(owner.auth)
        .send({ description: "Mô tả mới", city: "Hà Nội", district: "Cầu Giấy" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "approved", description: "Mô tả mới", city: "Hà Nội", district: "Cầu Giấy" });
    });

    it.each([
      ["pricePerDay", { pricePerDay: 800000 }],
      ["plateNumber", { plateNumber: "29A-111.11" }],
      ["seats", { seats: 7 }],
      ["fuel", { fuel: "electric" }],
      ["transmission", { transmission: "manual" }],
      ["depositRate", { depositRate: 40 }],
    ])("xe approved đổi %s thì về pending và xóa kết quả duyệt cũ", async (_field, patch) => {
      const owner = await makeUser(ctx, "owner");
      const admin = await makeUser(ctx, "admin");
      const v = await makeVehicle(ctx, owner.user.id, {
        status: "approved",
        reviewedById: admin.user.id,
        reviewedAt: new Date(),
      });

      const res = await http().patch(`/api/owner/vehicles/${v.id}`).set(owner.auth).send(patch);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("pending");

      const row = await ctx.prisma.vehicle.findUniqueOrThrow({ where: { id: v.id } });
      expect(row.reviewedById).toBeNull();
      expect(row.reviewedAt).toBeNull();
    });

    it("đổi hãng, mẫu hoặc năm thì tiêu đề được tạo lại", async () => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id, { status: "pending" });
      const res = await http()
        .patch(`/api/owner/vehicles/${v.id}`)
        .set(owner.auth)
        .send({ brand: "Mazda", model: "CX-5", year: 2021 });
      expect(res.body.title).toBe("Mazda CX-5 2021");
    });

    it("xe bị từ chối: sửa lại thì về pending và xóa lý do từ chối", async () => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id, { status: "rejected", rejectReason: "Ảnh mờ" });

      const res = await http().patch(`/api/owner/vehicles/${v.id}`).set(owner.auth).send({ description: "Đã chụp lại ảnh" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "pending", rejectReason: null });
    });

    it("xe đang ẩn: đổi thông tin quan trọng về pending, đổi mô tả vẫn ẩn", async () => {
      const owner = await makeUser(ctx, "owner");
      const hiddenA = await makeVehicle(ctx, owner.user.id, { status: "hidden" });
      const hiddenB = await makeVehicle(ctx, owner.user.id, { status: "hidden" });

      const important = await http().patch(`/api/owner/vehicles/${hiddenA.id}`).set(owner.auth).send({ pricePerDay: 900000 });
      const minor = await http().patch(`/api/owner/vehicles/${hiddenB.id}`).set(owner.auth).send({ description: "Mới" });
      expect(important.body.status).toBe("pending");
      expect(minor.body.status).toBe("hidden");
    });

    it("gửi lại đúng giá trị cũ không làm xe mất trạng thái đã duyệt", async () => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id, { status: "approved", pricePerDay: 650000 });
      const res = await http().patch(`/api/owner/vehicles/${v.id}`).set(owner.auth).send({ pricePerDay: 650000 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("approved");
    });

    it("không sửa được xe của chủ xe khác (404) và không làm đổi dữ liệu", async () => {
      const a = await makeUser(ctx, "owner");
      const b = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, a.user.id, { status: "approved" });

      const res = await http().patch(`/api/owner/vehicles/${v.id}`).set(b.auth).send({ pricePerDay: 700000 });
      expect(res.status).toBe(404);
      const row = await ctx.prisma.vehicle.findUniqueOrThrow({ where: { id: v.id } });
      expect(row.pricePerDay).toBe(650000);
      expect(row.status).toBe("approved");
    });

    it("body rỗng trả 400", async () => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id);
      expect((await http().patch(`/api/owner/vehicles/${v.id}`).set(owner.auth).send({})).status).toBe(400);
    });

    it.each([
      ["status", { status: "approved" }],
      ["ownerId", { ownerId: "00000000-0000-4000-8000-000000000000" }],
      ["title", { title: "Xe giả" }],
      ["reviewedById", { reviewedById: "00000000-0000-4000-8000-000000000000" }],
    ])("không tự đổi %s qua PATCH", async (_field, patch) => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id, { status: "pending" });
      const res = await http().patch(`/api/owner/vehicles/${v.id}`).set(owner.auth).send(patch);
      expect(res.status).toBe(400);
      expect((await ctx.prisma.vehicle.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("pending");
    });

    it("đổi sang biển số của xe khác trả 409 PLATE_TAKEN", async () => {
      const owner = await makeUser(ctx, "owner");
      const first = await makeVehicle(ctx, owner.user.id, { plateNumber: "51A00001" });
      const second = await makeVehicle(ctx, owner.user.id);

      const res = await http().patch(`/api/owner/vehicles/${second.id}`).set(owner.auth).send({ plateNumber: first.plateNumber });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("PLATE_TAKEN");
    });
  });

  describe("POST /api/owner/vehicles/:id/hide", () => {
    it("ẩn xe approved rồi hiện lại, không cần duyệt lại", async () => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id, { status: "approved" });

      const hidden = await http().post(`/api/owner/vehicles/${v.id}/hide`).set(owner.auth).send({ hidden: true });
      expect(hidden.status).toBe(200);
      expect(hidden.body.status).toBe("hidden");

      const shown = await http().post(`/api/owner/vehicles/${v.id}/hide`).set(owner.auth).send({ hidden: false });
      expect(shown.status).toBe(200);
      expect(shown.body.status).toBe("approved");
    });

    it("gọi lặp lại cùng giá trị vẫn thành công", async () => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id, { status: "hidden" });
      const again = await http().post(`/api/owner/vehicles/${v.id}/hide`).set(owner.auth).send({ hidden: true });
      expect(again.status).toBe(200);
      expect(again.body.status).toBe("hidden");
    });

    it.each(["pending", "rejected"] as const)("xe %s không ẩn được (409 INVALID_STATE)", async (status) => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id, { status, rejectReason: status === "rejected" ? "x" : null });
      const res = await http().post(`/api/owner/vehicles/${v.id}/hide`).set(owner.auth).send({ hidden: true });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVALID_STATE");
    });

    it("xe pending không thể bấm 'hiện' để bỏ qua bước duyệt", async () => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id, { status: "pending" });
      const res = await http().post(`/api/owner/vehicles/${v.id}/hide`).set(owner.auth).send({ hidden: false });
      expect(res.status).toBe(409);
      expect((await ctx.prisma.vehicle.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("pending");
    });

    it("thiếu hoặc sai kiểu hidden trả 400", async () => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id);
      expect((await http().post(`/api/owner/vehicles/${v.id}/hide`).set(owner.auth).send({})).status).toBe(400);
      expect((await http().post(`/api/owner/vehicles/${v.id}/hide`).set(owner.auth).send({ hidden: "true" })).status).toBe(400);
    });

    it("không ẩn được xe của người khác (404)", async () => {
      const a = await makeUser(ctx, "owner");
      const b = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, a.user.id);
      const res = await http().post(`/api/owner/vehicles/${v.id}/hide`).set(b.auth).send({ hidden: true });
      expect(res.status).toBe(404);
      expect((await ctx.prisma.vehicle.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("approved");
    });
  });

  describe("lịch chặn /api/owner/vehicles/:id/blocks", () => {
    const base = Date.now() + 30 * DAY_MS;
    const at = (days: number) => new Date(base + days * DAY_MS).toISOString();

    it("tạo, liệt kê và xóa lịch chặn", async () => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id);

      const created = await http()
        .post(`/api/owner/vehicles/${v.id}/blocks`)
        .set(owner.auth)
        .send({ startAt: at(1), endAt: at(3), reason: "  Đi bảo dưỡng " });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ vehicleId: v.id, reason: "Đi bảo dưỡng" });

      const list = await http().get(`/api/owner/vehicles/${v.id}/blocks`).set(owner.auth);
      expect(list.body).toHaveLength(1);

      const removed = await http().delete(`/api/owner/vehicles/${v.id}/blocks/${created.body.id}`).set(owner.auth);
      expect(removed.status).toBe(204);
      expect(await ctx.prisma.vehicleBlock.count()).toBe(0);
    });

    it("hai lịch chặn chồng nhau trả 409 BLOCK_OVERLAP", async () => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id);
      await http().post(`/api/owner/vehicles/${v.id}/blocks`).set(owner.auth).send({ startAt: at(1), endAt: at(4) }).expect(201);

      const res = await http().post(`/api/owner/vehicles/${v.id}/blocks`).set(owner.auth).send({ startAt: at(3), endAt: at(6) });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("BLOCK_OVERLAP");
      expect(await ctx.prisma.vehicleBlock.count()).toBe(1);
    });

    it("hai lịch chặn nối tiếp nhau (kết thúc đúng lúc bắt đầu) không bị coi là chồng", async () => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id);
      await http().post(`/api/owner/vehicles/${v.id}/blocks`).set(owner.auth).send({ startAt: at(1), endAt: at(3) }).expect(201);
      await http().post(`/api/owner/vehicles/${v.id}/blocks`).set(owner.auth).send({ startAt: at(3), endAt: at(5) }).expect(201);
    });

    it("hai xe khác nhau chặn cùng khoảng thời gian không ảnh hưởng nhau", async () => {
      const owner = await makeUser(ctx, "owner");
      const v1 = await makeVehicle(ctx, owner.user.id);
      const v2 = await makeVehicle(ctx, owner.user.id);
      await http().post(`/api/owner/vehicles/${v1.id}/blocks`).set(owner.auth).send({ startAt: at(1), endAt: at(3) }).expect(201);
      await http().post(`/api/owner/vehicles/${v2.id}/blocks`).set(owner.auth).send({ startAt: at(1), endAt: at(3) }).expect(201);
    });

    it.each([
      ["trùng đơn đang chờ (pending)", "pending"],
      ["trùng đơn đã xác nhận (confirmed)", "confirmed"],
      ["trùng đơn đang thuê (in_use)", "in_use"],
    ] as const)("chặn lịch %s trả 409 BLOCK_CONFLICTS_BOOKING", async (_label, status) => {
      const owner = await makeUser(ctx, "owner");
      const renter = await makeUser(ctx, "renter");
      const v = await makeVehicle(ctx, owner.user.id);
      await makeBooking(ctx, v.id, renter.user.id, new Date(at(2)), new Date(at(4)), status);

      const res = await http().post(`/api/owner/vehicles/${v.id}/blocks`).set(owner.auth).send({ startAt: at(3), endAt: at(5) });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("BLOCK_CONFLICTS_BOOKING");
      expect(await ctx.prisma.vehicleBlock.count()).toBe(0);
    });

    it.each(["cancelled", "expired", "rejected", "completed"] as const)(
      "đơn %s không giữ lịch nên vẫn chặn được",
      async (status) => {
        const owner = await makeUser(ctx, "owner");
        const renter = await makeUser(ctx, "renter");
        const v = await makeVehicle(ctx, owner.user.id);
        await makeBooking(ctx, v.id, renter.user.id, new Date(at(2)), new Date(at(4)), status);
        await http().post(`/api/owner/vehicles/${v.id}/blocks`).set(owner.auth).send({ startAt: at(3), endAt: at(5) }).expect(201);
      },
    );

    it("chặn lịch phải đợi transaction đang giữ khóa xe, không thể chen vào giữa lúc đơn đang được ghi", async () => {
      const owner = await makeUser(ctx, "owner");
      const renter = await makeUser(ctx, "renter");
      const v = await makeVehicle(ctx, owner.user.id);

      // Giả lập luồng đặt xe (PLAN Ngày 13): lấy khóa, ghi đơn, giữ transaction mở thêm một lúc rồi mới commit.
      const booking = ctx.prisma.$transaction(
        async (tx) => {
          await lockVehicle(tx, v.id);
          await tx.booking.create({
            data: {
              vehicleId: v.id,
              renterId: renter.user.id,
              startAt: new Date(at(2)),
              endAt: new Date(at(4)),
              rentalDays: 2,
              pricePerDay: 650000,
              totalAmount: 1300000,
              depositAmount: 390000,
            },
          });
          await sleep(500);
        },
        { timeout: 10_000 },
      );
      await sleep(150);

      // Request này đến khi đơn chưa commit. Không có khóa thì nó thấy "chưa có đơn nào" và tạo lịch chặn, dẫn tới
      // vừa có đơn vừa có lịch chặn trên cùng khoảng thời gian (EXCLUDE không chặn chéo hai bảng).
      const res = await http().post(`/api/owner/vehicles/${v.id}/blocks`).set(owner.auth).send({ startAt: at(3), endAt: at(5) });
      await booking;

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("BLOCK_CONFLICTS_BOOKING");
      expect(await ctx.prisma.vehicleBlock.count()).toBe(0);
    });

    it("hai request chặn lịch đồng thời cùng khoảng thời gian: chỉ một request thành công", async () => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id);
      const send = () =>
        http().post(`/api/owner/vehicles/${v.id}/blocks`).set(owner.auth).send({ startAt: at(1), endAt: at(3) });

      const results = await Promise.all([send(), send(), send()]);
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(2);
      expect(await ctx.prisma.vehicleBlock.count()).toBe(1);
    });

    it.each([
      ["kết thúc trước bắt đầu", () => ({ startAt: at(3), endAt: at(1) })],
      ["kết thúc bằng bắt đầu", () => ({ startAt: at(3), endAt: at(3) })],
      ["đã nằm hoàn toàn trong quá khứ", () => ({ startAt: at(-60), endAt: at(-50) })],
      ["dài hơn 366 ngày", () => ({ startAt: at(1), endAt: at(400) })],
      ["thời gian không có múi giờ", () => ({ startAt: "2030-01-01T10:00:00", endAt: "2030-01-02T10:00:00" })],
      ["ngày trần không có giờ", () => ({ startAt: "2030-01-01", endAt: "2030-01-02" })],
      ["chuỗi rác", () => ({ startAt: "mai", endAt: "kia" })],
      ["lý do quá dài", () => ({ startAt: at(1), endAt: at(2), reason: "x".repeat(201) })],
    ])("từ chối lịch chặn %s (400)", async (_label, body) => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id);
      const res = await http().post(`/api/owner/vehicles/${v.id}/blocks`).set(owner.auth).send(body());
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("không chặn, xem hay xóa lịch của xe người khác (404)", async () => {
      const a = await makeUser(ctx, "owner");
      const b = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, a.user.id);
      const block = await ctx.prisma.vehicleBlock.create({
        data: { vehicleId: v.id, startAt: new Date(at(1)), endAt: new Date(at(2)) },
      });

      expect((await http().post(`/api/owner/vehicles/${v.id}/blocks`).set(b.auth).send({ startAt: at(5), endAt: at(6) })).status).toBe(404);
      expect((await http().get(`/api/owner/vehicles/${v.id}/blocks`).set(b.auth)).status).toBe(404);
      expect((await http().delete(`/api/owner/vehicles/${v.id}/blocks/${block.id}`).set(b.auth)).status).toBe(404);
      expect(await ctx.prisma.vehicleBlock.count()).toBe(1);
    });

    it("không xóa được lịch chặn thuộc xe khác của cùng chủ xe qua đường dẫn của xe này", async () => {
      const owner = await makeUser(ctx, "owner");
      const v1 = await makeVehicle(ctx, owner.user.id);
      const v2 = await makeVehicle(ctx, owner.user.id);
      const block = await ctx.prisma.vehicleBlock.create({
        data: { vehicleId: v2.id, startAt: new Date(at(1)), endAt: new Date(at(2)) },
      });
      const res = await http().delete(`/api/owner/vehicles/${v1.id}/blocks/${block.id}`).set(owner.auth);
      expect(res.status).toBe(404);
      expect(await ctx.prisma.vehicleBlock.count()).toBe(1);
    });

    it("xóa lịch chặn không tồn tại trả 404", async () => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id);
      const res = await http().delete(`/api/owner/vehicles/${v.id}/blocks/00000000-0000-4000-8000-000000000000`).set(owner.auth);
      expect(res.status).toBe(404);
    });

    it("khách thuê không dùng được endpoint chặn lịch", async () => {
      const owner = await makeUser(ctx, "owner");
      const renter = await makeUser(ctx, "renter");
      const v = await makeVehicle(ctx, owner.user.id);
      const res = await http().post(`/api/owner/vehicles/${v.id}/blocks`).set(renter.auth).send({ startAt: at(1), endAt: at(2) });
      expect(res.status).toBe(403);
    });
  });

  describe("lịch trống", () => {
    // Một tháng cách hiện tại khoảng 90 ngày, tính theo giờ Việt Nam
    const window = monthWindow(undefined, new Date(Date.now() + 90 * DAY_MS));
    const t = (day: number, hour = 0) => new Date(window.from.getTime() + (day - 1) * DAY_MS + hour * 3_600_000);

    it("công khai (không cần token): gồm đơn đang giữ lịch và lịch chặn, không lộ thông tin", async () => {
      const owner = await makeUser(ctx, "owner");
      const renter = await makeUser(ctx, "renter");
      const v = await makeVehicle(ctx, owner.user.id, { status: "approved" });
      await makeBooking(ctx, v.id, renter.user.id, t(10, 9), t(12, 9), "confirmed");
      await ctx.prisma.vehicleBlock.create({ data: { vehicleId: v.id, startAt: t(20), endAt: t(22), reason: "Việc riêng" } });

      const res = await http().get(`/api/vehicles/${v.id}/availability?month=${window.month}`);
      expect(res.status).toBe(200);
      expect(res.body.month).toBe(window.month);
      expect(res.body.busy).toEqual([
        { startAt: t(10, 9).toISOString(), endAt: t(12, 9).toISOString() },
        { startAt: t(20).toISOString(), endAt: t(22).toISOString() },
      ]);

      const text = JSON.stringify(res.body);
      expect(text).not.toContain("Việc riêng");
      expect(text).not.toContain(renter.user.id);
      expect(text).not.toContain("kind");
    });

    it("bỏ qua đơn đã hủy, hết hạn, bị từ chối, hoàn tất", async () => {
      const owner = await makeUser(ctx, "owner");
      const renter = await makeUser(ctx, "renter");
      const v = await makeVehicle(ctx, owner.user.id);
      for (const [i, status] of (["cancelled", "expired", "rejected", "completed"] as const).entries()) {
        await makeBooking(ctx, v.id, renter.user.id, t(5 + i * 2), t(6 + i * 2), status);
      }
      await makeBooking(ctx, v.id, renter.user.id, t(25), t(26), "pending");

      const res = await http().get(`/api/vehicles/${v.id}/availability?month=${window.month}`);
      expect(res.body.busy).toEqual([{ startAt: t(25).toISOString(), endAt: t(26).toISOString() }]);
    });

    it("chỉ trả khoảng giao với tháng được hỏi, kể cả đơn bắc qua ranh giới tháng", async () => {
      const owner = await makeUser(ctx, "owner");
      const renter = await makeUser(ctx, "renter");
      const v = await makeVehicle(ctx, owner.user.id);
      await makeBooking(ctx, v.id, renter.user.id, new Date(window.from.getTime() - 2 * DAY_MS), new Date(window.from.getTime() + DAY_MS)); // bắc qua đầu tháng
      await makeBooking(ctx, v.id, renter.user.id, new Date(window.to.getTime() - DAY_MS), new Date(window.to.getTime() + DAY_MS)); // bắc qua cuối tháng
      await makeBooking(ctx, v.id, renter.user.id, new Date(window.from.getTime() - 10 * DAY_MS), new Date(window.from.getTime() - 8 * DAY_MS)); // tháng trước
      await makeBooking(ctx, v.id, renter.user.id, new Date(window.to.getTime() + 8 * DAY_MS), new Date(window.to.getTime() + 10 * DAY_MS)); // tháng sau

      const res = await http().get(`/api/vehicles/${v.id}/availability?month=${window.month}`);
      expect(res.body.busy).toHaveLength(2);
    });

    it("đơn kết thúc đúng 00:00 ngày đầu tháng không chiếm giờ nào của tháng đó", async () => {
      const owner = await makeUser(ctx, "owner");
      const renter = await makeUser(ctx, "renter");
      const v = await makeVehicle(ctx, owner.user.id);
      await makeBooking(ctx, v.id, renter.user.id, new Date(window.from.getTime() - 5 * DAY_MS), window.from);

      const res = await http().get(`/api/vehicles/${v.id}/availability?month=${window.month}`);
      expect(res.body.busy).toEqual([]);
    });

    it("không gửi month thì lấy tháng hiện tại", async () => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id);
      const res = await http().get(`/api/vehicles/${v.id}/availability`);
      expect(res.status).toBe(200);
      expect(res.body.month).toBe(monthWindow(undefined).month);
    });

    it.each([["2026-13"], ["2026-1"], ["abc"], ["2026-10-01"]])("month sai (%s) trả 400", async (month) => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id);
      const res = await http().get(`/api/vehicles/${v.id}/availability?month=${month}`);
      expect(res.status).toBe(400);
    });

    it.each(["pending", "rejected", "hidden"] as const)("xe %s không có lịch công khai (404)", async (status) => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id, { status, rejectReason: status === "rejected" ? "x" : null });
      const res = await http().get(`/api/vehicles/${v.id}/availability`);
      expect(res.status).toBe(404);
    });

    it("xe không tồn tại hoặc id sai trả 404", async () => {
      expect((await http().get("/api/vehicles/00000000-0000-4000-8000-000000000000/availability")).status).toBe(404);
      expect((await http().get("/api/vehicles/abc/availability")).status).toBe(404);
    });

    it("chủ xe xem lịch có phân biệt booked và blocked", async () => {
      const owner = await makeUser(ctx, "owner");
      const renter = await makeUser(ctx, "renter");
      const v = await makeVehicle(ctx, owner.user.id, { status: "pending" }); // xe chưa duyệt vẫn xem được lịch của mình
      await makeBooking(ctx, v.id, renter.user.id, t(10), t(12));
      await ctx.prisma.vehicleBlock.create({ data: { vehicleId: v.id, startAt: t(20), endAt: t(22) } });

      const res = await http().get(`/api/owner/vehicles/${v.id}/calendar?month=${window.month}`).set(owner.auth);
      expect(res.status).toBe(200);
      expect(res.body.busy.map((b: { kind: string }) => b.kind)).toEqual(["booked", "blocked"]);
    });

    it("chủ xe không xem được lịch chi tiết của xe người khác (404)", async () => {
      const a = await makeUser(ctx, "owner");
      const b = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, a.user.id);
      expect((await http().get(`/api/owner/vehicles/${v.id}/calendar`).set(b.auth)).status).toBe(404);
    });

    it("lịch chi tiết của chủ xe yêu cầu đăng nhập", async () => {
      const owner = await makeUser(ctx, "owner");
      const v = await makeVehicle(ctx, owner.user.id);
      expect((await http().get(`/api/owner/vehicles/${v.id}/calendar`)).status).toBe(401);
    });
  });
});
