import sharp from "sharp";
import { ApiError } from "../common/api-error";
import { processVehicleImage } from "./image-processor";

// Ảnh giả dựng bằng sharp, không cần file thật.
function solid(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 60, b: 60 } } });
}

async function expectInvalid(input: Buffer): Promise<void> {
  const error = await processVehicleImage(input).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).getStatus()).toBe(400);
  expect((error as ApiError).getResponse()).toMatchObject({ code: "VALIDATION_ERROR" });
}

describe("processVehicleImage", () => {
  it.each([
    ["jpeg", () => solid(800, 600).jpeg().toBuffer()],
    ["png", () => solid(800, 600).png().toBuffer()],
    ["webp", () => solid(800, 600).webp().toBuffer()],
  ])("nhận ảnh %s và luôn trả về WebP", async (_name, make) => {
    const out = await processVehicleImage(await make());
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(600);
  });

  it("thu nhỏ ảnh lớn về cạnh dài tối đa 1600 px, giữ tỷ lệ", async () => {
    const out = await processVehicleImage(await solid(3200, 2000).jpeg().toBuffer());
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(1600);
    expect(meta.height).toBe(1000);
  });

  it("không phóng to ảnh nhỏ", async () => {
    const out = await processVehicleImage(await solid(300, 200).png().toBuffer());
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(300);
    expect(meta.height).toBe(200);
  });

  it("xoay đúng chiều theo EXIF (ảnh dọc chụp từ điện thoại) và bỏ metadata", async () => {
    // 200x100 gắn cờ "xoay 90 độ" giống ảnh dọc từ điện thoại: sau xử lý phải là 100x200.
    const input = await solid(200, 100).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    expect((await sharp(input).metadata()).orientation).toBe(6);

    const out = await processVehicleImage(input);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(200);
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
  });

  it("từ chối file văn bản đổi đuôi thành ảnh", async () => {
    await expectInvalid(Buffer.from("day khong phai la anh, chi la van ban"));
  });

  it("từ chối file rỗng", async () => {
    await expectInvalid(Buffer.alloc(0));
  });

  it("từ chối ảnh GIF (không nằm trong danh sách cho phép)", async () => {
    await expectInvalid(await solid(50, 50).gif().toBuffer());
  });

  it("từ chối SVG (có thể chứa script)", async () => {
    await expectInvalid(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'));
  });

  it("từ chối ảnh JPEG bị cắt cụt", async () => {
    const full = await solid(800, 600).jpeg().toBuffer();
    await expectInvalid(full.subarray(0, Math.floor(full.length / 3)));
  });

  it("từ chối ảnh có quá nhiều điểm ảnh (chống bom giải nén)", async () => {
    // 6000x6000 = 36 triệu điểm ảnh, vượt giới hạn 25 triệu, nhưng PNG đơn sắc chỉ nặng vài chục KB.
    const bomb = await solid(6000, 6000).png({ compressionLevel: 9 }).toBuffer();
    expect(bomb.length).toBeLessThan(5 * 1024 * 1024);
    await expectInvalid(bomb);
  });
});
