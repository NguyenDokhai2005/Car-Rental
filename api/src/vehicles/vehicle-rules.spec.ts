import { BACK_TO_REVIEW, buildTitle, diffEditable, EditableValues, needsReviewReset } from "./vehicle-rules";

const CURRENT: EditableValues = {
  brand: "Toyota",
  model: "Vios",
  year: 2022,
  plateNumber: "51K-123.45",
  seats: 5,
  transmission: "automatic",
  fuel: "petrol",
  description: "Xe sạch",
  city: "TP. Hồ Chí Minh",
  district: "Quận 7",
  pricePerDay: 650000,
  depositRate: 30,
};

describe("buildTitle", () => {
  it("ghép hãng, mẫu, năm", () => {
    expect(buildTitle({ brand: "Toyota", model: "Vios", year: 2022 })).toBe("Toyota Vios 2022");
  });
});

describe("diffEditable", () => {
  it("chỉ giữ trường có giá trị khác", () => {
    expect(diffEditable(CURRENT, { pricePerDay: 700000, brand: "Toyota", city: undefined })).toEqual({
      pricePerDay: 700000,
    });
  });

  it("gửi lại đúng giá trị cũ thì không có thay đổi", () => {
    expect(diffEditable(CURRENT, { ...CURRENT })).toEqual({});
  });
});

describe("needsReviewReset (mọi thay đổi của chủ xe đều phải duyệt lại, SPEC §2)", () => {
  it.each(["approved", "hidden", "rejected"] as const)("xe %s bị thay đổi thì phải duyệt lại", (status) => {
    expect(needsReviewReset(status)).toBe(true);
  });

  it("xe đang chờ duyệt thì không có kết quả duyệt nào để xóa", () => {
    expect(needsReviewReset("pending")).toBe(false);
  });

  it("dữ liệu đưa xe về duyệt lại: pending và xóa sạch kết quả duyệt cũ", () => {
    expect(BACK_TO_REVIEW).toEqual({ status: "pending", rejectReason: null, reviewedById: null, reviewedAt: null });
  });
});
