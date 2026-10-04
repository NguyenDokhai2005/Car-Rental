// Lớp trừu tượng nơi lưu file. Nghiệp vụ chỉ biết "key" (ví dụ vehicles/<id>/<uuid>.webp), không biết file nằm ở đâu.
// Hiện lưu trên ổ đĩa (LocalDiskStorage). Sau này đổi sang S3/R2 chỉ cần viết thêm một lớp kế thừa lớp này
// và đổi provider trong StorageModule, không sửa nghiệp vụ và không phải sửa dữ liệu cũ vì CSDL chỉ lưu key.
export abstract class StorageService {
  abstract save(key: string, data: Buffer): Promise<void>;
  // Xóa file; file không tồn tại thì coi như đã xóa (gọi lặp lại vẫn an toàn).
  abstract remove(key: string): Promise<void>;
  // URL công khai của file, dùng cho ảnh xe (không dùng cho GPLX, vốn không công khai).
  abstract publicUrl(key: string): string;
}
