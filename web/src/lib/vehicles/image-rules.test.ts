import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, validateImageFile } from "./image-rules";

const file = (type: string, size: number, name = "xe.jpg") => ({ name, type, size });

describe("validateImageFile", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("nhận %s", (type) => {
    expect(validateImageFile(file(type, 1000))).toBeNull();
  });

  it("nhận file đúng bằng 5 MB, từ chối quá 5 MB", () => {
    expect(validateImageFile(file("image/jpeg", MAX_IMAGE_BYTES))).toBeNull();
    expect(validateImageFile(file("image/jpeg", MAX_IMAGE_BYTES + 1))).toContain("5 MB");
  });

  it.each(["image/gif", "image/svg+xml", "application/pdf", "text/plain", ""])("từ chối loại %j", (type) => {
    expect(validateImageFile(file(type, 1000))).toContain("JPG, PNG hoặc WebP");
  });

  it("từ chối file rỗng và có nêu tên file", () => {
    expect(validateImageFile(file("image/png", 0, "trong.png"))).toBe('"trong.png": tệp rỗng.');
  });
});
