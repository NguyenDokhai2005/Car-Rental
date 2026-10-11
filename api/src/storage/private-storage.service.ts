// Kho file riêng tư (ảnh GPLX). Khác StorageService ở hai điểm cố ý: không có publicUrl (file không bao giờ có URL công
// khai), và có read (cách duy nhất để lấy file là đi qua API, nơi kiểm tra quyền và ghi log truy cập).
export abstract class PrivateStorageService {
  abstract save(key: string, data: Buffer): Promise<void>;
  // File không tồn tại thì trả null.
  abstract read(key: string): Promise<Buffer | null>;
  // Xóa file; file không tồn tại thì coi như đã xóa (gọi lặp lại vẫn an toàn).
  abstract remove(key: string): Promise<void>;
}
