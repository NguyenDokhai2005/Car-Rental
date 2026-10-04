import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ConfigService } from "@nestjs/config";
import { LocalDiskStorage } from "./local-disk.storage";

describe("LocalDiskStorage", () => {
  let dir: string;
  let storage: LocalDiskStorage;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "carrental-storage-"));
    const config = { get: (key: string) => (key === "UPLOAD_DIR" ? dir : undefined) } as unknown as ConfigService;
    storage = new LocalDiskStorage(config);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("lưu file vào đúng key, tự tạo thư mục con", async () => {
    await storage.save("vehicles/abc/1.webp", Buffer.from("noi dung"));
    expect((await readFile(path.join(dir, "vehicles", "abc", "1.webp"))).toString()).toBe("noi dung");
  });

  it("không để lại file tạm sau khi lưu", async () => {
    await storage.save("vehicles/abc/1.webp", Buffer.from("x"));
    expect(await readdir(path.join(dir, "vehicles", "abc"))).toEqual(["1.webp"]);
  });

  it("xóa file; xóa file không tồn tại vẫn thành công", async () => {
    await storage.save("vehicles/abc/1.webp", Buffer.from("x"));
    await storage.remove("vehicles/abc/1.webp");
    expect(existsSync(path.join(dir, "vehicles", "abc", "1.webp"))).toBe(false);
    await expect(storage.remove("vehicles/abc/1.webp")).resolves.toBeUndefined();
  });

  it.each(["../ngoai.txt", "vehicles/../../ngoai.txt", "/etc/passwd", ".."])(
    "từ chối key trỏ ra ngoài thư mục gốc: %s",
    async (key) => {
      await expect(storage.save(key, Buffer.from("x"))).rejects.toThrow("Storage key không hợp lệ");
      await expect(storage.remove(key)).rejects.toThrow("Storage key không hợp lệ");
    },
  );

  it("URL công khai là /uploads/<key>", () => {
    expect(storage.publicUrl("vehicles/abc/1.webp")).toBe("/uploads/vehicles/abc/1.webp");
  });
});
