import { Injectable } from "@nestjs/common";
import { holdingBookingWhere } from "../common/booking-holds";
import { ApiError } from "../common/api-error";
import { PrismaService } from "../common/prisma/prisma.service";
import type { BusyPeriod, OwnerBusyPeriod } from "./vehicle.view";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Ho_Chi_Minh là UTC+7, không có giờ mùa hè

export type MonthWindow = { month: string; from: Date; to: Date };

// Tháng tính theo giờ Việt Nam: "2026-10" là từ 00:00 ngày 1/10 đến trước 00:00 ngày 1/11 theo giờ Việt Nam.
export function monthWindow(month: string | undefined, now: Date = new Date()): MonthWindow {
  const current = new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 7);
  const value = month ?? current;
  const [year, monthNumber] = value.split("-").map(Number);
  const from = new Date(Date.UTC(year, monthNumber - 1, 1) - VN_OFFSET_MS);
  const to = new Date(Date.UTC(year, monthNumber, 1) - VN_OFFSET_MS);
  return { month: value, from, to };
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  // Công khai: chỉ xe đã duyệt. Không phân biệt đơn với lịch chặn và không lộ người thuê.
  async publicAvailability(vehicleId: string, month: string | undefined) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, status: "approved" },
      select: { id: true },
    });
    if (!vehicle) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy xe.");

    const window = monthWindow(month);
    const busy: BusyPeriod[] = (await this.busyPeriods(vehicleId, window)).map(({ startAt, endAt }) => ({
      startAt,
      endAt,
    }));
    return { vehicleId, month: window.month, busy };
  }

  // Cho chủ xe: có phân biệt "đã có đơn" và "bạn chặn". Quyền sở hữu do service gọi kiểm tra trước.
  async ownerCalendar(vehicleId: string, month: string | undefined) {
    const window = monthWindow(month);
    return { vehicleId, month: window.month, busy: await this.busyPeriods(vehicleId, window) };
  }

  private async busyPeriods(vehicleId: string, window: MonthWindow): Promise<OwnerBusyPeriod[]> {
    // Khoảng giao với tháng: bắt đầu trước hết tháng và kết thúc sau đầu tháng.
    const overlapsMonth = { startAt: { lt: window.to }, endAt: { gt: window.from } };

    const [bookings, blocks] = await Promise.all([
      this.prisma.booking.findMany({
        where: { vehicleId, ...holdingBookingWhere(new Date()), ...overlapsMonth },
        select: { startAt: true, endAt: true },
      }),
      this.prisma.vehicleBlock.findMany({
        where: { vehicleId, ...overlapsMonth },
        select: { startAt: true, endAt: true },
      }),
    ]);

    return [
      ...bookings.map((b) => ({ ...b, kind: "booked" as const })),
      ...blocks.map((b) => ({ ...b, kind: "blocked" as const })),
    ].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }
}
