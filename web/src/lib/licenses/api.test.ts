import { describe, expect, it } from "vitest";
import { formatLicenseDate, licenseFormProblem, licenseImageProblem } from "./api";

const TODAY = "2026-10-07";

function file(type = "image/jpeg", size = 1000): File {
  return new File([new Uint8Array(size)], "anh.jpg", { type });
}

const valid = () => ({ licenseNumber: "790123456789", licenseExpiresOn: "2032-10-15", front: file(), back: null as File | null });

describe("licenseImageProblem", () => {
  it("nhận JPG, PNG, WebP trong giới hạn 5 MB", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) expect(licenseImageProblem(file(type), "Mặt trước")).toBeNull();
    expect(licenseImageProblem(file("image/jpeg", 5 * 1024 * 1024), "Mặt trước")).toBeNull();
  });

  it("báo rõ mặt nào sai loại hoặc quá lớn", () => {
    expect(licenseImageProblem(file("application/pdf"), "Mặt sau")).toBe("Mặt sau: chỉ nhận ảnh JPG, PNG hoặc WebP.");
    expect(licenseImageProblem(file("image/jpeg", 5 * 1024 * 1024 + 1), "Mặt trước")).toBe("Mặt trước: ảnh tối đa 5 MB.");
  });
});

describe("licenseFormProblem", () => {
  it("hồ sơ hợp lệ: không có lỗi, kể cả khi số GPLX gõ có khoảng trắng hoặc hết hạn đúng hôm nay", () => {
    expect(licenseFormProblem(valid(), TODAY)).toBeNull();
    expect(licenseFormProblem({ ...valid(), licenseNumber: "7901 2345 6789" }, TODAY)).toBeNull();
    expect(licenseFormProblem({ ...valid(), licenseExpiresOn: TODAY }, TODAY)).toBeNull();
  });

  it.each(["12345", "79012345678a", "7901234567890", ""])("số GPLX sai: %s", (licenseNumber) => {
    expect(licenseFormProblem({ ...valid(), licenseNumber }, TODAY)).toBe("Số giấy phép lái xe gồm đúng 12 chữ số.");
  });

  it("thiếu ngày hết hạn hoặc đã hết hạn", () => {
    expect(licenseFormProblem({ ...valid(), licenseExpiresOn: "" }, TODAY)).toMatch(/chọn ngày hết hạn/);
    expect(licenseFormProblem({ ...valid(), licenseExpiresOn: "2026-10-06" }, TODAY)).toMatch(/đã hết hạn/);
  });

  it("thiếu ảnh mặt trước; ảnh mặt sau là tùy chọn nhưng nếu có thì cũng bị kiểm tra", () => {
    expect(licenseFormProblem({ ...valid(), front: null }, TODAY)).toMatch(/mặt trước/);
    expect(licenseFormProblem({ ...valid(), back: file("image/gif") }, TODAY)).toBe("Mặt sau: chỉ nhận ảnh JPG, PNG hoặc WebP.");
  });
});

describe("formatLicenseDate", () => {
  it("đổi yyyy-mm-dd sang dd/mm/yyyy, rỗng khi chưa có", () => {
    expect(formatLicenseDate("2032-10-15")).toBe("15/10/2032");
    expect(formatLicenseDate(null)).toBe("");
  });
});
