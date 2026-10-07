import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { bookingStatusWhere } from "../common/booking-holds";
import { PrismaService } from "../common/prisma/prisma.service";
import { BookingPresenter } from "../bookings/booking-presenter";
import { BOOKING_DETAIL_SELECT, BookingDetailView } from "../bookings/booking.view";
import type { ListBookingsQuery } from "../bookings/dto/list-bookings.query";
import type { Page } from "../vehicles/vehicle.view";

const ADMIN_BOOKING_SELECT = {
  ...BOOKING_DETAIL_SELECT,
  vehicle: { select: { ...BOOKING_DETAIL_SELECT.vehicle.select, owner: { select: { fullName: true, phone: true } } } },
} satisfies Prisma.BookingSelect;

export type AdminBooking = BookingDetailView & { owner: { fullName: string; phone: string } };

// Sổ tiền của nền tảng: tiền khách đã trả, đã hoàn cho khách, đã ghi nhận cho chủ xe, và phần còn đang giữ hộ.
export type LedgerTotals = { paidAmount: number; refundAmount: number; ownerPayoutAmount: number; heldAmount: number };

@Injectable()
export class AdminBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: BookingPresenter,
  ) {}

  async list(query: ListBookingsQuery): Promise<Page<AdminBooking> & { totals: LedgerTotals }> {
    const now = new Date();
    const where: Prisma.BookingWhereInput = query.status ? bookingStatusWhere(query.status, now) : {};
    const [rows, total, sums] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        select: ADMIN_BOOKING_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.booking.count({ where }),
      // Tổng tính trên mọi đơn, không theo bộ lọc: sổ tiền là của cả nền tảng chứ không của trang đang xem.
      this.prisma.booking.aggregate({ _sum: { paidAmount: true, refundAmount: true, ownerPayoutAmount: true } }),
    ]);

    const paidAmount = sums._sum.paidAmount ?? 0;
    const refundAmount = sums._sum.refundAmount ?? 0;
    const ownerPayoutAmount = sums._sum.ownerPayoutAmount ?? 0;
    return {
      items: rows.map(({ vehicle: { owner, ...vehicle }, ...row }) => ({
        ...this.presenter.toDetail({ ...row, vehicle }, true, now),
        owner,
      })),
      total,
      page: query.page,
      limit: query.limit,
      totals: { paidAmount, refundAmount, ownerPayoutAmount, heldAmount: paidAmount - refundAmount - ownerPayoutAmount },
    };
  }
}
