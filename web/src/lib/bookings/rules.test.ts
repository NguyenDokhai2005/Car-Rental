import { describe, expect, it } from "vitest";
import {
  Booking,
  cancelRefund,
  effectiveStatus,
  formatClock,
  formatRemaining,
  formatVnDateTime,
  fromVnInput,
  HOUR_MS,
  OwnerBooking,
  ownerState,
  quote,
  rangeProblem,
  rentalDays,
  renterState,
  toVnInput,
} from "./rules";

const NOW = new Date("2026-10-10T03:00:00Z"); // 10:00 ngày 10/10 giờ Việt Nam
const at = (hoursFromNow: number) => new Date(NOW.getTime() + hoursFromNow * HOUR_MS).toISOString();

function booking(patch: Partial<OwnerBooking> = {}): OwnerBooking {
  return {
    id: "b1",
    vehicleId: "v1",
    startAt: at(72),
    endAt: at(120),
    status: "pending",
    rentalDays: 2,
    pricePerDay: 650_000,
    totalAmount: 1_300_000,
    depositAmount: 390_000,
    payableAmount: 1_690_000,
    expiresAt: at(0.25),
    paidAt: null,
    paidAmount: 0,
    ownerApprovedAt: null,
    rejectReason: null,
    ownerHandedOverAt: null,
    renterReceivedAt: null,
    startedAt: null,
    renterReturnedAt: null,
    ownerReceivedBackAt: null,
    completedAt: null,
    cancelledAt: null,
    refundAmount: 0,
    createdAt: at(0),
    vehicle: { id: "v1", title: "Toyota Vios 2022", city: "TP. Hồ Chí Minh", district: "Quận 7", coverUrl: null },
    renter: { fullName: "Nguyễn An", phone: "0900000001" },
    ownerPayoutAmount: 0,
    ...patch,
  };
}

const paid = { paidAt: at(-1), paidAmount: 1_690_000 };
const confirmed = (patch: Partial<OwnerBooking> = {}) => booking({ ...paid, status: "confirmed", expiresAt: null, ...patch });
const inUse = (patch: Partial<OwnerBooking> = {}) =>
  booking({ ...paid, status: "in_use", expiresAt: null, startAt: at(-2), endAt: at(46), ownerPayoutAmount: 650_000, ...patch });

describe("thời gian theo giờ Việt Nam", () => {
  it("đổi qua lại giữa ô nhập và ISO, không lệch múi giờ", () => {
    expect(toVnInput(NOW)).toBe("2026-10-10T10:00");
    expect(fromVnInput("2026-10-12T08:00")).toBe("2026-10-12T08:00:00+07:00");
    expect(new Date(fromVnInput(toVnInput(NOW)) as string).getTime()).toBe(NOW.getTime());
  });

  it("ô nhập trống hoặc sai định dạng: null", () => {
    expect(fromVnInput("")).toBeNull();
    expect(fromVnInput("2026-10-12")).toBeNull();
    expect(fromVnInput("2026-13-45T99:99")).toBeNull();
  });

  it("hiển thị ngày giờ, kể cả khi sang ngày hôm sau so với UTC", () => {
    expect(formatVnDateTime("2026-10-12T02:00:00Z")).toBe("12/10/2026, 09:00");
    expect(formatVnDateTime("2026-10-12T18:30:00Z")).toBe("13/10/2026, 01:30");
  });

  it("đồng hồ và thời gian còn lại", () => {
    expect(formatClock(14 * 60_000 + 32_000)).toBe("14:32");
    expect(formatClock(-5)).toBe("00:00");
    expect(formatRemaining(30_000)).toBe("1 phút");
    expect(formatRemaining(14.2 * 60_000)).toBe("15 phút");
    expect(formatRemaining(2 * HOUR_MS)).toBe("2 giờ");
    expect(formatRemaining(5 * HOUR_MS + 12 * 60_000)).toBe("5 giờ 12 phút");
  });
});

