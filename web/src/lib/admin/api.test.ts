import { describe, expect, it } from "vitest";
import { previewAdminCancel } from "./api";

// Phải khớp adminCancelSettlement của API (api/src/bookings/booking-rules.ts): màn hình cho admin xem trước đúng số tiền
// mà API sẽ ghi.
describe("xem trước chia tiền khi admin hủy đơn", () => {
  const paid = { paidAt: "2026-10-10T03:00:00Z", totalAmount: 650_000, depositAmount: 195_000 };

  it.each([
    [100, 845_000, 0],
    [50, 520_000, 325_000],
    [30, 390_000, 455_000],
    [0, 195_000, 650_000],
  ])("hoàn %i%% tiền thuê: khách %i, chủ xe %i", (percent, refundAmount, ownerPayoutAmount) => {
    expect(previewAdminCancel(paid, percent)).toEqual({ refundAmount, ownerPayoutAmount });
  });

  it("tiền thuê lẻ vẫn cộng lại đúng số khách đã trả", () => {
    const odd = { ...paid, totalAmount: 1_000_001, depositAmount: 300_000 };
    for (const percent of [1, 33, 50, 99]) {
      const { refundAmount, ownerPayoutAmount } = previewAdminCancel(odd, percent);
      expect(refundAmount + ownerPayoutAmount).toBe(1_300_001);
    }
  });

  it("đơn chưa thanh toán: không có tiền nào để chia", () => {
    expect(previewAdminCancel({ ...paid, paidAt: null }, 100)).toEqual({ refundAmount: 0, ownerPayoutAmount: 0 });
  });
});
