// Giới hạn ảnh xe, khớp với API (SPEC §7). Kiểm tra ở trình duyệt chỉ để báo lỗi nhanh cho người dùng đỡ chờ tải
// lên rồi mới bị từ chối; API vẫn kiểm tra lại bằng nội dung thật của file.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES = 10;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function validateImageFile(file: { name: string; type: string; size: number }): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return `"${file.name}": chỉ nhận ảnh JPG, PNG hoặc WebP.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `"${file.name}": nặng quá 5 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`;
  }
  if (file.size === 0) return `"${file.name}": tệp rỗng.`;
  return null;
}