describe("giá tạm tính", () => {
  it("số ngày làm tròn lên theo 24 giờ, như API", () => {
    expect(rentalDays(at(0), at(24))).toBe(1);
    expect(rentalDays(at(0), at(24.01))).toBe(2);
    expect(rentalDays("2026-10-12T08:00:00+07:00", "2026-10-14T20:00:00+07:00")).toBe(3);
  });

  it("tiền cọc thu thêm ngoài tiền thuê", () => {
    expect(quote(650_000, 30, 2)).toEqual({ totalAmount: 1_300_000, depositAmount: 390_000, payableAmount: 1_690_000 });
    expect(quote(50_005, 30, 1)).toEqual({ totalAmount: 50_005, depositAmount: 15_002, payableAmount: 65_007 });
    expect(quote(500_000, 0, 1).payableAmount).toBe(500_000);
  });

  it("khoảng thời gian không đặt được", () => {
    expect(rangeProblem(null, at(48), NOW)).toMatch(/chọn thời gian/);
    expect(rangeProblem(at(48), at(24), NOW)).toMatch(/sau thời gian nhận/);
    expect(rangeProblem(at(-1), at(24), NOW)).toMatch(/tương lai/);
    expect(rangeProblem(at(366 * 24), at(367 * 24), NOW)).toMatch(/365 ngày/);
    expect(rangeProblem(at(24), at(24 + 31 * 24), NOW)).toMatch(/tối đa 30 ngày/);
    expect(rangeProblem(at(24), at(48), NOW)).toBeNull();
  });
});

describe("số tiền hoàn nếu hủy ngay", () => {
  it("chưa thanh toán: 0; đã thanh toán mà chưa được duyệt: toàn bộ", () => {
    expect(cancelRefund(booking(), NOW)).toBe(0);
    expect(cancelRefund(booking({ ...paid, startAt: at(2) }), NOW)).toBe(1_690_000);
  });

  it.each([
    [72, 1_690_000],
    [48, 1_690_000],
    [47.9, 390_000 + 650_000],
    [24, 390_000 + 650_000],
    [23.9, 390_000],
  ])("đã xác nhận, còn %s giờ: hoàn %s", (hours, refund) => {
    expect(cancelRefund(confirmed({ startAt: at(hours) }), NOW)).toBe(refund);
  });
});

