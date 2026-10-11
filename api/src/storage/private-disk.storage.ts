import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { uploadRoot } from "./local-disk.storage";
import { PrivateStorageService } from "./private-storage.service";

export const DEFAULT_PRIVATE_UPLOAD_DIR = "./private-uploads";

export function privateUploadRoot(config: ConfigService): string {
  return path.resolve(config.get<string>("PRIVATE_UPLOAD_DIR") ?? DEFAULT_PRIVATE_UPLOAD_DIR);
}

function isInside(child: string, parent: string): boolean {
  return child === parent || child.startsWith(parent + path.sep);
}

@Injectable()
export class PrivateDiskStorage extends PrivateStorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    super();
    this.root = privateUploadRoot(config);
    // Thư mục công khai được Nginx (hoặc API ở chế độ dev) phục vụ thẳng ra ngoài. Nếu kho riêng nằm trong nó, hoặc
    // ngược lại, ảnh GPLX sẽ có URL công khai. Cấu hình sai kiểu đó phải làm API không khởi động được.
    const publicRoot = uploadRoot(config);
    if (isInside(this.root, publicRoot) || isInside(publicRoot, this.root)) {
      throw new Error(`PRIVATE_UPLOAD_DIR (${this.root}) và UPLOAD_DIR (${publicRoot}) không được trùng hay lồng nhau.`);
    }
  }

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error(`Storage key không hợp lệ: ${key}`);
    return full;
  }

  async save(key: string, data: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    const temp = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, data);
      await rename(temp, target);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}
