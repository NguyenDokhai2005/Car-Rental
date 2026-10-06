import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { ApiError } from "../common/api-error";
import type { AuthUser } from "../common/decorators/current-user.decorator";
import { bookingStatusWhere, releaseExpiredHolds } from "../common/booking-holds";
import { isExclusionViolation } from "../common/db-errors";
import { PrismaService } from "../common/prisma/prisma.service";
import { lockRenter, lockVehicle } from "../common/vehicle-lock";
import type { Page } from "../vehicles/vehicle.view";
import { BookingPresenter } from "./booking-presenter";
import { MAX_PENDING_PER_RENTER, paymentDeadline, quote, rangeProblem, rentalDays } from "./booking-rules";
import { BOOKING_DETAIL_SELECT, BOOKING_SELECT, BookingDetailRow, BookingDetailView, BookingView } from "./booking.view";
import type { CreateBookingDto } from "./dto/create-booking.dto";
import type { ListBookingsQuery } from "./dto/list-bookings.query";

function overlap(): ApiError {
  return new ApiError(409, "BOOKING_OVERLAP", "Xe không còn trống trong khoảng thời gian này. Vui lòng chọn thời gian khác.");
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: BookingPresenter,
  ) {}

  // Tạo đơn. Hai lớp bảo vệ chống đặt trùng, đúng như SPEC §4:
  //  1. Đơn với đơn: do ràng buộc EXCLUDE bookings_no_overlap của CSDL quyết định. Code KHÔNG tự kiểm tra rồi mới ghi (hai
  //     yêu cầu cùng thấy "còn trống" rồi cùng ghi), mà cứ ghi và bắt lỗi vi phạm ràng buộc thành 409.
  //  2. Đơn với lịch chặn của chủ xe: hai bảng khác nhau nên EXCLUDE không bắt được. Lấy khóa tư vấn theo xe rồi kiểm tra bảng
  //     lịch chặn trong cùng giao dịch (cách lịch chặn cũng làm theo chiều ngược lại ở owner-vehicles.service).
  async create(renterId: string, dto: CreateBookingDto): Promise<BookingView> {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    const now = new Date();

    const problem = rangeProblem(startAt, endAt, now);
    if (problem) throw new ApiError(400, "VALIDATION_ERROR", problem);

    const renter = await this.prisma.user.findUnique({ where: { id: renterId }, select: { licenseStatus: true } });
    if (renter?.licenseStatus !== "verified") {
      throw new ApiError(403, "LICENSE_NOT_VERIFIED", "Bạn cần được xác minh giấy phép lái xe trước khi đặt xe.");
    }

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        // Thứ tự khóa cố định (khách, rồi xe) để không bao giờ chờ vòng tròn lẫn nhau.
        await lockRenter(tx, renterId);
        await lockVehicle(tx, dto.vehicleId);

        // Gửi lại đúng yêu cầu cũ (bấm "Đặt xe" hai lần, hoặc mạng rớt sau khi đơn đã được tạo rồi trình duyệt gửi lại): trả lại
        // đơn đã có thay vì báo "xe không còn trống" vì chính đơn của người này đang chiếm chỗ. Chỉ khớp khi cùng khách, cùng
        // xe, cùng đúng khoảng thời gian và đơn còn hạn. Khóa theo khách ở trên bảo đảm hai yêu cầu giống nhau gửi cùng lúc
        // được xử lý lần lượt, nên yêu cầu thứ hai luôn thấy đơn của yêu cầu thứ nhất.
        const duplicate = await tx.booking.findFirst({
          where: { renterId, vehicleId: dto.vehicleId, startAt, endAt, status: "pending", expiresAt: { gte: now } },
          select: BOOKING_SELECT,
        });
        if (duplicate) return duplicate;

        const vehicle = await tx.vehicle.findFirst({
          where: { id: dto.vehicleId, status: "approved" },
          select: { id: true, pricePerDay: true, depositRate: true },
        });
        if (!vehicle) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy xe.");

        // Đơn pending đã quá hạn giữ chỗ mà job nhả lịch chưa kịp chạy vẫn đang chiếm lịch (và chiếm chỗ trong ràng buộc
        // chống trùng). Nhả chúng ngay tại đây, dưới khóa của xe, để một đơn đã hết hạn không chặn người đặt kế tiếp.
        await releaseExpiredHolds(tx, vehicle.id, now);

        const pending = await tx.booking.count({ where: { renterId, status: "pending", expiresAt: { gte: now } } });
        if (pending >= MAX_PENDING_PER_RENTER) {
          throw new ApiError(
            409,
            "PENDING_LIMIT",
            `Bạn đang có ${MAX_PENDING_PER_RENTER} đơn chờ duyệt. Hãy đợi chủ xe phản hồi hoặc hủy bớt rồi đặt thêm.`,
          );
        }

        const blocked = await tx.vehicleBlock.findFirst({
          where: { vehicleId: vehicle.id, startAt: { lt: endAt }, endAt: { gt: startAt } },
          select: { id: true },
        });
        if (blocked) throw overlap();

        const days = rentalDays(startAt, endAt);
        const { totalAmount, depositAmount } = quote(vehicle.pricePerDay, vehicle.depositRate, days);
        return tx.booking.create({
          data: {
            renterId,
            vehicleId: vehicle.id,
            startAt,
            endAt,
            rentalDays: days,
            pricePerDay: vehicle.pricePerDay, // chụp giá lúc đặt: chủ xe đổi giá sau đó không làm đổi đơn đã tạo
            totalAmount,
            depositAmount,
            expiresAt: paymentDeadline(now, startAt), // hạn khách thanh toán: 15 phút, không muộn hơn giờ nhận xe
          },
          select: BOOKING_SELECT,
        });
      });
      return this.presenter.toView(row);
    } catch (error) {
      if (isExclusionViolation(error, "bookings_no_overlap")) throw overlap();
      throw error;
    }
  }

  async list(renterId: string, query: ListBookingsQuery): Promise<Page<BookingView>> {
    const now = new Date();
    const where: Prisma.BookingWhereInput = { renterId, ...(query.status ? bookingStatusWhere(query.status, now) : {}) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        select: BOOKING_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items: rows.map((row) => this.presenter.toView(row, now)), total, page: query.page, limit: query.limit };
  }

  // Khách xem đơn của mình, chủ xe xem đơn trên xe của mình, admin xem mọi đơn. Người khác nhận 404 như đơn không tồn tại,
  // để không lộ sự tồn tại của đơn (SPEC §7). Thông tin liên hệ khách chỉ trả cho chủ xe và admin.
  async getOne(user: AuthUser, bookingId: string): Promise<BookingDetailView> {
    const row: BookingDetailRow | null = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: BOOKING_DETAIL_SELECT,
    });

    const isRenter = row?.renterId === user.id;
    // Chủ xe chỉ thấy đơn khách đã thanh toán: đơn chưa thanh toán chưa phải là một yêu cầu thật gửi tới họ.
    const isOwner = row?.vehicle.ownerId === user.id && row.paidAt !== null;
    const isAdmin = user.role === "admin";
    if (!row || !(isRenter || isOwner || isAdmin)) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy đơn.");

    return this.presenter.toDetail(row, isOwner || isAdmin);
  }

  // Đơn trên các xe của một chủ xe. Điều kiện ownerId nằm trong WHERE (qua quan hệ với xe) nên không bao giờ lẫn đơn trên xe của
  // người khác. Chủ xe cần liên hệ khách để giao xe nên được thấy tên và số điện thoại của khách.
  async listForOwner(ownerId: string, query: ListBookingsQuery): Promise<Page<BookingDetailView>> {
    const now = new Date();
    const where: Prisma.BookingWhereInput = {
      vehicle: { ownerId },
      paidAt: { not: null }, // chỉ đơn khách đã thanh toán (xem getOne)
      ...(query.status ? bookingStatusWhere(query.status, now) : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        select: BOOKING_DETAIL_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items: rows.map((row) => this.presenter.toDetail(row, true, now)), total, page: query.page, limit: query.limit };
  }
}
