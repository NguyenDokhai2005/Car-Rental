import { describe, expect, it } from "vitest";
import { summarizeEarnings } from "./earnings";
import type { OwnerBooking } from "./rules";

function booking(patch: Partial<OwnerBooking>): OwnerBooking {
  return {
    id: "b1",
    vehicleId: "v1",
    startAt: "2026-10-13T03:00:00.000Z",
    endAt: "2026-10-15T03:00:00.000Z",
    status: "pending",
    rentalDays: 2,
    pricePerDay: 500_000,
    totalAmount: 1_000_000,
    depositAmount: 300_000,
    payableAmount: 1_300_000,
    expiresAt: null,
    paidAt: "2026-10-10T03:00:00.000Z",
    paidAmount: 1_300_000,
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
    createdAt: "2026-10-10T03:00:00.000Z",
    vehicle: { id: "v1", title: "Toyota Vios 2022", city: "TP. Hồ Chí Minh", district: "Quận 7", coverUrl: null },
    renter: { fullName: "Nguyễn An", phone: "0900000001" },
    ownerPayoutAmount: 0,
    ...patch,
  };
}

describe("summarizeEarnings", () => {
  it("không có đơn: mọi con số bằng 0", () => {
    expect(summarizeEarnings([])).toEqual({ received: 0, onReturn: 0, upcoming: 0, activeTrips: 0, rows: [], vehicles: [] });
  });

  it("cộng số đã nhận từ API và tách phần sẽ nhận theo trạng thái đơn", () => {
    const summary = summarizeEarnings([
      booking({ id: "done", status: "completed", ownerPayoutAmount: 1_000_000 }),
      booking({ id: "trip", status: "in_use", ownerPayoutAmount: 500_000 }),
      booking({ id: "next", status: "confirmed" }),
      booking({ id: "wait", status: "pending" }),
    ]);

    expect(summary.received).toBe(1_500_000);
    expect(summary.onReturn).toBe(500_000);
    expect(summary.upcoming).toBe(1_000_000);
    expect(summary.activeTrips).toBe(1);
  });

  it("đơn đã hủy không còn khoản sẽ nhận, nhưng giữ khoản đã ghi nhận (khách hủy muộn)", () => {
    const summary = summarizeEarnings([booking({ status: "cancelled", ownerPayoutAmount: 500_000 })]);

    expect(summary.received).toBe(500_000);
    expect(summary.onReturn + summary.upcoming).toBe(0);
    expect(summary.rows[0]).toMatchObject({ remaining: 0, filter: "cancelled" });
  });

  it("xếp loại từng dòng để lọc: đã nhận, sẽ nhận khi trả xe, chưa có gì", () => {
    const { rows } = summarizeEarnings([
      booking({ id: "done", status: "completed", ownerPayoutAmount: 1_000_000 }),
      booking({ id: "trip", status: "in_use", ownerPayoutAmount: 500_000 }),
      booking({ id: "wait", status: "pending" }),
    ]);

    expect(rows.map((row) => row.filter)).toEqual(["received", "onReturn", null]);
  });

  it("chia tỷ trọng theo xe, xe thu nhiều đứng trước, bỏ xe chưa thu đồng nào", () => {
    const other = { id: "v2", title: "Mazda CX-5 2021", city: "TP. Hồ Chí Minh", district: "Quận 1", coverUrl: null };
    const { vehicles } = summarizeEarnings([
      booking({ id: "a", status: "completed", ownerPayoutAmount: 1_000_000 }),
      booking({ id: "b", status: "completed", ownerPayoutAmount: 3_000_000, vehicle: other }),
      booking({ id: "c", status: "confirmed", vehicle: { ...other, id: "v3", title: "Kia Seltos 2022" } }),
    ]);

    expect(vehicles).toEqual([
      { vehicleId: "v2", title: "Mazda CX-5 2021", received: 3_000_000, trips: 1, percent: 75 },
      { vehicleId: "v1", title: "Toyota Vios 2022", received: 1_000_000, trips: 1, percent: 25 },
    ]);
  });
});
