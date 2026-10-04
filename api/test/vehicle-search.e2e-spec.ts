import request from "supertest";
import {
  createTestApp,
  DAY_MS,
  makeBooking,
  makeUser,
  makeVehicle,
  resetDatabase,
  TestContext,
} from "./helpers";

type Item = { id: string; title: string; pricePerDay: number; coverUrl: string | null };

describe("Public vehicle search API", () => {
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

  const ids = (body: { items: Item[] }) => body.items.map((i) => i.id);
  const iso = (ms: number) => new Date(ms).toISOString();
  const day = (n: number) => iso(Date.now() + n * DAY_MS);

  async function owner() {
    return makeUser(ctx, "owner");
  }

  describe("GET /api/vehicles", () => {
    it("công khai (không cần đăng nhập) và chỉ trả xe đã duyệt", async () => {
      const { user } = await owner();
      const approved = await makeVehicle(ctx, user.id, { status: "approved" });
      await makeVehicle(ctx, user.id, { status: "pending" });
      await makeVehicle(ctx, user.id, { status: "hidden" });
      await makeVehicle(ctx, user.id, { status: "rejected", rejectReason: "Lý do" });

      const res = await http().get("/api/vehicles");
      expect(res.status).toBe(200);
      expect(ids(res.body)).toEqual([approved.id]);
      expect(res.body).toMatchObject({ total: 1, page: 1, limit: 12 });
    });

    it("không lộ biển số, chủ xe, trạng thái hay thông tin duyệt", async () => {
      const { user } = await owner();
      const v = await makeVehicle(ctx, user.id, { status: "approved" });
      const res = await http().get("/api/vehicles");
      const item = res.body.items[0];
      expect(Object.keys(item).sort()).toEqual(
        [
          "brand", "city", "coverUrl", "depositRate", "district", "fuel", "id", "model",
          "pricePerDay", "seats", "title", "transmission", "year",
        ].sort(),
      );
      const text = JSON.stringify(res.body);
      expect(text).not.toContain(v.plateNumber);
      expect(text).not.toContain(user.id);
      expect(text).not.toMatch(/ownerId|plateNumber|status|rejectReason|reviewedBy|email|phone/);
    });

    it("coverUrl là ảnh có position nhỏ nhất, null khi xe chưa có ảnh", async () => {
      const { user } = await owner();
      const withImages = await makeVehicle(ctx, user.id, { status: "approved", pricePerDay: 500000 });
      const without = await makeVehicle(ctx, user.id, { status: "approved", pricePerDay: 600000 });
      await ctx.prisma.vehicleImage.create({ data: { vehicleId: withImages.id, storageKey: "vehicles/x/b.webp", position: 3 } });
      await ctx.prisma.vehicleImage.create({ data: { vehicleId: withImages.id, storageKey: "vehicles/x/a.webp", position: 1 } });

      const res = await http().get("/api/vehicles?sort=price_asc");
      const byId = Object.fromEntries(res.body.items.map((i: Item) => [i.id, i.coverUrl]));
      expect(byId[withImages.id]).toBe("/uploads/vehicles/x/a.webp");
      expect(byId[without.id]).toBeNull();
    });

    describe("bộ lọc", () => {
      async function seed() {
        const { user } = await owner();
        const make = (o: Parameters<typeof makeVehicle>[2]) => makeVehicle(ctx, user.id, { status: "approved", ...o });
        return {
          vios: await make({ title: "Vios", city: "TP. Hồ Chí Minh", pricePerDay: 650000, seats: 5, fuel: "petrol", transmission: "automatic" }),
          cx5: await make({ title: "CX-5", city: "TP. Hồ Chí Minh", pricePerDay: 1200000, seats: 5, fuel: "petrol", transmission: "automatic" }),
          xpander: await make({ title: "Xpander", city: "Hà Nội", pricePerDay: 950000, seats: 7, fuel: "petrol", transmission: "manual" }),
          vf5: await make({ title: "VF 5", city: "Đà Nẵng", pricePerDay: 780000, seats: 5, fuel: "electric", transmission: "automatic" }),
          everest: await make({ title: "Everest", city: "Hà Nội", pricePerDay: 1600000, seats: 7, fuel: "diesel", transmission: "automatic" }),
        };
      }
      const get = async (qs: string) => ids((await http().get(`/api/vehicles?${qs}&sort=price_asc`)).body);

      it("city: ký tự đại diện của LIKE (% _ \\) được hiểu đúng nghĩa đen, không khớp mọi xe", async () => {
        const s = await seed();
        const { user } = await owner();
        const odd = await makeVehicle(ctx, user.id, { status: "approved", city: "Khu 100%_A\\B", pricePerDay: 1 });
        expect(await get("city=%25")).toEqual([odd.id]); // "%" chỉ khớp xe có thật ký tự "%"
        expect(await get("city=_")).toEqual([odd.id]);
        expect(await get("city=100%25_A")).toEqual([odd.id]);
        expect(await get("city=A%5CB")).toEqual([odd.id]);
        expect(await get("city=%25%25")).toEqual([]);
        expect(await get("city=h_ n")).toEqual([]); // "_" không phải "một ký tự bất kỳ"
        expect(await get("city=Hà Nội")).toEqual([s.xpander.id, s.everest.id]);
      });

      it("city: chứa chuỗi, không phân biệt hoa thường", async () => {
        const s = await seed();
        expect(await get("city=hà nội")).toEqual([s.xpander.id, s.everest.id]);
        expect(await get("city=HỒ CHÍ")).toEqual([s.vios.id, s.cx5.id]);
        expect(await get("city=khong-co")).toEqual([]);
      });

      it("minPrice và maxPrice: gồm cả hai đầu mút", async () => {
        const s = await seed();
        expect(await get("minPrice=780000&maxPrice=1200000")).toEqual([s.vf5.id, s.xpander.id, s.cx5.id]);
        expect(await get("minPrice=1600000")).toEqual([s.everest.id]);
        expect(await get("maxPrice=650000")).toEqual([s.vios.id]);
      });

      it("seats, fuel, transmission: một hoặc nhiều giá trị", async () => {
        const s = await seed();
        expect(await get("seats=7")).toEqual([s.xpander.id, s.everest.id]);
        expect(await get("seats=5,7")).toHaveLength(5);
        expect(await get("fuel=electric")).toEqual([s.vf5.id]);
        expect(await get("fuel=petrol,diesel")).toEqual([s.vios.id, s.xpander.id, s.cx5.id, s.everest.id]);
        expect(await get("transmission=manual")).toEqual([s.xpander.id]);
      });

      it("tham số lặp (form HTML với ô tích chọn) hoạt động như danh sách phân cách bằng dấu phẩy", async () => {
        const s = await seed();
        expect(await get("seats=5&seats=7")).toHaveLength(5);
        expect(await get("fuel=electric&fuel=diesel")).toEqual([s.vf5.id, s.everest.id]);
        expect(await get("seats=7&seats=7,5")).toHaveLength(5);
      });

      it("kết hợp nhiều bộ lọc là điều kiện VÀ", async () => {
        const s = await seed();
        expect(await get("city=Hà Nội&seats=7&fuel=diesel")).toEqual([s.everest.id]);
        expect(await get("city=Hà Nội&seats=5")).toEqual([]);
      });
    });

    describe("sắp xếp và phân trang", () => {
      it("price_asc, price_desc và newest (mặc định); giá bằng nhau thì ổn định theo id", async () => {
        const { user } = await owner();
        const now = Date.now();
        const a = await makeVehicle(ctx, user.id, { status: "approved", pricePerDay: 500000, createdAt: new Date(now - 3000) });
        const b = await makeVehicle(ctx, user.id, { status: "approved", pricePerDay: 900000, createdAt: new Date(now - 2000) });
        const c = await makeVehicle(ctx, user.id, { status: "approved", pricePerDay: 700000, createdAt: new Date(now - 1000) });

        expect(ids((await http().get("/api/vehicles?sort=price_asc")).body)).toEqual([a.id, c.id, b.id]);
        expect(ids((await http().get("/api/vehicles?sort=price_desc")).body)).toEqual([b.id, c.id, a.id]);
        expect(ids((await http().get("/api/vehicles")).body)).toEqual([c.id, b.id, a.id]);

        const same = await Promise.all([1, 2, 3].map(() => makeVehicle(ctx, user.id, { status: "approved", pricePerDay: 1 + 800000 })));
        const sorted = same.map((v) => v.id).sort();
        const res = await http().get("/api/vehicles?minPrice=800001&maxPrice=800001&sort=price_asc");
        expect(ids(res.body)).toEqual(sorted);
      });

      it("phân trang: total là tổng số xe khớp, không phải số xe của trang", async () => {
        const { user } = await owner();
        for (let i = 0; i < 5; i += 1) await makeVehicle(ctx, user.id, { status: "approved", pricePerDay: 500000 + i });

        const p1 = await http().get("/api/vehicles?sort=price_asc&limit=2&page=1");
        const p3 = await http().get("/api/vehicles?sort=price_asc&limit=2&page=3");
        const p4 = await http().get("/api/vehicles?sort=price_asc&limit=2&page=4");
        expect(p1.body).toMatchObject({ total: 5, page: 1, limit: 2 });
        expect(p1.body.items).toHaveLength(2);
        expect(p3.body.items).toHaveLength(1);
        expect(p4.body.items).toHaveLength(0);
        expect(p4.body.total).toBe(5);
      });
    });

    describe("lọc theo khoảng ngày trống", () => {
      // Mốc cố định: nếu gọi Date.now() mỗi lần thì các mốc lệch nhau vài mili giây và phép thử "chạm đầu mút" sai.
      const BASE = Date.now() + 10 * DAY_MS;
      const from = () => BASE;

      async function setup() {
        const { user } = await owner();
        const renter = await makeUser(ctx, "renter");
        const vehicle = await makeVehicle(ctx, user.id, { status: "approved" });
        return { vehicle, renter };
      }
      const search = async (startMs: number, endMs: number) =>
        ids((await http().get(`/api/vehicles?startAt=${encodeURIComponent(iso(startMs))}&endAt=${encodeURIComponent(iso(endMs))}`)).body);

      it("xe không có đơn hay lịch chặn thì còn trống", async () => {
        const { vehicle } = await setup();
        expect(await search(from(), from() + 2 * DAY_MS)).toEqual([vehicle.id]);
      });

      it.each(["pending", "confirmed", "in_use"] as const)("đơn %s giao với khoảng tìm thì xe bị loại", async (status) => {
        const { vehicle, renter } = await setup();
        await makeBooking(ctx, vehicle.id, renter.user.id, new Date(from() + DAY_MS), new Date(from() + 3 * DAY_MS), status);
        expect(await search(from(), from() + 2 * DAY_MS)).toEqual([]);
      });

      it.each(["cancelled", "expired", "rejected", "completed"] as const)("đơn %s không giữ lịch nên xe vẫn còn trống", async (status) => {
        const { vehicle, renter } = await setup();
        await makeBooking(ctx, vehicle.id, renter.user.id, new Date(from() + DAY_MS), new Date(from() + 3 * DAY_MS), status);
        expect(await search(from(), from() + 2 * DAY_MS)).toEqual([vehicle.id]);
      });

      it("lịch chặn của chủ xe giao với khoảng tìm thì xe bị loại", async () => {
        const { vehicle } = await setup();
        await ctx.prisma.vehicleBlock.create({
          data: { vehicleId: vehicle.id, startAt: new Date(from()), endAt: new Date(from() + DAY_MS) },
        });
        expect(await search(from() - DAY_MS / 2, from() + DAY_MS / 2)).toEqual([]);
      });

      it("khoảng tìm chạm đúng đầu mút (kết thúc đúng lúc đơn bắt đầu) thì không tính là giao", async () => {
        const { vehicle, renter } = await setup();
        await makeBooking(ctx, vehicle.id, renter.user.id, new Date(from() + 2 * DAY_MS), new Date(from() + 4 * DAY_MS), "confirmed");
        expect(await search(from(), from() + 2 * DAY_MS)).toEqual([vehicle.id]); // tìm kết thúc đúng lúc đơn bắt đầu
        expect(await search(from() + 4 * DAY_MS, from() + 5 * DAY_MS)).toEqual([vehicle.id]); // tìm bắt đầu đúng lúc đơn kết thúc
        expect(await search(from() + 2 * DAY_MS - 1000, from() + 3 * DAY_MS)).toEqual([]); // lấn vào 1 giây thì bị loại
      });

      it("khoảng tìm bao trùm hoặc nằm trong đơn đều bị loại", async () => {
        const { vehicle, renter } = await setup();
        await makeBooking(ctx, vehicle.id, renter.user.id, new Date(from() + 2 * DAY_MS), new Date(from() + 4 * DAY_MS), "confirmed");
        expect(await search(from(), from() + 10 * DAY_MS)).toEqual([]);
        expect(await search(from() + 2.5 * DAY_MS, from() + 3 * DAY_MS)).toEqual([]);
      });

      it("đơn của xe này không làm loại xe khác", async () => {
        const { vehicle, renter } = await setup();
        const other = await makeVehicle(ctx, (await owner()).user.id, { status: "approved" });
        await makeBooking(ctx, vehicle.id, renter.user.id, new Date(from()), new Date(from() + 2 * DAY_MS), "confirmed");
        expect(await search(from(), from() + 2 * DAY_MS)).toEqual([other.id]);
      });
    });

    describe("kiểm tra tham số", () => {
      const bad = (qs: string) => http().get(`/api/vehicles?${qs}`);
      const enc = encodeURIComponent;

      it.each([
        ["minPrice lớn hơn maxPrice", "minPrice=900&maxPrice=100"],
        ["minPrice không phải số", "minPrice=abc"],
        ["minPrice âm", "minPrice=-5"],
        ["seats không phải số", "seats=abc"],
        ["seats ngoài khoảng", "seats=1"],
        ["fuel sai", "fuel=gas"],
        ["transmission sai", "transmission=cvt"],
        ["sort sai", "sort=cheapest"],
        ["limit quá lớn", "limit=999"],
        ["page bằng 0", "page=0"],
        ["tham số lạ", "ownerId=abc"],
      ])("%s: 400 VALIDATION_ERROR", async (_name, qs) => {
        const res = await bad(qs);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("VALIDATION_ERROR");
      });

      it.each([
        ["chỉ có startAt", () => `startAt=${enc(day(5))}`],
        ["chỉ có endAt", () => `endAt=${enc(day(5))}`],
        ["endAt không sau startAt", () => `startAt=${enc(day(5))}&endAt=${enc(day(5))}`],
        ["endAt trước startAt", () => `startAt=${enc(day(6))}&endAt=${enc(day(5))}`],
        ["khoảng đã qua", () => `startAt=${enc(day(-5))}&endAt=${enc(day(-3))}`],
        ["khoảng dài hơn 366 ngày", () => `startAt=${enc(day(1))}&endAt=${enc(day(400))}`],
        ["ngày không có giờ và múi giờ", () => `startAt=2030-01-01&endAt=2030-01-03`],
      ])("%s: 400 VALIDATION_ERROR", async (_name, qs) => {
        const res = await bad(qs());
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("VALIDATION_ERROR");
      });

      it("giá trị rỗng hoặc thừa dấu phẩy được bỏ qua, không gây lỗi", async () => {
        const { user } = await owner();
        await makeVehicle(ctx, user.id, { status: "approved", seats: 5 });
        expect((await bad("seats=5,")).body.total).toBe(1);
        expect((await bad("seats=,5,,")).body.total).toBe(1);
      });

      it("chuỗi tìm có ký tự đặc biệt của SQL không gây lỗi và không lộ dữ liệu", async () => {
        const { user } = await owner();
        await makeVehicle(ctx, user.id, { status: "approved" });
        const res = await bad(`city=${enc("'; DROP TABLE vehicles; --")}`);
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(0);
        expect(await ctx.prisma.vehicle.count()).toBe(1);

        const percent = await bad(`city=${enc("%")}`);
        expect(percent.status).toBe(200);
      });
    });
  });

  describe("GET /api/vehicles/:id", () => {
    it("trả chi tiết xe đã duyệt: toàn bộ ảnh theo thứ tự, tên chủ xe, không lộ liên hệ hay biển số", async () => {
      const { user } = await owner();
      const v = await makeVehicle(ctx, user.id, { status: "approved", description: "Xe sạch" });
      await ctx.prisma.vehicleImage.create({ data: { vehicleId: v.id, storageKey: "vehicles/d/2.webp", position: 2 } });
      await ctx.prisma.vehicleImage.create({ data: { vehicleId: v.id, storageKey: "vehicles/d/0.webp", position: 0 } });

      const res = await http().get(`/api/vehicles/${v.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: v.id,
        title: v.title,
        description: "Xe sạch",
        coverUrl: "/uploads/vehicles/d/0.webp",
        owner: { fullName: user.fullName },
      });
      expect(res.body.images.map((i: { position: number }) => i.position)).toEqual([0, 2]);
      expect(Object.keys(res.body.owner)).toEqual(["fullName"]);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain(v.plateNumber);
      expect(text).not.toContain(user.email);
      expect(text).not.toContain(user.phone);
      expect(text).not.toMatch(/storageKey|ownerId|rejectReason|reviewedBy/);
    });

    it.each(["pending", "hidden", "rejected"] as const)("xe %s: 404, không lộ sự tồn tại", async (status) => {
      const { user } = await owner();
      const v = await makeVehicle(ctx, user.id, { status, ...(status === "rejected" ? { rejectReason: "x" } : {}) });
      expect((await http().get(`/api/vehicles/${v.id}`)).status).toBe(404);
    });

    it("id không tồn tại hoặc sai định dạng: 404", async () => {
      expect((await http().get("/api/vehicles/00000000-0000-4000-8000-000000000000")).status).toBe(404);
      expect((await http().get("/api/vehicles/khong-phai-uuid")).status).toBe(404);
    });

    it("endpoint lịch trống cũ vẫn hoạt động (không bị route :id nuốt mất)", async () => {
      const { user } = await owner();
      const v = await makeVehicle(ctx, user.id, { status: "approved" });
      const res = await http().get(`/api/vehicles/${v.id}/availability`);
      expect(res.status).toBe(200);
      expect(res.body.vehicleId).toBe(v.id);
    });
  });
});
