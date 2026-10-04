import request from "supertest";
import sharp from "sharp";
import { createTestApp, makeUser, makeVehicle, resetDatabase, sleep, TestContext } from "./helpers";

describe("Admin vehicle review API", () => {
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

  // CSDL không cho xe rejected thiếu lý do (ràng buộc vehicles_reject_needs_reason).
  function rejection(status: string): { rejectReason?: string } {
    return status === "rejected" ? { rejectReason: "Lý do có sẵn" } : {};
  }

  // Ảnh thêm thẳng vào CSDL: test duyệt xe không cần đi qua việc tải file.
  async function addImages(vehicleId: string, count: number): Promise<void> {
    for (let position = 0; position < count; position += 1) {
      await ctx.prisma.vehicleImage.create({
        data: { vehicleId, storageKey: `vehicles/${vehicleId}/${position}.webp`, position },
      });
    }
  }

  async function setup(status: "pending" | "approved" | "rejected" | "hidden" = "pending", images = 1) {
    const admin = await makeUser(ctx, "admin");
    const owner = await makeUser(ctx, "owner");
    const vehicle = await makeVehicle(ctx, owner.user.id, { status, ...rejection(status) });
    await addImages(vehicle.id, images);
    return { admin, owner, vehicle };
  }

  describe("quyền truy cập", () => {
    it.each(["get", "post"] as const)("chưa đăng nhập: 401 (%s)", async (method) => {
      const { vehicle } = await setup();
      const url = method === "get" ? "/api/admin/vehicles" : `/api/admin/vehicles/${vehicle.id}/approve`;
      expect((await http()[method](url)).status).toBe(401);
    });

    it("chủ xe và khách thuê đều bị 403 ở cả danh sách, duyệt và từ chối", async () => {
      const { vehicle, owner } = await setup();
      const renter = await makeUser(ctx, "renter");
      for (const who of [owner, renter]) {
        expect((await http().get("/api/admin/vehicles").set(who.auth)).status).toBe(403);
        expect((await http().post(`/api/admin/vehicles/${vehicle.id}/approve`).set(who.auth)).status).toBe(403);
        expect(
          (await http().post(`/api/admin/vehicles/${vehicle.id}/reject`).set(who.auth).send({ reason: "x" })).status,
        ).toBe(403);
      }
      expect((await ctx.prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).status).toBe("pending");
    });
  });

  describe("GET /api/admin/vehicles", () => {
    it("lọc theo trạng thái, kèm thông tin chủ xe và ảnh, không lộ trường nhạy cảm", async () => {
      const { admin, owner, vehicle } = await setup("pending", 2);
      await makeVehicle(ctx, owner.user.id, { status: "approved" });

      const res = await http().get("/api/admin/vehicles?status=pending").set(admin.auth);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ total: 1, page: 1, limit: 20 });

      const item = res.body.items[0];
      expect(item.id).toBe(vehicle.id);
      expect(item.owner).toEqual({
        id: owner.user.id,
        fullName: owner.user.fullName,
        email: owner.user.email,
        phone: owner.user.phone,
      });
      expect(item.images).toHaveLength(2);
      expect(Object.keys(item.images[0]).sort()).toEqual(["id", "position", "url"]);
      expect(item.images[0].url).toBe(`/uploads/vehicles/${vehicle.id}/0.webp`);
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|storageKey|ownerId|reviewedById/);
    });

    it("không lọc thì trả mọi trạng thái", async () => {
      const { admin, owner } = await setup("pending");
      await makeVehicle(ctx, owner.user.id, { status: "approved" });
      await makeVehicle(ctx, owner.user.id, { status: "rejected", ...rejection("rejected") });
      const res = await http().get("/api/admin/vehicles").set(admin.auth);
      expect(res.body.total).toBe(3);
    });

    it("hàng đợi chờ duyệt: xe cũ nhất trước; các trạng thái khác: mới nhất trước", async () => {
      const admin = await makeUser(ctx, "admin");
      const owner = await makeUser(ctx, "owner");
      const first = await makeVehicle(ctx, owner.user.id, { status: "pending" });
      await sleep(15);
      const second = await makeVehicle(ctx, owner.user.id, { status: "pending" });
      await sleep(15);
      const third = await makeVehicle(ctx, owner.user.id, { status: "approved" });
      await sleep(15);
      const fourth = await makeVehicle(ctx, owner.user.id, { status: "approved" });

      const pending = await http().get("/api/admin/vehicles?status=pending").set(admin.auth);
      expect(pending.body.items.map((v: { id: string }) => v.id)).toEqual([first.id, second.id]);

      const approved = await http().get("/api/admin/vehicles?status=approved").set(admin.auth);
      expect(approved.body.items.map((v: { id: string }) => v.id)).toEqual([fourth.id, third.id]);
    });

    it("phân trang và từ chối tham số sai", async () => {
      const { admin, owner } = await setup("pending");
      await makeVehicle(ctx, owner.user.id, { status: "pending" });
      const page2 = await http().get("/api/admin/vehicles?status=pending&limit=1&page=2").set(admin.auth);
      expect(page2.body).toMatchObject({ total: 2, page: 2, limit: 1 });
      expect(page2.body.items).toHaveLength(1);

      expect((await http().get("/api/admin/vehicles?status=abc").set(admin.auth)).status).toBe(400);
      expect((await http().get("/api/admin/vehicles?limit=999").set(admin.auth)).status).toBe(400);
    });
  });

  describe("POST /api/admin/vehicles/:id/approve", () => {
    it("duyệt xe chờ duyệt: thành approved, ghi người duyệt và thời điểm", async () => {
      const { admin, vehicle } = await setup();
      const res = await http().post(`/api/admin/vehicles/${vehicle.id}/approve`).set(admin.auth);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: vehicle.id, status: "approved", rejectReason: null });
      expect(res.body.reviewedAt).toEqual(expect.any(String));

      const row = await ctx.prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
      expect(row.status).toBe("approved");
      expect(row.reviewedById).toBe(admin.user.id);
    });

    it("xe công khai sau khi duyệt: chủ xe thấy trạng thái approved", async () => {
      const { admin, owner, vehicle } = await setup();
      await http().post(`/api/admin/vehicles/${vehicle.id}/approve`).set(admin.auth);
      const res = await http().get(`/api/owner/vehicles/${vehicle.id}`).set(owner.auth);
      expect(res.body.status).toBe("approved");
    });

    it("xe chưa có ảnh: 409 INVALID_STATE, vẫn chờ duyệt", async () => {
      const { admin, vehicle } = await setup("pending", 0);
      const res = await http().post(`/api/admin/vehicles/${vehicle.id}/approve`).set(admin.auth);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVALID_STATE");
      expect((await ctx.prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).status).toBe("pending");
    });

    it("gọi lặp lại trên xe đã duyệt vẫn thành công và không đổi người duyệt", async () => {
      const { admin, vehicle } = await setup();
      await http().post(`/api/admin/vehicles/${vehicle.id}/approve`).set(admin.auth);
      const other = await makeUser(ctx, "admin");
      const again = await http().post(`/api/admin/vehicles/${vehicle.id}/approve`).set(other.auth);
      expect(again.status).toBe(200);
      expect((await ctx.prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).reviewedById).toBe(
        admin.user.id,
      );
    });

    it.each(["rejected", "hidden"] as const)("xe %s không duyệt trực tiếp được: 409", async (status) => {
      const { admin, vehicle } = await setup(status);
      const res = await http().post(`/api/admin/vehicles/${vehicle.id}/approve`).set(admin.auth);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVALID_STATE");
    });

    it("xe không tồn tại hoặc id sai định dạng: 404", async () => {
      const { admin } = await setup();
      const missing = await http().post("/api/admin/vehicles/00000000-0000-4000-8000-000000000000/approve").set(admin.auth);
      expect(missing.status).toBe(404);
      expect((await http().post("/api/admin/vehicles/khong-phai-uuid/approve").set(admin.auth)).status).toBe(404);
    });
  });

  describe("POST /api/admin/vehicles/:id/reject", () => {
    it("từ chối kèm lý do: rejected, lý do được lưu và chủ xe đọc được", async () => {
      const { admin, owner, vehicle } = await setup();
      const res = await http()
        .post(`/api/admin/vehicles/${vehicle.id}/reject`)
        .set(admin.auth)
        .send({ reason: "  Ảnh bị mờ, chụp lại giúp mình  " });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "rejected", rejectReason: "Ảnh bị mờ, chụp lại giúp mình" });

      const seenByOwner = await http().get(`/api/owner/vehicles/${vehicle.id}`).set(owner.auth);
      expect(seenByOwner.body).toMatchObject({ status: "rejected", rejectReason: "Ảnh bị mờ, chụp lại giúp mình" });
      expect((await ctx.prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).reviewedById).toBe(
        admin.user.id,
      );
    });

    it.each([
      ["thiếu lý do", {}],
      ["lý do rỗng", { reason: "" }],
      ["lý do chỉ có khoảng trắng", { reason: "    " }],
      ["lý do dài quá 500 ký tự", { reason: "a".repeat(501) }],
      ["lý do không phải chuỗi", { reason: 123 }],
      ["trường lạ", { reason: "ok", status: "approved" }],
    ])("%s: 400 VALIDATION_ERROR", async (_name, body) => {
      const { admin, vehicle } = await setup();
      const res = await http().post(`/api/admin/vehicles/${vehicle.id}/reject`).set(admin.auth).send(body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect((await ctx.prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).status).toBe("pending");
    });

    it("gọi lặp lại trên xe đã bị từ chối: thành công và giữ lý do đầu tiên", async () => {
      const { admin, vehicle } = await setup();
      await http().post(`/api/admin/vehicles/${vehicle.id}/reject`).set(admin.auth).send({ reason: "Lý do một" });
      const again = await http().post(`/api/admin/vehicles/${vehicle.id}/reject`).set(admin.auth).send({ reason: "Lý do hai" });
      expect(again.status).toBe(200);
      expect(again.body.rejectReason).toBe("Lý do một");
    });

    it.each(["approved", "hidden"] as const)("xe %s không từ chối được: 409", async (status) => {
      const { admin, vehicle } = await setup(status);
      const res = await http().post(`/api/admin/vehicles/${vehicle.id}/reject`).set(admin.auth).send({ reason: "x" });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVALID_STATE");
    });
  });

  describe("tranh chấp và nộp lại", () => {
    it("hai admin duyệt và từ chối cùng lúc: chỉ một bên thắng, trạng thái cuối nhất quán", async () => {
      const { admin, vehicle } = await setup();
      const other = await makeUser(ctx, "admin");
      const [a, b] = await Promise.all([
        http().post(`/api/admin/vehicles/${vehicle.id}/approve`).set(admin.auth),
        http().post(`/api/admin/vehicles/${vehicle.id}/reject`).set(other.auth).send({ reason: "Không đạt" }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);

      const row = await ctx.prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
      expect(["approved", "rejected"]).toContain(row.status);
      // Không có trạng thái nửa vời: được duyệt thì không có lý do từ chối, bị từ chối thì có.
      if (row.status === "approved") expect(row.rejectReason).toBeNull();
      else expect(row.rejectReason).toBe("Không đạt");
    });

    it("xe bị từ chối, chủ xe sửa lại thì về chờ duyệt và lý do bị xóa; admin duyệt được", async () => {
      const { admin, owner, vehicle } = await setup();
      await http().post(`/api/admin/vehicles/${vehicle.id}/reject`).set(admin.auth).send({ reason: "Giá quá cao" });

      const edited = await http().patch(`/api/owner/vehicles/${vehicle.id}`).set(owner.auth).send({ pricePerDay: 500000 });
      expect(edited.body).toMatchObject({ status: "pending", rejectReason: null });

      const approved = await http().post(`/api/admin/vehicles/${vehicle.id}/approve`).set(admin.auth);
      expect(approved.status).toBe(200);
      expect(approved.body.status).toBe("approved");
    });

    it("xe bị từ chối vì thiếu ảnh: chủ xe tải ảnh lên thì tự về chờ duyệt, rồi duyệt được", async () => {
      const { admin, owner, vehicle } = await setup("pending", 0);
      await http().post(`/api/admin/vehicles/${vehicle.id}/reject`).set(admin.auth).send({ reason: "Thiếu ảnh" });

      const photo = await sharp({ create: { width: 200, height: 120, channels: 3, background: "#369" } }).jpeg().toBuffer();
      const upload = await http()
        .post(`/api/owner/vehicles/${vehicle.id}/images`)
        .set(owner.auth)
        .attach("file", photo, { filename: "xe.jpg", contentType: "image/jpeg" });
      expect(upload.status).toBe(201);

      const row = await ctx.prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
      expect(row).toMatchObject({ status: "pending", rejectReason: null, reviewedById: null, reviewedAt: null });

      expect((await http().post(`/api/admin/vehicles/${vehicle.id}/approve`).set(admin.auth)).status).toBe(200);
    });

    it("tải ảnh lên xe đã duyệt không làm xe mất trạng thái duyệt", async () => {
      const { owner, vehicle } = await setup("approved");
      const photo = await sharp({ create: { width: 200, height: 120, channels: 3, background: "#963" } }).jpeg().toBuffer();
      await http()
        .post(`/api/owner/vehicles/${vehicle.id}/images`)
        .set(owner.auth)
        .attach("file", photo, { filename: "xe.jpg", contentType: "image/jpeg" });
      expect((await ctx.prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).status).toBe("approved");
    });
  });
});