describe("khách thuê thấy gì", () => {
  const actions = (b: Booking) => renterState(b, NOW).actions;

  it("chưa thanh toán: được thanh toán hoặc hủy", () => {
    const state = renterState(booking(), NOW);
    expect(state).toMatchObject({ tab: "upcoming", label: "Chờ thanh toán", actions: ["pay", "cancel"] });
    expect(state.hint).toContain("15 phút");
  });

  it("đã thanh toán: chờ chủ xe, chỉ còn nút hủy", () => {
    const state = renterState(booking({ ...paid, expiresAt: at(5) }), NOW);
    expect(state).toMatchObject({ label: "Chờ chủ xe duyệt", actions: ["cancel"] });
    expect(state.hint).toContain("5 giờ");
  });

  it("quá hạn ngay trên màn hình: thành hết hạn, không còn nút nào", () => {
    const stale = booking({ expiresAt: at(-0.1) });
    expect(effectiveStatus(stale, NOW)).toBe("expired");
    expect(renterState(stale, NOW)).toMatchObject({ tab: "cancelled", label: "Hết hạn", actions: [] });
    expect(renterState(booking({ ...paid, expiresAt: at(-0.1) }), NOW).hint).toContain("1.690.000đ");
  });

  it("đã xác nhận: nút nhận xe chỉ mở từ 60 phút trước giờ nhận", () => {
    expect(actions(confirmed({ startAt: at(1.1) }))).toEqual(["cancel"]);
    expect(actions(confirmed({ startAt: at(1) }))).toEqual(["pickup", "cancel"]);
    expect(actions(confirmed({ startAt: at(-3), endAt: at(20) }))).toEqual(["pickup", "cancel"]);
    expect(actions(confirmed({ startAt: at(-30), endAt: at(-1) }))).toEqual(["cancel"]);
  });

  it("đã bấm nhận xe rồi thì không hiện nút đó nữa, và biết đang chờ ai", () => {
    const waiting = renterState(confirmed({ startAt: at(0.5), renterReceivedAt: at(-0.1) }), NOW);
    expect(waiting.actions).toEqual(["cancel"]);
    expect(waiting.hint).toContain("chờ chủ xe");
    expect(renterState(confirmed({ startAt: at(0.5), ownerHandedOverAt: at(-0.1) }), NOW).hint).toContain("Chủ xe đã xác nhận giao xe");
  });

  it("đang thuê: nút trả xe, bấm rồi thì chờ chủ xe", () => {
    expect(renterState(inUse(), NOW)).toMatchObject({ tab: "active", actions: ["return"] });
    expect(renterState(inUse({ renterReturnedAt: at(-0.1) }), NOW)).toMatchObject({ tab: "active", actions: [] });
  });

  it("các trạng thái kết thúc: không còn nút, nói rõ tiền hoàn", () => {
    const done = renterState(inUse({ status: "completed", refundAmount: 390_000 }), NOW);
    expect(done).toMatchObject({ tab: "done", actions: [] });
    expect(done.hint).toContain("390.000đ");

    const rejected = renterState(booking({ ...paid, status: "rejected", rejectReason: "Xe bận", refundAmount: 1_690_000 }), NOW);
    expect(rejected).toMatchObject({ tab: "cancelled", label: "Chủ xe từ chối", actions: [] });
    expect(rejected.hint).toBe("Lý do: Xe bận. Bạn được hoàn 1.690.000đ.");

    expect(renterState(booking({ status: "cancelled" }), NOW)).toMatchObject({ tab: "cancelled", hint: "", actions: [] });
  });
});

describe("chủ xe thấy gì", () => {
  it("đơn đã thanh toán: cần duyệt hoặc từ chối", () => {
    expect(ownerState(booking({ ...paid, expiresAt: at(6) }), NOW)).toMatchObject({
      label: "Chờ bạn duyệt",
      actions: ["approve", "reject"],
      needsAction: true,
    });
  });

  it("quá hạn duyệt: không còn nút", () => {
    expect(ownerState(booking({ ...paid, expiresAt: at(-0.1) }), NOW)).toMatchObject({ label: "Hết hạn", actions: [], needsAction: false });
  });

  it("đã xác nhận: nút giao xe chỉ mở trong khung giờ, bấm rồi thì chờ khách", () => {
    expect(ownerState(confirmed(), NOW)).toMatchObject({ actions: [], needsAction: false });
    expect(ownerState(confirmed({ startAt: at(0.5) }), NOW)).toMatchObject({ actions: ["handover"], needsAction: true });
    expect(ownerState(confirmed({ startAt: at(0.5), ownerHandedOverAt: at(-0.1) }), NOW)).toMatchObject({ actions: [], needsAction: false });
  });

  it("đang cho thuê: luôn bấm nhận lại xe được, và được nhắc khi khách đã bấm trả xe", () => {
    expect(ownerState(inUse(), NOW)).toMatchObject({ actions: ["receive"], needsAction: false });
    expect(ownerState(inUse({ renterReturnedAt: at(-0.1) }), NOW)).toMatchObject({ actions: ["receive"], needsAction: true });
    expect(ownerState(inUse({ ownerReceivedBackAt: at(-0.1) }), NOW)).toMatchObject({ actions: [] });
    expect(ownerState(inUse(), NOW).hint).toContain("650.000đ");
  });

  it("khách hủy sát giờ: nói rõ chủ xe nhận bao nhiêu", () => {
    const late = ownerState(confirmed({ status: "cancelled", ownerPayoutAmount: 1_300_000 }), NOW);
    expect(late.hint).toContain("1.300.000đ");
    expect(ownerState(confirmed({ status: "cancelled" }), NOW).hint).toBe("");
  });
});
