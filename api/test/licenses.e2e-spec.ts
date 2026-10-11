import { existsSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import sharp from "sharp";
import { createTestApp, DAY_MS, makeUser, makeVehicle, resetDatabase, TestContext } from "./helpers";

const PRIVATE_DIR = process.env.PRIVATE_UPLOAD_DIR as string;
const PUBLIC_DIR = process.env.UPLOAD_DIR as string;

function photo(color = "#1e5ac8"): Promise<Buffer> {
  return sharp({ create: { width: 800, height: 500, channels: 3, background: color } }).jpeg().toBuffer();
}

describe("Licence verification API", () => {
  let ctx: TestContext;
  let front: Buffer;
  let back: Buffer;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
    front = await photo();
    back = await photo("#c81e1e");
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    // Bảng log truy cập chỉ cho thêm dòng (trigger), nên phải TRUNCATE; resetDatabase lo việc đó cùng các bảng khác.
    await resetDatabase(ctx.prisma);
    await rm(PRIVATE_DIR, { recursive: true, force: true });
  });

  const FIELDS = { licenseNumber: "790123456789", licenseClass: "B2", licenseExpiresOn: "2032-10-15" };

  type SubmitOptions = { fields?: Record<string, string>; front?: Buffer | null; back?: Buffer };

  function submit(auth: { Authorization: string }, options: SubmitOptions = {}) {
    let req = http().post("/api/me/license").set(auth);
    for (const [name, value] of Object.entries({ ...FIELDS, ...options.fields })) req = req.field(name, value);
    if (options.front !== null) req = req.attach("front", options.front ?? front, "front.jpg");
    if (options.back) req = req.attach("back", options.back, "back.jpg");
    return req;
  }

  const userRow = (id: string) => ctx.prisma.user.findUniqueOrThrow({ where: { id } });

  async function storedFiles(userId: string): Promise<string[]> {
    const dir = path.join(PRIVATE_DIR, "licenses", userId);
    return existsSync(dir) ? readdir(dir) : [];
  }

  async function pendingRenter() {
    const renter = await makeUser(ctx, "renter");
    const res = await submit(renter.auth, { back });
    expect(res.status).toBe(200);
    return { renter, version: res.body.version as string };
  }

  describe("quyền truy cập", () => {
    it("chưa đăng nhập: 401 ở mọi endpoint", async () => {
      const renter = await makeUser(ctx, "renter");
      for (const url of ["/api/me/license", "/api/me/license/front", `/api/admin/users/${renter.user.id}/license`]) {
        expect((await http().get(url)).status).toBe(401);
      }
      expect((await http().post("/api/me/license")).status).toBe(401);
      expect((await http().post(`/api/admin/users/${renter.user.id}/license/verify`)).status).toBe(401);
    });

    it("chủ xe và admin không gửi được hồ sơ GPLX: 403", async () => {
      for (const role of ["owner", "admin"] as const) {
        const who = await makeUser(ctx, role);
        expect((await http().get("/api/me/license").set(who.auth)).status).toBe(403);
        expect((await submit(who.auth)).status).toBe(403);
        expect(await storedFiles(who.user.id)).toEqual([]);
      }
    });

    it("khách thuê và chủ xe không xem, không duyệt được hồ sơ của người khác: 403", async () => {
      const { renter, version } = await pendingRenter();
      const other = await makeUser(ctx, "renter");
      const owner = await makeUser(ctx, "owner");
      const base = `/api/admin/users/${renter.user.id}/license`;
      for (const who of [other, owner]) {
        expect((await http().get(base).set(who.auth)).status).toBe(403);
        expect((await http().get(`${base}/front`).set(who.auth)).status).toBe(403);
        expect((await http().post(`${base}/verify`).set(who.auth).send({ version })).status).toBe(403);
        expect((await http().post(`${base}/reject`).set(who.auth).send({ reason: "x" })).status).toBe(403);
      }
      expect((await userRow(renter.user.id)).licenseStatus).toBe("pending");
      expect(await ctx.prisma.licenseAccessLog.count()).toBe(0);
    });
  });

  describe("GET /me/license", () => {
    it("chưa gửi: trạng thái none, các trường rỗng", async () => {
      const renter = await makeUser(ctx, "renter");
      const res = await http().get("/api/me/license").set(renter.auth);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: "none",
        licenseNumber: null,
        licenseClass: null,
        licenseExpiresOn: null,
        rejectReason: null,
        reviewedAt: null,
        hasBack: false,
        version: null,
      });
    });
  });

  describe("POST /me/license", () => {
    it("gửi hồ sơ: trạng thái pending, ảnh được vẽ lại thành WebP trong kho riêng", async () => {
      const renter = await makeUser(ctx, "renter");
      const res = await submit(renter.auth);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: "pending",
        licenseNumber: "790123456789",
        licenseClass: "B2",
        licenseExpiresOn: "2032-10-15",
        hasBack: false,
        rejectReason: null,
      });
      expect(res.body.version).toMatch(/^[0-9a-f]{32}$/);

      const files = await storedFiles(renter.user.id);
      expect(files).toHaveLength(1);
      const meta = await sharp(path.join(PRIVATE_DIR, "licenses", renter.user.id, files[0])).metadata();
      expect(meta.format).toBe("webp");
    });

    it("chuẩn hóa số GPLX có khoảng trắng và hạng viết thường", async () => {
      const renter = await makeUser(ctx, "renter");
      const res = await submit(renter.auth, { fields: { licenseNumber: "7901 2345 6789", licenseClass: "b2" } });
      expect(res.body).toMatchObject({ licenseNumber: "790123456789", licenseClass: "B2" });
    });

    it("không bao giờ trả đường dẫn file ra ngoài, và file không nằm trong thư mục công khai", async () => {
      const renter = await makeUser(ctx, "renter");
      const res = await submit(renter.auth, { back });
      const mine = await http().get("/api/me/license").set(renter.auth);

      const row = await userRow(renter.user.id);
      for (const body of [res.body, mine.body]) {
        expect(JSON.stringify(body)).not.toMatch(/licenses\/|\.webp|FrontKey|BackKey/);
      }
      expect(existsSync(path.join(PUBLIC_DIR, row.licenseFrontKey as string))).toBe(false);
      expect((await http().get(`/uploads/${row.licenseFrontKey}`)).status).toBe(404);
      expect((await http().get(`/uploads/${row.licenseFrontKey}`).set(renter.auth)).status).toBe(404);
    });

    it("từ chối hồ sơ thiếu ảnh mặt trước hoặc sai dữ liệu, và không để lại file nào", async () => {
      const renter = await makeUser(ctx, "renter");
      const gif = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#fff" } }).gif().toBuffer();
      const cases: SubmitOptions[] = [
        { front: null },
        { fields: { licenseNumber: "12345" } },
        { fields: { licenseNumber: "79012345678a" } },
        { fields: { licenseClass: "A1" } },
        { fields: { licenseExpiresOn: "2020-01-01" } },
        { fields: { licenseExpiresOn: "2030-02-31" } },
        { fields: { licenseExpiresOn: "15/10/2032" } },
        { front: gif },
        { front: Buffer.from("khong phai anh") },
        { back: Buffer.from("khong phai anh") },
      ];
      for (const options of cases) {
        const res = await submit(renter.auth, options);
        expect({ options: Object.keys(options), status: res.status }).toEqual({ options: Object.keys(options), status: 400 });
        expect(res.body.code).toBe("VALIDATION_ERROR");
      }
      expect((await userRow(renter.user.id)).licenseStatus).toBe("none");
      expect(await storedFiles(renter.user.id)).toEqual([]);
    });

    it("ảnh quá 5 MB bị từ chối", async () => {
      const renter = await makeUser(ctx, "renter");
      const res = await submit(renter.auth, { front: Buffer.alloc(5 * 1024 * 1024 + 1) });
      expect(res.status).toBe(413);
      expect(await storedFiles(renter.user.id)).toEqual([]);
    });

    it("gửi lại thay toàn bộ hồ sơ cũ: xóa file cũ, đổi version, xóa kết quả duyệt trước", async () => {
      const admin = await makeUser(ctx, "admin");
      const { renter, version } = await pendingRenter();
      await http().post(`/api/admin/users/${renter.user.id}/license/reject`).set(admin.auth).send({ reason: "Ảnh mờ" });
      const before = await storedFiles(renter.user.id);

      const res = await submit(renter.auth, { fields: { licenseClass: "C" } });

      expect(res.body).toMatchObject({ status: "pending", licenseClass: "C", rejectReason: null, reviewedAt: null, hasBack: false });
      expect(res.body.version).not.toBe(version);
      const after = await storedFiles(renter.user.id);
      expect(after).toHaveLength(1);
      expect(before).not.toContain(after[0]);
      expect((await userRow(renter.user.id)).licenseReviewedById).toBeNull();
    });

    it("đã được xác minh thì không gửi lại được: 409, hồ sơ và file giữ nguyên", async () => {
      const admin = await makeUser(ctx, "admin");
      const { renter, version } = await pendingRenter();
      await http().post(`/api/admin/users/${renter.user.id}/license/verify`).set(admin.auth).send({ version });
      const before = await storedFiles(renter.user.id);

      const res = await submit(renter.auth, { fields: { licenseClass: "C" } });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVALID_STATE");
      expect((await userRow(renter.user.id)).licenseClass).toBe("B2");
      expect((await storedFiles(renter.user.id)).sort()).toEqual(before.sort());
    });
  });

  describe("xem ảnh và log truy cập", () => {
    it("chính chủ xem được ảnh của mình, không cho lưu cache, có ghi log", async () => {
      const { renter } = await pendingRenter();

      const res = await http().get("/api/me/license/front").set(renter.auth).buffer(true).parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("image/webp");
      expect(res.headers["cache-control"]).toBe("private, no-store");
      expect((await sharp(res.body as Buffer).metadata()).format).toBe("webp");

      const logs = await ctx.prisma.licenseAccessLog.findMany();
      const row = await userRow(renter.user.id);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({ actorId: renter.user.id, targetUserId: renter.user.id, fileKey: row.licenseFrontKey });
    });

    it("admin xem ảnh của khách: log ghi đúng người xem và file đã xem", async () => {
      const admin = await makeUser(ctx, "admin");
      const { renter } = await pendingRenter();
      const base = `/api/admin/users/${renter.user.id}/license`;

      expect((await http().get(`${base}/front`).set(admin.auth)).status).toBe(200);
      expect((await http().get(`${base}/back`).set(admin.auth)).status).toBe(200);

      const row = await userRow(renter.user.id);
      const logs = await ctx.prisma.licenseAccessLog.findMany({ orderBy: { id: "asc" } });
      expect(logs.map((l) => [l.actorId, l.targetUserId, l.fileKey])).toEqual([
        [admin.user.id, renter.user.id, row.licenseFrontKey],
        [admin.user.id, renter.user.id, row.licenseBackKey],
      ]);
    });

    it("không có ảnh hoặc sai tên mặt: 404 và không ghi log", async () => {
      const admin = await makeUser(ctx, "admin");
      const renter = await makeUser(ctx, "renter");
      await submit(renter.auth);

      expect((await http().get("/api/me/license/back").set(renter.auth)).status).toBe(404);
      expect((await http().get("/api/me/license/side").set(renter.auth)).status).toBe(404);
      expect((await http().get(`/api/admin/users/${renter.user.id}/license/back`).set(admin.auth)).status).toBe(404);
      const nobody = await makeUser(ctx, "renter");
      expect((await http().get("/api/me/license/front").set(nobody.auth)).status).toBe(404);
      expect(await ctx.prisma.licenseAccessLog.count()).toBe(0);
    });
  });

  describe("admin duyệt và từ chối", () => {
    it("xem hồ sơ kèm thông tin người gửi", async () => {
      const admin = await makeUser(ctx, "admin");
      const { renter, version } = await pendingRenter();

      const res = await http().get(`/api/admin/users/${renter.user.id}/license`).set(admin.auth);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: "pending",
        licenseNumber: "790123456789",
        hasBack: true,
        version,
        user: { id: renter.user.id, fullName: renter.user.fullName, email: renter.user.email, phone: renter.user.phone },
      });
      expect(JSON.stringify(res.body)).not.toMatch(/licenses\/|passwordHash/);
    });

    it("duyệt: ghi người duyệt, và khách đặt được xe", async () => {
      const admin = await makeUser(ctx, "admin");
      const owner = await makeUser(ctx, "owner");
      const vehicle = await makeVehicle(ctx, owner.user.id, { status: "approved" });
      const { renter, version } = await pendingRenter();
      const start = new Date(Date.now() + 3 * DAY_MS);
      const booking = { vehicleId: vehicle.id, startAt: start.toISOString(), endAt: new Date(start.getTime() + DAY_MS).toISOString() };

      const blocked = await http().post("/api/bookings").set(renter.auth).send(booking);
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe("LICENSE_NOT_VERIFIED");

      const res = await http().post(`/api/admin/users/${renter.user.id}/license/verify`).set(admin.auth).send({ version });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("verified");
      expect(res.body.reviewedAt).not.toBeNull();
      expect((await userRow(renter.user.id)).licenseReviewedById).toBe(admin.user.id);

      expect((await http().post("/api/bookings").set(renter.auth).send(booking)).status).toBe(201);
    });

    it("duyệt lặp lại vẫn thành công và không đổi người duyệt đầu tiên", async () => {
      const admin = await makeUser(ctx, "admin");
      const second = await makeUser(ctx, "admin");
      const { renter, version } = await pendingRenter();
      const url = `/api/admin/users/${renter.user.id}/license/verify`;

      expect((await http().post(url).set(admin.auth).send({ version })).status).toBe(200);
      expect((await http().post(url).set(second.auth).send({ version })).status).toBe(200);
      expect((await userRow(renter.user.id)).licenseReviewedById).toBe(admin.user.id);
    });

    it("khách vừa gửi lại hồ sơ: version cũ không duyệt được ảnh mới", async () => {
      const admin = await makeUser(ctx, "admin");
      const { renter, version } = await pendingRenter();
      await submit(renter.auth, { front: back });

      const res = await http().post(`/api/admin/users/${renter.user.id}/license/verify`).set(admin.auth).send({ version });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVALID_STATE");
      expect((await userRow(renter.user.id)).licenseStatus).toBe("pending");
    });

    it("duyệt và gửi lại cùng lúc: không bao giờ có hồ sơ 'đã xác minh' trỏ vào ảnh admin chưa xem", async () => {
      const admin = await makeUser(ctx, "admin");
      for (let round = 0; round < 5; round += 1) {
        const { renter, version } = await pendingRenter();
        const seen = (await userRow(renter.user.id)).licenseFrontKey;

        const [verify, resubmit] = await Promise.all([
          http().post(`/api/admin/users/${renter.user.id}/license/verify`).set(admin.auth).send({ version }),
          submit(renter.auth, { front: back }),
        ]);

        const row = await userRow(renter.user.id);
        if (row.licenseStatus === "verified") {
          expect(row.licenseFrontKey).toBe(seen);
          expect([verify.status, resubmit.status]).toEqual([200, 409]);
        } else {
          expect(row.licenseStatus).toBe("pending");
          expect(row.licenseFrontKey).not.toBe(seen);
          expect([verify.status, resubmit.status]).toEqual([409, 200]);
        }
        // Dù bên nào thắng, kho chỉ còn đúng các file mà hồ sơ đang trỏ tới.
        const expected = [row.licenseFrontKey, row.licenseBackKey].filter(Boolean).map((key) => path.basename(key as string));
        expect((await storedFiles(renter.user.id)).sort()).toEqual(expected.sort());
      }
    });

    it("thiếu hoặc sai dạng version: 400; hồ sơ chưa gửi hoặc đã bị từ chối: 409", async () => {
      const admin = await makeUser(ctx, "admin");
      const { renter, version } = await pendingRenter();
      const url = (id: string) => `/api/admin/users/${id}/license/verify`;

      for (const body of [{}, { version: "abc" }, { version: 123 }]) {
        expect((await http().post(url(renter.user.id)).set(admin.auth).send(body)).status).toBe(400);
      }

      const fresh = await makeUser(ctx, "renter");
      expect((await http().post(url(fresh.user.id)).set(admin.auth).send({ version })).status).toBe(409);

      await http().post(`/api/admin/users/${renter.user.id}/license/reject`).set(admin.auth).send({ reason: "Ảnh mờ" });
      expect((await http().post(url(renter.user.id)).set(admin.auth).send({ version })).status).toBe(409);
      expect((await userRow(renter.user.id)).licenseStatus).toBe("rejected");
    });

    it("từ chối: bắt buộc có lý do, khách đọc được lý do", async () => {
      const admin = await makeUser(ctx, "admin");
      const { renter } = await pendingRenter();
      const url = `/api/admin/users/${renter.user.id}/license/reject`;

      for (const body of [{}, { reason: "   " }, { reason: "x".repeat(501) }]) {
        expect((await http().post(url).set(admin.auth).send(body)).status).toBe(400);
      }
      expect((await userRow(renter.user.id)).licenseStatus).toBe("pending");

      const res = await http().post(url).set(admin.auth).send({ reason: "  Ảnh mờ, không đọc được số  " });
      expect(res.body).toMatchObject({ status: "rejected", rejectReason: "Ảnh mờ, không đọc được số" });
      expect((await http().get("/api/me/license").set(renter.auth)).body).toMatchObject({
        status: "rejected",
        rejectReason: "Ảnh mờ, không đọc được số",
      });
    });

    it("từ chối lặp lại giữ lý do đầu tiên; hồ sơ đã xác minh không từ chối được", async () => {
      const admin = await makeUser(ctx, "admin");
      const first = await pendingRenter();
      const rejectUrl = `/api/admin/users/${first.renter.user.id}/license/reject`;
      await http().post(rejectUrl).set(admin.auth).send({ reason: "Lý do 1" });
      const again = await http().post(rejectUrl).set(admin.auth).send({ reason: "Lý do 2" });
      expect(again.status).toBe(200);
      expect(again.body.rejectReason).toBe("Lý do 1");

      const second = await pendingRenter();
      const base = `/api/admin/users/${second.renter.user.id}/license`;
      await http().post(`${base}/verify`).set(admin.auth).send({ version: second.version });
      const res = await http().post(`${base}/reject`).set(admin.auth).send({ reason: "Muộn rồi" });
      expect(res.status).toBe(409);
      expect((await userRow(second.renter.user.id)).licenseStatus).toBe("verified");
    });

    it("người dùng không tồn tại hoặc id sai định dạng: 404", async () => {
      const admin = await makeUser(ctx, "admin");
      for (const id of ["00000000-0000-4000-8000-000000000000", "khong-phai-uuid"]) {
        expect((await http().get(`/api/admin/users/${id}/license`).set(admin.auth)).status).toBe(404);
        expect((await http().get(`/api/admin/users/${id}/license/front`).set(admin.auth)).status).toBe(404);
        expect((await http().post(`/api/admin/users/${id}/license/reject`).set(admin.auth).send({ reason: "x" })).status).toBe(404);
      }
    });
  });
});
