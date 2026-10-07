import type { OwnerBooking } from "./rules";

export type EarningsFilter = "all" | "received" | "onReturn" | "cancelled";

export type EarningRow = {
  booking: OwnerBooking;
  received: number;
  // Phần tiền thuê chủ xe còn được nhận nếu đơn đi tiếp tới lúc trả xe; 0 với đơn đã kết thúc.
  remaining: number;
  filter: Exclude<EarningsFilter, "all"> | null;
};

export type VehicleShare = { vehicleId: string; title: string; received: number; trips: number; percent: number };

export type EarningsSummary = {
  received: number;
  onReturn: number;
  upcoming: number;
  activeTrips: number;
  rows: EarningRow[];
  vehicles: VehicleShare[];
};

// Tổng hợp thu nhập từ danh sách đơn. Số đã nhận lấy nguyên từ API (`ownerPayoutAmount`); phần "sẽ nhận" chỉ là ước tính
// để chủ xe theo dõi, vì đơn còn có thể bị hủy.
export function summarizeEarnings(bookings: OwnerBooking[]): EarningsSummary {
  const rows: EarningRow[] = bookings.map((booking) => {
    const received = booking.ownerPayoutAmount;
    const open = booking.status === "confirmed" || booking.status === "in_use";
    const ended = booking.status === "cancelled" || booking.status === "rejected" || booking.status === "expired";
    const filter = ended ? "cancelled" : booking.status === "in_use" ? "onReturn" : received > 0 ? "received" : null;
    return { booking, received, remaining: open ? booking.totalAmount - received : 0, filter };
  });

  const sum = (items: EarningRow[], pick: (row: EarningRow) => number) => items.reduce((total, row) => total + pick(row), 0);
  const inUse = rows.filter((row) => row.booking.status === "in_use");
  const confirmed = rows.filter((row) => row.booking.status === "confirmed");
  const received = sum(rows, (row) => row.received);

  const byVehicle = new Map<string, VehicleShare>();
  for (const row of rows) {
    if (row.received === 0) continue;
    const { id, title } = row.booking.vehicle;
    const share = byVehicle.get(id) ?? { vehicleId: id, title, received: 0, trips: 0, percent: 0 };
    share.received += row.received;
    share.trips += 1;
    byVehicle.set(id, share);
  }
  const vehicles = [...byVehicle.values()]
    .map((share) => ({ ...share, percent: received > 0 ? Math.round((share.received / received) * 100) : 0 }))
    .sort((a, b) => b.received - a.received);

  return {
    received,
    onReturn: sum(inUse, (row) => row.remaining),
    upcoming: sum(confirmed, (row) => row.remaining),
    activeTrips: inUse.length,
    rows,
    vehicles,
  };
}
