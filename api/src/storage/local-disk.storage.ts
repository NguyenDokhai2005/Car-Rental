import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StorageService } from "./storage.service";

export const DEFAULT_UPLOAD_DIR = "./uploads";
export const PUBLIC_UPLOAD_PREFIX = "/uploads/";

export function uploadRoot(config: ConfigService): string {
  return path.resolve(config.get<string>("UPLOAD_DIR") ?? DEFAULT_UPLOAD_DIR);
}

@Injectable()
export class LocalDiskStorage extends StorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    super();
    this.root = uploadRoot(config);
  }

  // Chặn key kiểu "../../etc/passwd" (path traversal): đường dẫn cuối cùng phải nằm trong thư mục gốc.
  // Key do hệ thống sinh nên bình thường không xảy ra, đây là lớp phòng thủ nếu sau này có chỗ nhận key từ ngoài.
  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error(`Storage key không hợp lệ: ${key}`);
    return full;
  }

  async save(key: string, data: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    // Ghi ra file tạm rồi đổi tên: Nginx không bao giờ thấy một file ghi dở.
    const temp = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, data);
      await rename(temp, target);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  publicUrl(key: string): string {
    return `${PUBLIC_UPLOAD_PREFIX}${key}`;
  }
}
