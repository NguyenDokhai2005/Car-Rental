import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import sharp from "sharp";
import { MAX_IMAGES_PER_VEHICLE } from "../src/vehicles/image-processor";
import { createTestApp, makeUser, makeVehicle, resetDatabase, TestContext } from "./helpers";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "";

function jpeg(width = 800, height = 600): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 30, g: 90, b: 200 } } })
    .jpeg()
    .toBuffer();
}

function fileOf(url: string): string {
  return path.join(UPLOAD_DIR, url.replace("/uploads/", ""));
}

describe("Vehicle images API", () => {
  let ctx: TestContext;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
    await rm(UPLOAD_DIR, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  async function setup() {
    const owner = await makeUser(ctx, "owner");
    const vehicle = await makeVehicle(ctx, owner.user.id, { status: "pending" });
    const upload = (file: Buffer, filename = "xe.jpg", contentType = "image/jpeg", who = owner) =>
      http()
        .post(`/api/owner/vehicles/${vehicle.id}/images`)
        .set(who.auth)
        .attach("file", file, { filename, contentType });
    return { owner, vehicle, upload };
  }

  describe("POST /api/owner/vehicles/:id/images", () => {
    it("chủ xe tải ảnh: 201, lưu thành WebP trên đĩa, position tăng dần, tên file do hệ thống sinh", async () => {
      const { vehicle, upload } = await setup();

      const first = await upload(await jpeg(), "ten-nguoi-dung-dat.jpg");
      const second = await upload(await jpeg());

      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({ position: 0 });
      expect(second.body).toMatchObject({ position: 1 });
      expect(first.body.url).toMatch(new RegExp(`^/uploads/vehicles/${vehicle.id}/[0-9a-f-]{36}\\.webp$`));
      expect(first.body.url).not.toContain("ten-nguoi-dung-dat");

      expect(existsSync(fileOf(first.body.url))).toBe(true);
      expect((await sharp(fileOf(first.body.url)).metadata()).format).toBe("webp");
    });

    it("ảnh tải lên được API phục vụ lại ở /uploads (chế độ dev)", async () => {
      const { upload } = await setup();
      const res = await upload(await jpeg());
      const file = await http().get(res.body.url);
      expect(file.status).toBe(200);
      expect(file.headers["content-type"]).toContain("image/webp");
    });

    it("thu nhỏ ảnh lớn về tối đa 1600 px", async () => {
      const { upload } = await setup();
      const res = await upload(await jpeg(3200, 2400));
      const meta = await sharp(fileOf(res.body.url)).metadata();
      expect(meta.width).toBe(1600);
      expect(meta.height).toBe(1200);
    });

    it("file văn bản đổi đuôi .jpg và khai Content-Type image/jpeg bị từ chối 400, không lưu gì", async () => {
      const { vehicle, upload } = await setup();
      const res = await upload(Buffer.from("khong phai anh"), "fake.jpg", "image/jpeg");
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(await ctx.prisma.vehicleImage.count({ where: { vehicleId: vehicle.id } })).toBe(0);
    });

    it("ảnh GIF bị từ chối 400", async () => {
      const { upload } = await setup();
      const gif = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#fff" } }).gif().toBuffer();
      const res = await upload(gif, "a.gif", "image/gif");
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("file quá 5 MB bị từ chối 413 PAYLOAD_TOO_LARGE", async () => {
      const { upload } = await setup();
      const res = await upload(Buffer.alloc(5 * 1024 * 1024 + 1024, 1), "to.jpg");
      expect(res.status).toBe(413);
      expect(res.body.code).toBe("PAYLOAD_TOO_LARGE");
    });

    it("thiếu trường file trả 400", async () => {
      const { owner, vehicle } = await setup();
      const res = await http().post(`/api/owner/vehicles/${vehicle.id}/images`).set(owner.auth);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it(`ảnh thứ ${MAX_IMAGES_PER_VEHICLE + 1} bị từ chối 409 IMAGE_LIMIT`, async () => {
      const { vehicle, upload } = await setup();
      const image = await jpeg(100, 100);
      for (let i = 0; i < MAX_IMAGES_PER_VEHICLE; i += 1) {
        expect((await upload(image)).status).toBe(201);
      }
      const res = await upload(image);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("IMAGE_LIMIT");
      expect(await ctx.prisma.vehicleImage.count({ where: { vehicleId: vehicle.id } })).toBe(MAX_IMAGES_PER_VEHICLE);
    });

    it("tải đồng thời không vượt giới hạn và không trùng position", async () => {
      const { vehicle, upload } = await setup();
      const image = await jpeg(100, 100);
      const results = await Promise.all(Array.from({ length: MAX_IMAGES_PER_VEHICLE + 4 }, () => upload(image)));

      expect(results.filter((r) => r.status === 201)).toHaveLength(MAX_IMAGES_PER_VEHICLE);
      expect(results.filter((r) => r.status === 409)).toHaveLength(4);
      const rows = await ctx.prisma.vehicleImage.findMany({ where: { vehicleId: vehicle.id } });
      expect(new Set(rows.map((r) => r.position)).size).toBe(MAX_IMAGES_PER_VEHICLE);
    });

    it("chủ xe khác tải lên xe không phải của mình: 404, không lưu gì", async () => {
      const { vehicle, upload } = await setup();
      const other = await makeUser(ctx, "owner");
      const res = await upload(await jpeg(), "xe.jpg", "image/jpeg", other);
      expect(res.status).toBe(404);
      expect(await ctx.prisma.vehicleImage.count({ where: { vehicleId: vehicle.id } })).toBe(0);
    });

    it("khách thuê bị 403, chưa đăng nhập bị 401", async () => {
      const { vehicle } = await setup();
      const renter = await makeUser(ctx, "renter");
      const asRenter = await http()
        .post(`/api/owner/vehicles/${vehicle.id}/images`)
        .set(renter.auth)
        .attach("file", await jpeg(), { filename: "a.jpg", contentType: "image/jpeg" });
      expect(asRenter.status).toBe(403);

      const anonymous = await http()
        .post(`/api/owner/vehicles/${vehicle.id}/images`)
        .attach("file", await jpeg(), { filename: "a.jpg", contentType: "image/jpeg" });
      expect(anonymous.status).toBe(401);
    });
  });

  describe("GET /api/owner/vehicles/:id/images", () => {
    it("trả ảnh theo position tăng dần, chỉ gồm id, url, position", async () => {
      const { owner, vehicle, upload } = await setup();
      await upload(await jpeg());
      await upload(await jpeg());

      const res = await http().get(`/api/owner/vehicles/${vehicle.id}/images`).set(owner.auth);
      expect(res.status).toBe(200);
      expect(res.body.map((i: { position: number }) => i.position)).toEqual([0, 1]);
      expect(Object.keys(res.body[0]).sort()).toEqual(["id", "position", "url"]);
    });

    it("chủ xe khác không xem được: 404", async () => {
      const { vehicle } = await setup();
      const other = await makeUser(ctx, "owner");
      const res = await http().get(`/api/owner/vehicles/${vehicle.id}/images`).set(other.auth);
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/owner/vehicles/:id/images/:imageId", () => {
    it("xóa ảnh: 204, mất bản ghi và mất file trên đĩa", async () => {
      const { owner, vehicle, upload } = await setup();
      const created = await upload(await jpeg());
      expect(existsSync(fileOf(created.body.url))).toBe(true);

      const res = await http().delete(`/api/owner/vehicles/${vehicle.id}/images/${created.body.id}`).set(owner.auth);
      expect(res.status).toBe(204);
      expect(existsSync(fileOf(created.body.url))).toBe(false);
      expect(await ctx.prisma.vehicleImage.count({ where: { vehicleId: vehicle.id } })).toBe(0);
    });

    it("xóa ảnh rồi tải ảnh mới: dùng lại ô trống nhỏ nhất", async () => {
      const { owner, vehicle, upload } = await setup();
      const a = await upload(await jpeg());
      await upload(await jpeg());
      await http().delete(`/api/owner/vehicles/${vehicle.id}/images/${a.body.id}`).set(owner.auth);
      const c = await upload(await jpeg());
      expect(c.status).toBe(201);
      expect(c.body.position).toBe(0);
    });

    it("đủ 10 ảnh, xóa một ảnh ở giữa thì tải thêm được đúng một ảnh (không vượt position 9)", async () => {
      const { owner, vehicle, upload } = await setup();
      const image = await jpeg(100, 100);
      const created = [];
      for (let i = 0; i < MAX_IMAGES_PER_VEHICLE; i += 1) created.push(await upload(image));
      await http().delete(`/api/owner/vehicles/${vehicle.id}/images/${created[0].body.id}`).set(owner.auth);

      const again = await upload(image);
      expect(again.status).toBe(201);
      expect(again.body.position).toBe(0);
      expect((await upload(image)).status).toBe(409);
    });

    it("xóa ảnh không tồn tại: 404", async () => {
      const { owner, vehicle } = await setup();
      const res = await http()
        .delete(`/api/owner/vehicles/${vehicle.id}/images/00000000-0000-4000-8000-000000000000`)
        .set(owner.auth);
      expect(res.status).toBe(404);
    });

    it("chủ xe khác không xóa được ảnh của người khác: 404, ảnh vẫn còn", async () => {
      const { vehicle, upload } = await setup();
      const created = await upload(await jpeg());
      const other = await makeUser(ctx, "owner");

      const res = await http().delete(`/api/owner/vehicles/${vehicle.id}/images/${created.body.id}`).set(other.auth);
      expect(res.status).toBe(404);
      expect(await ctx.prisma.vehicleImage.count({ where: { vehicleId: vehicle.id } })).toBe(1);
    });

    it("không xóa nhầm ảnh của xe khác dù cùng chủ (imageId phải thuộc đúng xe trong URL)", async () => {
      const { owner, vehicle, upload } = await setup();
      const created = await upload(await jpeg());
      const otherVehicle = await makeVehicle(ctx, owner.user.id, { status: "pending" });

      const res = await http().delete(`/api/owner/vehicles/${otherVehicle.id}/images/${created.body.id}`).set(owner.auth);
      expect(res.status).toBe(404);
      expect(await ctx.prisma.vehicleImage.count({ where: { vehicleId: vehicle.id } })).toBe(1);
    });
  });
});
