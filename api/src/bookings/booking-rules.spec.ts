import { MAX_PRICE_PER_DAY } from "../vehicles/dto/vehicle-fields";
import {
  cancelSettlement,
  DAY_MS,
  handoverProblem,
  INT4_MAX,
  MAX_ADVANCE_DAYS,
  MAX_RENTAL_DAYS,
  OWNER_RESPONSE_HOURS,
  ownerResponseDeadline,
  PAYMENT_HOLD_MINUTES,
  paymentDeadline,
  pickupPayout,
  quote,
  rangeProblem,
  rentalDays,
} from "./booking-rules";

const NOW = new Date("2026-10-10T00:00:00Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);
const MIN = 60_000;
const HOUR = 60 * MIN;

describe("rentalDays (làm tròn lên theo 24 giờ)", () => {
  it.each([
    ["đúng 24 giờ", DAY_MS, 1],
    ["hơn 24 giờ 1 mili giây", DAY_MS + 1, 2],
    ["dưới 24 giờ", DAY_MS - 1, 1],
    ["1 giờ", HOUR, 1],
    ["đúng 2 ngày", 2 * DAY_MS, 2],
    ["2 ngày 1 giờ", 2 * DAY_MS + HOUR, 3],
    ["đúng 30 ngày", 30 * DAY_MS, 30],
    ["30 ngày 1 mili giây", 30 * DAY_MS + 1, 31],
  ])("%s", (_name, ms, expected) => {
    expect(rentalDays(at(0), at(ms))).toBe(expected);
  });
});

describe("quote (tiền là số nguyên VND; tiền cọc thu thêm ngoài tiền thuê)", () => {
  it("tiền thuê = ngày x giá; tiền cọc = tỷ lệ cọc của xe; khách trả tổng của hai khoản", () => {
    expect(quote(650_000, 30, 2)).toEqual({ totalAmount: 1_300_000, depositAmount: 390_000, payableAmount: 1_690_000 });
    expect(quote(1_000_000, 50, 3)).toEqual({ totalAmount: 3_000_000, depositAmount: 1_500_000, payableAmount: 4_500_000 });
  });

  it("tỷ lệ cọc 0%: khách vẫn trả tiền thuê; tỷ lệ cọc 100%: khách trả gấp đôi tiền thuê", () => {
    expect(quote(500_000, 0, 2)).toEqual({ totalAmount: 1_000_000, depositAmount: 0, payableAmount: 1_000_000 });
    expect(quote(500_000, 100, 2)).toEqual({ totalAmount: 1_000_000, depositAmount: 1_000_000, payableAmount: 2_000_000 });
  });

  it("làm tròn VND cho số lẻ, luôn là số nguyên", () => {
    // 50_001 x 30% = 15_000,3 -> 15_000 ; 50_005 x 30% = 15_001,5 -> 15_002 (làm tròn lên ở .5)
    expect(quote(50_001, 30, 1).depositAmount).toBe(15_000);
    expect(quote(50_005, 30, 1).depositAmount).toBe(15_002);
    for (const price of [50_001, 123_457, 999_999, MAX_PRICE_PER_DAY]) {
      for (const rate of [0, 1, 33, 99, 100]) {
        const { totalAmount, depositAmount, payableAmount } = quote(price, rate, 7);
        expect(Number.isInteger(depositAmount)).toBe(true);
        expect(depositAmount).toBeGreaterThanOrEqual(0);
        expect(depositAmount).toBeLessThanOrEqual(totalAmount);
        expect(payableAmount).toBe(totalAmount + depositAmount);
      }
    }
  });

  it("số khách phải trả ở mức cao nhất (giá trần, 30 ngày, cọc 100%) vẫn vừa cột INTEGER 32 bit (nếu không, đặt xe sẽ lỗi 500)", () => {
    expect(MAX_PRICE_PER_DAY * MAX_RENTAL_DAYS * 2).toBeLessThanOrEqual(INT4_MAX);
    expect(quote(MAX_PRICE_PER_DAY, 100, MAX_RENTAL_DAYS).payableAmount).toBeLessThanOrEqual(INT4_MAX);
  });
});

describe("hai thời hạn của đơn pending", () => {
  it("đã chốt: khách có 15 phút để thanh toán, chủ xe có 6 giờ để duyệt", () => {
    expect(PAYMENT_HOLD_MINUTES).toBe(15);
    expect(OWNER_RESPONSE_HOURS).toBe(6);
  });

  it("paymentDeadline: 15 phút kể từ lúc tạo đơn, không muộn hơn giờ nhận xe", () => {
    expect(paymentDeadline(NOW, at(3 * DAY_MS)).getTime()).toBe(NOW.getTime() + 15 * MIN);
    expect(paymentDeadline(NOW, at(5 * MIN)).getTime()).toBe(NOW.getTime() + 5 * MIN);
  });

  it("ownerResponseDeadline: 6 giờ kể từ lúc thanh toán, không muộn hơn giờ nhận xe", () => {
    expect(ownerResponseDeadline(NOW, at(3 * DAY_MS)).getTime()).toBe(NOW.getTime() + 6 * HOUR);
    expect(ownerResponseDeadline(NOW, at(2 * HOUR)).getTime()).toBe(NOW.getTime() + 2 * HOUR);
    expect(ownerResponseDeadline(NOW, at(6 * HOUR)).getTime()).toBe(NOW.getTime() + 6 * HOUR);
  });

  it("cả hai hạn không bao giờ vượt quá giờ nhận xe và luôn sau thời điểm hiện tại", () => {
    for (const lead of [1, MIN, HOUR, 5 * HOUR, 7 * HOUR, 30 * DAY_MS]) {
      for (const deadline of [paymentDeadline(NOW, at(lead)), ownerResponseDeadline(NOW, at(lead))]) {
        expect(deadline.getTime()).toBeLessThanOrEqual(NOW.getTime() + lead);
        expect(deadline.getTime()).toBeGreaterThan(NOW.getTime());
      }
    }
  });
});

describe("cancelSettlement (chia tiền khi khách hủy)", () => {
  const TOTAL = 1_300_000;
  const DEPOSIT = 390_000;
  const settle = (status: "pending" | "confirmed", paid: boolean, leadMs: number, total = TOTAL, deposit = DEPOSIT) =>
    cancelSettlement({ status, paid, totalAmount: total, depositAmount: deposit, startAt: at(leadMs) }, NOW);

  it("đơn chưa thanh toán: không có tiền nào để chia", () => {
    expect(settle("pending", false, 30 * DAY_MS)).toEqual({ refundAmount: 0, ownerPayoutAmount: 0 });
  });

  it("đã thanh toán nhưng chủ xe chưa duyệt: hoàn toàn bộ, dù sát giờ nhận xe", () => {
    expect(settle("pending", true, 30 * DAY_MS)).toEqual({ refundAmount: TOTAL + DEPOSIT, ownerPayoutAmount: 0 });
    expect(settle("pending", true, HOUR)).toEqual({ refundAmount: TOTAL + DEPOSIT, ownerPayoutAmount: 0 });
  });

  it.each([
    ["còn 72 giờ: hoàn 100% tiền thuê", 72 * HOUR, TOTAL + DEPOSIT, 0],
    ["còn đúng 48 giờ: hoàn 100%", 48 * HOUR, TOTAL + DEPOSIT, 0],
    ["còn 48 giờ thiếu 1 mili giây: hoàn 50%", 48 * HOUR - 1, TOTAL / 2 + DEPOSIT, TOTAL / 2],
    ["còn 36 giờ: hoàn 50%", 36 * HOUR, TOTAL / 2 + DEPOSIT, TOTAL / 2],
    ["còn đúng 24 giờ: hoàn 50%", 24 * HOUR, TOTAL / 2 + DEPOSIT, TOTAL / 2],
    ["còn 24 giờ thiếu 1 mili giây: không hoàn tiền thuê", 24 * HOUR - 1, DEPOSIT, TOTAL],
    ["còn 1 giờ: không hoàn tiền thuê", HOUR, DEPOSIT, TOTAL],
    ["đã qua giờ nhận xe (khách không đến): không hoàn tiền thuê", -HOUR, DEPOSIT, TOTAL],
  ])("đơn confirmed, %s; tiền cọc luôn về khách", (_name, lead, refund, payout) => {
    expect(settle("confirmed", true, lead)).toEqual({ refundAmount: refund, ownerPayoutAmount: payout });
  });

  it("không đồng nào bị bỏ lơ lửng: hoàn cho khách + ghi nhận cho chủ xe luôn đúng bằng số khách đã trả", () => {
    for (const [total, deposit] of [[1_300_000, 390_000], [50_005, 15_002], [1, 0], [999_999, 999_999], [1_050_000_000, 1_050_000_000]]) {
      for (const lead of [72 * HOUR, 36 * HOUR, HOUR]) {
        for (const status of ["pending", "confirmed"] as const) {
          const { refundAmount, ownerPayoutAmount } = settle(status, true, lead, total, deposit);
          expect(refundAmount + ownerPayoutAmount).toBe(total + deposit);
          expect(Number.isInteger(refundAmount) && Number.isInteger(ownerPayoutAmount)).toBe(true);
          expect(refundAmount).toBeGreaterThanOrEqual(deposit); // tiền cọc không bao giờ bị giữ lại
          expect(ownerPayoutAmount).toBeLessThanOrEqual(total); // chủ xe không bao giờ nhận quá tiền thuê
        }
      }
    }
  });
});

describe("pickupPayout (chủ xe nhận 50% tiền thuê khi giao xe)", () => {
  it("một nửa tiền thuê, làm tròn xuống; phần còn lại khi trả xe làm tổng đúng bằng tiền thuê", () => {
    expect(pickupPayout(1_300_000)).toBe(650_000);
    expect(pickupPayout(50_005)).toBe(25_002);
    for (const total of [1, 2, 50_005, 1_300_000, 1_050_000_000]) {
      const first = pickupPayout(total);
      expect(first).toBeLessThanOrEqual(total);
      expect(first + (total - first)).toBe(total);
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

describe("handoverProblem (khung giờ được xác nhận giao xe)", () => {
  const start = at(DAY_MS);
  const end = at(3 * DAY_MS);
  const when = (ms: number) => new Date(start.getTime() + ms);

  it("từ 60 phút trước giờ nhận xe tới trước giờ trả xe: được", () => {
    expect(handoverProblem(start, end, when(-60 * MIN))).toBeNull();
    expect(handoverProblem(start, end, when(0))).toBeNull();
    expect(handoverProblem(start, end, new Date(end.getTime() - 1))).toBeNull();
  });

  it("sớm hơn 60 phút: chưa được", () => {
    expect(handoverProblem(start, end, when(-60 * MIN - 1))).toEqual(expect.any(String));
    expect(handoverProblem(start, end, NOW)).toEqual(expect.any(String));
  });

  it("từ giờ trả xe trở đi: không được", () => {
    expect(handoverProblem(start, end, end)).toEqual(expect.any(String));
  });
});
