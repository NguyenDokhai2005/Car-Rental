import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { ApiError } from "../common/api-error";
import { bookingStatusWhere, effectiveBookingStatus } from "../common/booking-holds";
import { PrismaService } from "../common/prisma/prisma.service";
import { BookingPresenter } from "../bookings/booking-presenter";
import { adminCancelSettlement } from "../bookings/booking-rules";
import { BOOKING_DETAIL_SELECT, BookingDetailView } from "../bookings/booking.view";
import type { ListBookingsQuery } from "../bookings/dto/list-bookings.query";
import type { Page } from "../vehicles/vehicle.view";
import { recordAdminAction } from "./admin-actions";

const ADMIN_BOOKING_SELECT = {
  ...BOOKING_DETAIL_SELECT,
  vehicle: { select: { ...BOOKING_DETAIL_SELECT.vehicle.select, owner: { select: { fullName: true, phone: true } } } },
} satisfies Prisma.BookingSelect;

type AdminBookingRow = Prisma.BookingGetPayload<{ select: typeof ADMIN_BOOKING_SELECT }>;

export type AdminBooking = BookingDetailView & { owner: { fullName: string; phone: string } };

// Sổ tiền của nền tảng: tiền khách đã trả, đã hoàn cho khách, đã ghi nhận cho chủ xe, và phần còn đang giữ hộ.
export type LedgerTotals = { paidAmount: number; refundAmount: number; ownerPayoutAmount: number; heldAmount: number };

@Injectable()
export class AdminBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: BookingPresenter,
  ) {}

  private toView({ vehicle: { owner, ...vehicle }, ...row }: AdminBookingRow, now: Date): AdminBooking {
    return { ...this.presenter.toDetail({ ...row, vehicle }, true, now), owner };
  }

  private async findOrThrow(bookingId: string): Promise<AdminBookingRow> {
    const row = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: ADMIN_BOOKING_SELECT });
    if (!row) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy đơn.");
    return row;
  }

  // Hủy đơn có tranh chấp (SPEC §4): pending còn hạn, confirmed hoặc in_use -> cancelled. Cùng khuôn với các lần chuyển
  // trạng thái khác: tiền và trạng thái ghi trong MỘT câu UPDATE có điều kiện đúng trạng thái và tình trạng thanh toán đã
  // dùng để tính tiền. Nếu khách vừa thanh toán hay hai bên vừa giao xe ngay lúc đó thì câu lệnh không khớp và admin nhận
  // 409 để xem lại đơn, thay vì hủy với số tiền tính trên trạng thái cũ.
  async cancel(adminId: string, bookingId: string, reason: string, rentalRefundPercent: number): Promise<AdminBooking> {
    const now = new Date();
    const current = await this.findOrThrow(bookingId);
    // Đã hủy rồi: trả lại nguyên trạng, không tính lại tiền và không ghi đè lý do.
    if (current.status === "cancelled") return this.toView(current, now);
    const status = effectiveBookingStatus(current.status, current.expiresAt, now);
    if (status !== "pending" && status !== "confirmed" && status !== "in_use") {
      throw new ApiError(409, "INVALID_STATE", "Chỉ hủy được đơn đang chờ, đã xác nhận hoặc đang thuê.");
    }

    const paid = current.paidAt !== null;
    const settlement = adminCancelSettlement({ paid, totalAmount: current.totalAmount, depositAmount: current.depositAmount }, rentalRefundPercent);
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.booking.updateMany({
        where: {
          id: bookingId,
          ...(status === "pending" ? { status: "pending", OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] } : { status }),
          paidAt: paid ? { not: null } : null,
        },
        data: { status: "cancelled", cancelledAt: now, cancelledById: adminId, cancelReason: reason, expiresAt: null, ...settlement },
      });
      if (result.count === 0) throw new ApiError(409, "INVALID_STATE", "Đơn vừa được cập nhật. Vui lòng tải lại và thử lại.");
      await recordAdminAction(tx, {
        adminId,
        action: "booking.cancel",
        target: { bookingId },
        reason,
        details: { previousStatus: status, rentalRefundPercent, ...settlement },
      });
    });
    return this.toView(await this.findOrThrow(bookingId), now);
  }

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
      items: rows.map((row) => this.toView(row, now)),
      total,
      page: query.page,
      limit: query.limit,
      totals: { paidAmount, refundAmount, ownerPayoutAmount, heldAmount: paidAmount - refundAmount - ownerPayoutAmount },
    };
  }
}
