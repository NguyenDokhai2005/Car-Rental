import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ConfigService } from "@nestjs/config";
import { PrivateDiskStorage } from "./private-disk.storage";

function configOf(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe("PrivateDiskStorage", () => {
  let base: string;
  let storage: PrivateDiskStorage;

  beforeEach(async () => {
    base = await mkdtemp(path.join(tmpdir(), "carrental-private-"));
    storage = new PrivateDiskStorage(configOf({ PRIVATE_UPLOAD_DIR: path.join(base, "private"), UPLOAD_DIR: path.join(base, "public") }));
  });

  afterEach(async () => {
    await rm(base, { recursive: true, force: true });
  });

  it("lưu rồi đọc lại đúng nội dung, không để lại file tạm", async () => {
    await storage.save("licenses/u1/a.webp", Buffer.from("noi dung"));
    expect((await storage.read("licenses/u1/a.webp"))?.toString()).toBe("noi dung");
    expect(await readdir(path.join(base, "private", "licenses", "u1"))).toEqual(["a.webp"]);
  });

  it("đọc file không tồn tại trả null; xóa file không tồn tại vẫn thành công", async () => {
    expect(await storage.read("licenses/u1/khong-co.webp")).toBeNull();
    await expect(storage.remove("licenses/u1/khong-co.webp")).resolves.toBeUndefined();
  });

  it("xóa xong thì không đọc được nữa", async () => {
    await storage.save("licenses/u1/a.webp", Buffer.from("x"));
    await storage.remove("licenses/u1/a.webp");
    expect(await storage.read("licenses/u1/a.webp")).toBeNull();
  });

  it.each(["../ngoai.txt", "licenses/../../ngoai.txt", "/etc/passwd", ".."])("từ chối key trỏ ra ngoài thư mục gốc: %s", async (key) => {
    await expect(storage.save(key, Buffer.from("x"))).rejects.toThrow("Storage key không hợp lệ");
    await expect(storage.read(key)).rejects.toThrow("Storage key không hợp lệ");
  });

  it.each([
    ["trùng nhau", "data", "data"],
    ["kho riêng nằm trong thư mục công khai", "public/private", "public"],
    ["thư mục công khai nằm trong kho riêng", "private", "private/public"],
  ])("không khởi động khi hai thư mục %s", (_name, privateDir, publicDir) => {
    const config = configOf({ PRIVATE_UPLOAD_DIR: path.join(base, privateDir), UPLOAD_DIR: path.join(base, publicDir) });
    expect(() => new PrivateDiskStorage(config)).toThrow("không được trùng hay lồng nhau");
  });

  it("hai thư mục chỉ giống nhau phần đầu tên thì vẫn hợp lệ", () => {
    const config = configOf({ PRIVATE_UPLOAD_DIR: path.join(base, "uploads-private"), UPLOAD_DIR: path.join(base, "uploads") });
    expect(() => new PrivateDiskStorage(config)).not.toThrow();
  });
});
