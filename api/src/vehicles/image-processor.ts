import sharp from "sharp";
import { ApiError } from "../common/api-error";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_VEHICLE = 10;

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
const MAX_EDGE_PX = 1600;
// Ảnh giải mã ra RAM chiếm khoảng 4 byte mỗi điểm ảnh. 25 triệu điểm ảnh (~5000x5000) là ~100 MB, vừa với máy chủ nhỏ.
// Chặn ảnh "bom giải nén": file vài trăm KB nhưng khai báo hàng tỷ điểm ảnh làm treo server.
const MAX_INPUT_PIXELS = 25_000_000;

// Máy chủ chỉ có 1 đến 2 GB RAM: xử lý từng ảnh một và không giữ cache ảnh trong bộ nhớ.
sharp.cache(false);
sharp.concurrency(1);

function invalidImage(): ApiError {
  return new ApiError(400, "VALIDATION_ERROR", "Tệp không phải ảnh hợp lệ. Chỉ nhận ảnh JPG, PNG hoặc WebP.");
}

// Giải mã ảnh gốc rồi vẽ lại thành một file WebP mới. Việc này vừa kiểm tra file có thật là ảnh (dựa vào nội dung,
// không tin đuôi file hay Content-Type do client khai), vừa loại bỏ mọi thứ không phải điểm ảnh: mã độc nhúng trong
// file, EXIF, vị trí GPS. Chỉ bản vẽ lại này mới được lưu.
export async function processVehicleImage(input: Buffer): Promise<Buffer> {
  try {
    const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
    const { format } = await image.metadata();
    if (!format || !ALLOWED_FORMATS.has(format)) throw invalidImage();

    return await image
      .rotate() // xoay theo hướng chụp (EXIF) trước khi metadata bị bỏ, nếu không ảnh dọc từ điện thoại sẽ nằm ngang
      .resize({ width: MAX_EDGE_PX, height: MAX_EDGE_PX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw invalidImage();
  }
}
