import request from "supertest";
import { MASK } from "../src/dev/database-browser.service";
import { createTestApp, DAY_MS, makeBooking, makeUser, makeVehicle, resetDatabase, TestContext } from "./helpers";

type Column = { name: string; type: string; nullable: boolean; masked: boolean };
type Row = Record<string, string | null>;

describe("Dev: xem dữ liệu CSDL (chỉ đọc)", () => {
  let ctx: TestContext;
  let dev: Awaited<ReturnType<typeof makeUser>>;
  const http = () => request(ctx.app.getHttpServer());
  const rows = (table: string, query = "") => http().get(`/api/dev/database/tables/${table}/rows${query}`).set(dev.auth);

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    dev = await makeUser(ctx, "dev");
  });

  it("chỉ vai trò dev: chưa đăng nhập 401; renter, owner, admin 403", async () => {
    const paths = ["/api/dev/database/tables", "/api/dev/database/tables/users/rows"];
    for (const path of paths) expect((await http().get(path)).status).toBe(401);
    for (const role of ["renter", "owner", "admin"] as const) {
      const user = await makeUser(ctx, role);
      for (const path of paths) expect([role, path, (await http().get(path).set(user.auth)).status]).toEqual([role, path, 403]);
    }
  });

  it("liệt kê bảng kèm cột, đánh dấu đúng các cột bí mật", async () => {
    const res = await http().get("/api/dev/database/tables").set(dev.auth);
    expect(res.status).toBe(200);
    const tables = res.body.items as { name: string; columns: Column[] }[];
    expect(tables.map((table) => table.name)).toEqual(expect.arrayContaining(["users", "vehicles", "bookings", "payments", "refresh_tokens"]));

    const masked = (table: string) =>
      (tables.find((t) => t.name === table)?.columns ?? []).filter((column) => column.masked).map((column) => column.name).sort();
    expect(masked("users")).toEqual(["license_back_key", "license_front_key", "license_number", "password_hash"]);
    expect(masked("refresh_tokens")).toEqual(["token_hash"]);
    expect(masked("license_access_logs")).toEqual(["file_key"]);
    expect(masked("payments")).toEqual(["raw_payload"]);
    expect(masked("vehicles")).toEqual([]);

    const role = tables.find((t) => t.name === "users")?.columns.find((column) => column.name === "role");
    expect(role).toMatchObject({ type: "user_role", nullable: false, masked: false });
  });

  it("giá trị bí mật không rời máy chủ, dữ liệu thường thì đọc được", async () => {
    const renter = await ctx.prisma.user.create({
      data: {
        email: "co-gplx@test.vn",
        passwordHash: "$argon2id$bam-bi-mat",
        fullName: "Khách Có GPLX",
        phone: "0901234567",
        role: "renter",
        licenseStatus: "pending",
        licenseNumber: "079123456789",
        licenseFrontKey: "licenses/mat-truoc-bi-mat.webp",
        licenseBackKey: "licenses/mat-sau-bi-mat.webp",
      },
    });
    await ctx.prisma.refreshToken.create({ data: { userId: renter.id, tokenHash: "bam-token-bi-mat", expiresAt: new Date(Date.now() + DAY_MS) } });

    const users = await rows("users", "?filterColumn=email&filterValue=co-gplx@test.vn");
    expect(users.status).toBe(200);
    expect(users.body.total).toBe(1);
    expect(users.body.items[0]).toMatchObject({
      id: renter.id,
      email: "co-gplx@test.vn",
      full_name: "Khách Có GPLX",
      role: "renter",
      password_hash: MASK,
      license_number: MASK,
      license_front_key: MASK,
      license_back_key: MASK,
    });

    const tokens = await rows("refresh_tokens");
    expect(tokens.body.items[0].token_hash).toBe(MASK);

    const everything = JSON.stringify([users.body, tokens.body, (await rows("users")).body]);
    for (const secret of ["bam-bi-mat", "079123456789", "mat-truoc-bi-mat", "mat-sau-bi-mat", "bam-token-bi-mat", "khong-dung-de-dang-nhap"]) {
      expect(everything).not.toContain(secret);
    }
  });

  it("cột bí mật đang trống vẫn là null, không giả vờ có giá trị", async () => {
    const res = await rows("users", `?filterColumn=id&filterValue=${dev.user.id}`);
    expect(res.body.items[0]).toMatchObject({ license_number: null, license_front_key: null, password_hash: MASK });
  });

  it("không lọc hay sắp xếp được theo cột bí mật", async () => {
    for (const query of ["?filterColumn=password_hash&filterValue=x", "?sort=password_hash", "?filterColumn=license_number&filterValue=079123456789", "?sort=license_number"]) {
      const res = await rows("users", query);
      expect([query, res.status, res.body.code]).toEqual([query, 400, "VALIDATION_ERROR"]);
    }
  });

  it("phân trang, sắp xếp và lọc", async () => {
    const owner = await makeUser(ctx, "owner");
    const renter = await makeUser(ctx, "renter");
    for (const price of [300000, 900000, 500000]) await makeVehicle(ctx, owner.user.id, { pricePerDay: price });
    const [first] = await ctx.prisma.vehicle.findMany({ where: { pricePerDay: 900000 } });
    await makeBooking(ctx, first.id, renter.user.id, new Date(Date.now() + DAY_MS), new Date(Date.now() + 2 * DAY_MS), "pending");

    const sorted = await rows("vehicles", "?sort=price_per_day&order=desc&limit=2");
    expect(sorted.body).toMatchObject({ total: 3, page: 1, limit: 2 });
    expect((sorted.body.items as Row[]).map((row) => row.price_per_day)).toEqual(["900000", "500000"]);

    const second = await rows("vehicles", "?sort=price_per_day&order=desc&limit=2&page=2");
    expect((second.body.items as Row[]).map((row) => row.price_per_day)).toEqual(["300000"]);

    const filtered = await rows("bookings", `?filterColumn=vehicle_id&filterValue=${first.id}`);
    expect(filtered.body.total).toBe(1);
    expect(filtered.body.items[0]).toMatchObject({ status: "pending", renter_id: renter.user.id });

    expect((await rows("bookings", "?filterColumn=status&filterValue=completed")).body).toMatchObject({ total: 0, items: [] });
  });

  it("giá trị dài bị cắt còn 300 ký tự", async () => {
    const owner = await makeUser(ctx, "owner");
    await makeVehicle(ctx, owner.user.id, { description: "x".repeat(1000) });
    const res = await rows("vehicles");
    expect(res.body.items[0].description).toHaveLength(300);
  });

  it("tên bảng, tên cột và tham số sai bị từ chối, không chạy thành SQL", async () => {
    const before = await ctx.prisma.user.count();
    const notFound = ["khong_co_bang", "pg_shadow", "users%3B%20DROP%20TABLE%20users", "users%22--", "information_schema.tables"];
    for (const table of notFound) {
      const res = await rows(table);
      expect([table, res.status]).toEqual([table, 404]);
    }
    expect((await rows("users", "?sort=khong_co_cot")).status).toBe(404);
    expect((await rows("users", "?filterColumn=khong_co_cot&filterValue=x")).status).toBe(404);

    const invalid = [
      "?sort=id;drop table users",
      "?sort=id%20desc",
      "?order=xuong",
      "?limit=101",
      "?page=0",
      "?filterColumn=email",
      `?filterColumn=email&filterValue=${"a".repeat(201)}`,
    ];
    for (const query of invalid) {
      const res = await rows("users", query);
      expect([query, res.status]).toEqual([query, 400]);
    }

    // Giá trị lọc đi qua tham số của truy vấn, nên dấu nháy và lệnh SQL chỉ là chữ để so sánh.
    const injection = await rows("users", `?filterColumn=email&filterValue=${encodeURIComponent("x' OR '1'='1")}`);
    expect(injection.body).toMatchObject({ total: 0, items: [] });
    expect(await ctx.prisma.user.count()).toBe(before);
  });

  it("không có đường nào để ghi: chỉ có GET", async () => {
    for (const method of ["post", "patch", "delete", "put"] as const) {
      const res = await http()[method]("/api/dev/database/tables/users/rows").set(dev.auth).send({});
      expect([method, res.status]).toEqual([method, 404]);
    }
  });
});
