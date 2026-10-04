const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type BusyPeriod = { startAt: string; endAt: string };

export function isMonth(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function currentMonth(now: Date = new Date()): string {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const index = year * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

// Bố cục lưới tháng (thứ Hai là cột đầu): số ô trống đầu tháng và số ngày của tháng.
export function monthGrid(month: string): { leadingBlanks: number; days: number } {
  const [year, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, m - 1, 1));
  return { leadingBlanks: (first.getUTCDay() + 6) % 7, days: new Date(Date.UTC(year, m, 0)).getUTCDate() };
}

// Các ngày (1..n) của tháng có ít nhất một khoảng bận giao với ngày đó, tính theo giờ Việt Nam.
// Khoảng bận là [startAt, endAt): ngày bắt đầu đúng 00:00 của ngày kế tiếp thì ngày kế tiếp vẫn trống.
export function busyDays(month: string, busy: BusyPeriod[]): Set<number> {
  const [year, m] = month.split("-").map(Number);
  const { days } = monthGrid(month);
  const result = new Set<number>();
  for (let day = 1; day <= days; day += 1) {
    const dayStart = Date.UTC(year, m - 1, day) - VN_OFFSET_MS;
    const dayEnd = dayStart + DAY_MS;
    if (busy.some((p) => Date.parse(p.startAt) < dayEnd && Date.parse(p.endAt) > dayStart)) result.add(day);
  }
  return result;
}
