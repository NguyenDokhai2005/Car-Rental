import { bookingStatusWhere, effectiveBookingStatus } from "./booking-holds";

const NOW = new Date("2026-10-10T00:00:00Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);

describe("effectiveBookingStatus", () => {
  it("đơn pending quá hạn hiện là expired", () => {
    expect(effectiveBookingStatus("pending", at(-1), NOW)).toBe("expired");
  });

  it("đơn pending còn hạn, hoặc hết hạn đúng lúc này, vẫn là pending (khớp với điều kiện giữ lịch)", () => {
    expect(effectiveBookingStatus("pending", at(1), NOW)).toBe("pending");
    expect(effectiveBookingStatus("pending", at(0), NOW)).toBe("pending");
  });

  it("đơn pending không có hạn (dữ liệu cũ) vẫn là pending", () => {
    expect(effectiveBookingStatus("pending", null, NOW)).toBe("pending");
  });

  it.each(["confirmed", "in_use", "completed", "cancelled", "rejected", "expired"] as const)(
    "trạng thái %s không bị đổi dù expires_at đã qua",
    (status) => {
      expect(effectiveBookingStatus(status, at(-60_000), NOW)).toBe(status);
    },
  );
});

describe("bookingStatusWhere", () => {
  it("pending: chỉ đơn còn hạn hoặc không có hạn", () => {
    expect(bookingStatusWhere("pending", NOW)).toEqual({
      status: "pending",
      OR: [{ expiresAt: null }, { expiresAt: { gte: NOW } }],
    });
  });

  it("expired: đơn đã đổi thành expired và đơn pending quá hạn", () => {
    expect(bookingStatusWhere("expired", NOW)).toEqual({
      OR: [{ status: "expired" }, { status: "pending", expiresAt: { lt: NOW } }],
    });
  });

  it("các trạng thái khác lọc thẳng theo cột status", () => {
    expect(bookingStatusWhere("confirmed", NOW)).toEqual({ status: "confirmed" });
  });
});
