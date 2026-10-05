import { describe, expect, it } from "vitest";
import type { OwnerVehicle } from "./api";
import { changedFields, dayRangeToBlock, describeBlock, photoChangeNeedsReview, reviewTriggers } from "./owner-rules";

const CURRENT: Pick<
  OwnerVehicle,
  "brand" | "model" | "year" | "plateNumber" | "seats" | "transmission" | "fuel" | "description" | "city" | "district" | "pricePerDay" | "depositRate"
> = {
  brand: "Toyota",
  model: "Vios",
  year: 2022,
  plateNumber: "51K12345",
  seats: 5,
  transmission: "automatic",
  fuel: "petrol",
  description: "Xe sạch",
  city: "TP. Hồ Chí Minh",
  district: "Quận 7",
  pricePerDay: 650000,
  depositRate: 30,
};

describe("changedFields", () => {
  it("không đổi gì thì rỗng, kể cả khi gửi lại đúng giá trị cũ", () => {
    expect(changedFields(CURRENT, { ...CURRENT })).toEqual({});
    expect(changedFields(CURRENT, {})).toEqual({});
  });

  it("chỉ giữ các trường khác giá trị hiện tại", () => {
    expect(changedFields(CURRENT, { ...CURRENT, pricePerDay: 700000, district: "Quận 1" })).toEqual({
      pricePerDay: 700000,
      district: "Quận 1",
    });
  });

  it("biển số so sánh theo dạng chuẩn: viết khác dấu nhưng cùng biển thì không tính là đổi", () => {
    expect(changedFields(CURRENT, { plateNumber: "51k-123.45" })).toEqual({});
    expect(changedFields(CURRENT, { plateNumber: "51K-999.99" })).toEqual({ plateNumber: "51K-999.99" });
  });
});

describe("reviewTriggers (mọi thay đổi đều phải duyệt lại)", () => {
  it.each(["approved", "hidden", "rejected"] as const)("xe %s: mọi trường đã đổi đều khiến xe phải duyệt lại", (status) => {
    expect(reviewTriggers(status, ["description"])).toEqual(["description"]);
    expect(reviewTriggers(status, ["city", "district"])).toEqual(["city", "district"]);
    expect(reviewTriggers(status, ["pricePerDay", "description"])).toEqual(["pricePerDay", "description"]);
  });

  it("xe đang chờ duyệt: sửa gì cũng vẫn chờ duyệt, không có gì thay đổi thêm", () => {
    expect(reviewTriggers("pending", ["pricePerDay", "brand", "description"])).toEqual([]);
  });

  it("không đổi gì thì không có gì để duyệt lại", () => {
    expect(reviewTriggers("approved", [])).toEqual([]);
  });
});

describe("photoChangeNeedsReview", () => {
  it.each(["approved", "hidden", "rejected"] as const)("xe %s: đổi ảnh phải duyệt lại", (status) => {
    expect(photoChangeNeedsReview(status)).toBe(true);
  });
  it("xe đang chờ duyệt: không", () => {
    expect(photoChangeNeedsReview("pending")).toBe(false);
  });
});

describe("dayRangeToBlock", () => {
  it("chặn từ 00:00 ngày bắt đầu đến hết ngày kết thúc theo giờ Việt Nam", () => {
    expect(dayRangeToBlock("2026-10-12", "2026-10-14")).toEqual({
      startAt: "2026-10-12T00:00:00+07:00",
      endAt: "2026-10-15T00:00:00+07:00",
    });
  });

  it("một ngày duy nhất và qua cuối tháng, cuối năm", () => {
    expect(dayRangeToBlock("2026-10-12", "2026-10-12")?.endAt).toBe("2026-10-13T00:00:00+07:00");
    expect(dayRangeToBlock("2026-10-31", "2026-10-31")?.endAt).toBe("2026-11-01T00:00:00+07:00");
    expect(dayRangeToBlock("2026-12-31", "2026-12-31")?.endAt).toBe("2027-01-01T00:00:00+07:00");
  });

  it.each([
    ["ngày kết thúc trước ngày bắt đầu", "2026-10-14", "2026-10-12"],
    ["ngày không có thật", "2026-02-31", "2026-03-01"],
    ["sai định dạng", "12/10/2026", "13/10/2026"],
    ["rỗng", "", ""],
  ])("%s: null", (_name, a, b) => {
    expect(dayRangeToBlock(a, b)).toBeNull();
  });
});

describe("describeBlock", () => {
  it("hiển thị theo ngày: ngày cuối là ngày trước 00:00 kết thúc", () => {
    expect(describeBlock("2026-10-12T00:00:00+07:00", "2026-10-15T00:00:00+07:00")).toBe("12/10/2026 đến 14/10/2026");
  });

  it("một ngày thì chỉ hiện một ngày", () => {
    expect(describeBlock("2026-10-12T00:00:00+07:00", "2026-10-13T00:00:00+07:00")).toBe("12/10/2026");
  });

  it("khoảng không tròn ngày (tạo từ API) hiện ngày kết thúc thật", () => {
    expect(describeBlock("2026-10-12T08:00:00+07:00", "2026-10-14T10:00:00+07:00")).toBe("12/10/2026 đến 14/10/2026");
  });
});
