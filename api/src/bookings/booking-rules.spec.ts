import { MAX_PRICE_PER_DAY } from "../vehicles/dto/vehicle-fields";
import {
  DAY_MS,
  INT4_MAX,
  MAX_ADVANCE_DAYS,
  MAX_RENTAL_DAYS,
  OWNER_RESPONSE_HOURS,
  ownerResponseDeadline,
  PAYMENT_HOLD_MINUTES,
  quote,
  rangeProblem,
  rentalDays,
} from "./booking-rules";

const NOW = new Date("2026-10-10T00:00:00Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);

describe("rentalDays (làm tròn lên theo 24 giờ)", () => {
  it.each([
    ["đúng 24 giờ", DAY_MS, 1],
    ["hơn 24 giờ 1 mili giây", DAY_MS + 1, 2],
    ["dưới 24 giờ", DAY_MS - 1, 1],
    ["1 giờ", 3600_000, 1],
    ["đúng 2 ngày", 2 * DAY_MS, 2],
    ["2 ngày 1 giờ", 2 * DAY_MS + 3600_000, 3],
    ["đúng 30 ngày", 30 * DAY_MS, 30],
    ["30 ngày 1 mili giây", 30 * DAY_MS + 1, 31],
  ])("%s", (_name, ms, expected) => {
    expect(rentalDays(at(0), at(ms))).toBe(expected);
  });
});

describe("quote (tiền là số nguyên VND)", () => {
  it("tổng = ngày x giá; cọc = tỷ lệ cọc của xe", () => {
    expect(quote(650_000, 30, 2)).toEqual({ totalAmount: 1_300_000, depositAmount: 390_000 });
    expect(quote(1_000_000, 50, 3)).toEqual({ totalAmount: 3_000_000, depositAmount: 1_500_000 });
  });

  it("tỷ lệ cọc 0 và 100", () => {
    expect(quote(500_000, 0, 2)).toEqual({ totalAmount: 1_000_000, depositAmount: 0 });
    expect(quote(500_000, 100, 2)).toEqual({ totalAmount: 1_000_000, depositAmount: 1_000_000 });
  });

  it("làm tròn VND cho số lẻ, luôn là số nguyên và không vượt tổng", () => {
    // 50_001 x 1 x 30% = 15_000,3 -> 15_000 ; 50_005 x 30% = 15_001,5 -> 15_002 (làm tròn lên ở .5)
    expect(quote(50_001, 30, 1).depositAmount).toBe(15_000);
    expect(quote(50_005, 30, 1).depositAmount).toBe(15_002);
    for (const price of [50_001, 123_457, 999_999, 70_000_000]) {
      for (const rate of [0, 1, 33, 99, 100]) {
        const { totalAmount, depositAmount } = quote(price, rate, 7);
        expect(Number.isInteger(depositAmount)).toBe(true);
        expect(depositAmount).toBeGreaterThanOrEqual(0);
        expect(depositAmount).toBeLessThanOrEqual(totalAmount);
      }
    }
  });

  it("giá trần của xe nhân 30 ngày vẫn vừa cột INTEGER 32 bit của CSDL (nếu không, đặt xe sẽ lỗi 500)", () => {
    expect(MAX_PRICE_PER_DAY * MAX_RENTAL_DAYS).toBeLessThanOrEqual(INT4_MAX);
    expect(quote(MAX_PRICE_PER_DAY, 100, MAX_RENTAL_DAYS).totalAmount).toBeLessThanOrEqual(INT4_MAX);
  });
});

describe("ownerResponseDeadline (hạn chủ xe duyệt đơn)", () => {
  const HOUR = 60 * 60 * 1000;

  it("hai thời hạn đã chốt: chủ xe có 6 giờ để duyệt, khách có 15 phút để thanh toán sau khi được duyệt", () => {
    expect(OWNER_RESPONSE_HOURS).toBe(6);
    expect(PAYMENT_HOLD_MINUTES).toBe(15);
  });

  it("nhận xe còn xa: hạn là đúng 6 giờ kể từ lúc tạo đơn", () => {
    expect(ownerResponseDeadline(NOW, at(3 * DAY_MS)).getTime()).toBe(NOW.getTime() + 6 * HOUR);
  });

  it("nhận xe sau 2 giờ nữa: hạn là giờ nhận xe, không phải 6 giờ", () => {
    expect(ownerResponseDeadline(NOW, at(2 * HOUR)).getTime()).toBe(NOW.getTime() + 2 * HOUR);
  });

  it("nhận xe đúng 6 giờ nữa: hai mốc trùng nhau", () => {
    expect(ownerResponseDeadline(NOW, at(6 * HOUR)).getTime()).toBe(NOW.getTime() + 6 * HOUR);
  });

  it("hạn không bao giờ muộn hơn giờ nhận xe và không bao giờ quá 6 giờ", () => {
    for (const lead of [1, 60_000, HOUR, 5 * HOUR, 6 * HOUR, 7 * HOUR, 30 * DAY_MS]) {
      const deadline = ownerResponseDeadline(NOW, at(lead)).getTime();
      expect(deadline).toBeLessThanOrEqual(NOW.getTime() + lead);
      expect(deadline).toBeLessThanOrEqual(NOW.getTime() + 6 * HOUR);
      expect(deadline).toBeGreaterThan(NOW.getTime());
    }
  });
});

describe("rangeProblem", () => {
  it("khoảng hợp lệ: null", () => {
    expect(rangeProblem(at(DAY_MS), at(3 * DAY_MS), NOW)).toBeNull();
  });

  it.each([
    ["ngày không hợp lệ", new Date("x"), at(DAY_MS)],
    ["kết thúc bằng bắt đầu", at(DAY_MS), at(DAY_MS)],
    ["kết thúc trước bắt đầu", at(2 * DAY_MS), at(DAY_MS)],
    ["bắt đầu ở quá khứ", at(-DAY_MS), at(DAY_MS)],
    ["bắt đầu đúng bây giờ (không phải tương lai)", at(0), at(DAY_MS)],
  ])("%s: có thông báo", (_name, start, end) => {
    expect(rangeProblem(start, end, NOW)).toEqual(expect.any(String));
  });

  it("bắt đầu 1 mili giây sau bây giờ là hợp lệ", () => {
    expect(rangeProblem(at(1), at(DAY_MS), NOW)).toBeNull();
  });

  it("thuê đúng 30 ngày hợp lệ, 30 ngày và 1 mili giây (tức 31 ngày) thì không", () => {
    expect(rangeProblem(at(DAY_MS), at(DAY_MS + 30 * DAY_MS), NOW)).toBeNull();
    expect(rangeProblem(at(DAY_MS), at(DAY_MS + 30 * DAY_MS + 1), NOW)).toContain("1 đến 30 ngày");
  });

  it("bắt đầu đúng 365 ngày tới hợp lệ, hơn 1 mili giây thì không", () => {
    expect(rangeProblem(at(MAX_ADVANCE_DAYS * DAY_MS), at(MAX_ADVANCE_DAYS * DAY_MS + DAY_MS), NOW)).toBeNull();
    expect(rangeProblem(at(MAX_ADVANCE_DAYS * DAY_MS + 1), at(MAX_ADVANCE_DAYS * DAY_MS + DAY_MS), NOW)).toContain("365");
  });
});
