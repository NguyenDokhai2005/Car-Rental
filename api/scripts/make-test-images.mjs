// Tạo bộ ảnh để thử tay chức năng tải ảnh (Postman, curl hoặc giao diện sau này).
// Chạy từ thư mục api: node scripts/make-test-images.mjs
// Kết quả nằm trong api/test/manual-images/ (đã được .gitignore, không commit).
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import sharp from "sharp";

const OUT = path.join(import.meta.dirname, "..", "test", "manual-images");
await mkdir(OUT, { recursive: true });

// Ảnh có nhiễu ngẫu nhiên để file nặng như ảnh chụp thật (ảnh đơn sắc nén quá nhỏ, không thử được giới hạn 5 MB).
function noisy(width, height) {
  return sharp(randomBytes(width * height * 3), { raw: { width, height, channels: 3 } });
}

const files = {
  // Hợp lệ
  "ok-1-xe-ngang.jpg": () => noisy(1600, 1067).jpeg({ quality: 80 }).toBuffer(),
  "ok-2-xe-lon-3000px.jpg": () => noisy(3000, 2000).jpeg({ quality: 70 }).toBuffer(), // phải bị thu về 1600 px
  "ok-3-anh.png": () => noisy(1200, 800).png({ compressionLevel: 9 }).toBuffer(),
  "ok-4-anh.webp": () => noisy(1200, 800).webp({ quality: 80 }).toBuffer(),
  // Ảnh dọc kiểu điện thoại: điểm ảnh nằm ngang nhưng gắn cờ xoay 90 độ. Sau khi tải phải hiện đứng (800x1200).
  "ok-5-anh-doc-exif.jpg": async () =>
    noisy(1200, 800).jpeg({ quality: 80 }).withMetadata({ orientation: 6 }).toBuffer(),
  // Phải bị từ chối
  "bad-1-van-ban-doi-duoi.jpg": async () => Buffer.from("Day la file van ban, khong phai anh."),
  // Khoảng 7 MB: vượt giới hạn 5 MB nhưng dưới 10 MB (proxy của Next ở dev chỉ đệm tối đa 10 MB cho mỗi request).
  "bad-2-qua-5MB.jpg": () => noisy(3200, 2400).jpeg({ quality: 90 }).toBuffer(),
  "bad-3-anh-dong.gif": () => sharp({ create: { width: 60, height: 60, channels: 3, background: "#e11" } }).gif().toBuffer(),
  "bad-4-svg-co-script.svg": async () =>
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>'),
  "bad-5-file-rong.jpg": async () => Buffer.alloc(0),
  "bad-6-bom-giai-nen-6000px.png": () =>
    sharp({ create: { width: 6000, height: 6000, channels: 3, background: "#369" } })
      .png({ compressionLevel: 9 })
      .toBuffer(),
};

for (const [name, make] of Object.entries(files)) {
  const data = await make();
  await writeFile(path.join(OUT, name), data);
  console.log(`${name.padEnd(34)} ${(data.length / 1024).toFixed(0).padStart(7)} KB`);
}
console.log(`\nĐã tạo trong ${OUT}`);
