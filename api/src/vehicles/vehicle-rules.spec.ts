import { buildTitle, diffEditable, EditableValues, nextStatusAfterEdit } from "./vehicle-rules";

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

describe("nextStatusAfterEdit", () => {
  it.each(["plateNumber", "brand", "model", "year", "seats", "transmission", "fuel", "pricePerDay", "depositRate"] as const)(
    "đổi %s trên xe đã duyệt đưa xe về pending",
    (field) => {
      expect(nextStatusAfterEdit("approved", [field])).toBe("pending");
    },
  );

  it.each(["description", "city", "district"] as const)("đổi %s trên xe đã duyệt giữ nguyên approved", (field) => {
    expect(nextStatusAfterEdit("approved", [field])).toBe("approved");
  });

  it("đổi thông tin quan trọng trên xe đang ẩn đưa về pending", () => {
    expect(nextStatusAfterEdit("hidden", ["pricePerDay"])).toBe("pending");
  });

  it("đổi thông tin không quan trọng trên xe đang ẩn giữ nguyên hidden", () => {
    expect(nextStatusAfterEdit("hidden", ["description"])).toBe("hidden");
  });

  it("sửa xe bị từ chối là nộp lại, kể cả chỉ đổi mô tả", () => {
    expect(nextStatusAfterEdit("rejected", ["description"])).toBe("pending");
  });

  it("xe đang chờ duyệt vẫn chờ duyệt", () => {
    expect(nextStatusAfterEdit("pending", ["pricePerDay", "description"])).toBe("pending");
  });

  it("một thay đổi quan trọng lẫn thay đổi không quan trọng vẫn đưa về pending", () => {
    expect(nextStatusAfterEdit("approved", ["description", "seats"])).toBe("pending");
  });
});
