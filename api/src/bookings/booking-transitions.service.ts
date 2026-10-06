import { Injectable } from "@nestjs/common";
import type { BookingStatus, Prisma } from "@prisma/client";
import { ApiError } from "../common/api-error";
import { effectiveBookingStatus } from "../common/booking-holds";
import { PrismaService } from "../common/prisma/prisma.service";
import { BookingPresenter } from "./booking-presenter";
import {
  AUTO_COMPLETE_HOURS,
  cancelSettlement,
  handoverProblem,
  ownerResponseDeadline,
  pickupPayout,
} from "./booking-rules";
import { BOOKING_DETAIL_SELECT, BookingDetailRow, BookingDetailView } from "./booking.view";

const STATUS_NAMES: Record<BookingStatus, string> = {
  pending: "đang chờ",
  confirmed: "đã được xác nhận",
  in_use: "đang trong thời gian thuê",
  completed: "đã hoàn tất",
  rejected: "đã bị từ chối",
  cancelled: "đã hủy",
  expired: "đã hết hạn",
};

function notFound(): ApiError {
  return new ApiError(404, "NOT_FOUND", "Không tìm thấy đơn.");
}

function invalidState(message: string): ApiError {
  return new ApiError(409, "INVALID_STATE", message);
}

function wrongState(action: string, status: BookingStatus): ApiError {
  return invalidState(`Không thể ${action} vì đơn ${STATUS_NAMES[status]}.`);
}

// Có người vừa thao tác trên đơn này giữa lúc đọc và lúc ghi (ví dụ chủ xe từ chối đúng lúc khách hủy).
function changedMeanwhile(): ApiError {
  return invalidState("Đơn vừa được cập nhật. Vui lòng tải lại và thử lại.");
}

// Đơn pending còn hạn tại thời điểm `now`. Phải nằm trong WHERE của câu UPDATE chứ không chỉ kiểm tra lúc đọc.
function livePending(now: Date): Prisma.BookingWhereInput {
  return { status: "pending", OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] };
}

type Side = "owner" | "renter";

// Các trạng thái mà một đơn đã thanh toán vẫn còn hiệu lực.
const PAID_AND_ALIVE: BookingStatus[] = ["pending", "confirmed", "in_use", "completed"];

// Các lần chuyển trạng thái của đơn và sổ tiền đi kèm (SPEC §2, §3, §4). Mỗi phương thức theo cùng một khuôn:
//   1. Đọc đơn kèm điều kiện quyền sở hữu (không thấy thì 404, không lộ sự tồn tại của đơn người khác).
//   2. Nếu đơn đã ở đúng trạng thái đích: trả lại nguyên trạng (gọi lặp lại vẫn thành công, không ghi đè, không tính tiền lần hai).
//   3. Nếu trạng thái hiện tại không cho phép: 409.
//   4. Ghi bằng UPDATE có điều kiện (trạng thái cũ, hạn giữ chỗ, đã thanh toán hay chưa, quyền sở hữu). Không dòng nào khớp
//      nghĩa là có người vừa đổi đơn giữa bước 1 và bước 4: đọc lại, nếu kết quả đã là điều mình muốn thì coi như thành công,
//      nếu không thì 409.
// Bước 4 là thứ bảo đảm hai thao tác đồng thời không ghi đè nhau và tiền không bị tính hai lần; các bước trước chỉ để trả
// thông báo lỗi rõ ràng. Mọi thay đổi về tiền nằm trong CÙNG câu UPDATE với thay đổi trạng thái, nên không có lúc nào trạng
// thái đã đổi mà tiền chưa ghi (hoặc ngược lại). CSDL còn có ràng buộc riêng chặn việc chi ra nhiều hơn số đã thu.
@Injectable()
export class BookingTransitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: BookingPresenter,
  ) {}

  private async findOrThrow(where: Prisma.BookingWhereInput): Promise<BookingDetailRow> {
    const row = await this.prisma.booking.findFirst({ where, select: BOOKING_DETAIL_SELECT });
    if (!row) throw notFound();
    return row;
  }

  // Đơn của chính khách này.
  private renterScope(renterId: string, bookingId: string): Prisma.BookingWhereInput {
    return { id: bookingId, renterId };
  }

  // Đơn trên xe của chủ xe này. Chỉ gồm đơn khách đã thanh toán: đơn chưa thanh toán chưa phải là một yêu cầu thật gửi tới
  // chủ xe, nên với họ nó không tồn tại (404).
  private ownerScope(ownerId: string, bookingId: string): Prisma.BookingWhereInput {
    return { id: bookingId, vehicle: { ownerId }, paidAt: { not: null } };
  }

  // ---- Thanh toán ----

  // Ghi nhận khách đã thanh toán tiền thuê + tiền cọc. Từ đây đồng hồ chuyển sang hạn chủ xe duyệt.
  // Hiện endpoint /pay gọi thẳng hàm này (thanh toán tức thì, SPEC §7). Khi có cổng thanh toán, IPN đã xác thực chữ ký sẽ là nơi
  // gọi; hàm đã an toàn khi bị gọi lặp lại nên IPN gửi nhiều lần cũng chỉ ghi nhận một lần.
  async pay(renterId: string, bookingId: string): Promise<BookingDetailView> {
    const scope = this.renterScope(renterId, bookingId);
    const now = new Date();
    const current = await this.findOrThrow(scope);

    const status = effectiveBookingStatus(current.status, current.expiresAt, now);
    // Đã thanh toán và đơn còn hiệu lực (đang chờ duyệt hoặc đã đi xa hơn): không thu lần hai. Đơn đã hủy, bị từ chối hay hết
    // hạn thì không coi là thành công, kể cả khi trước đó từng thanh toán.
    if (current.paidAt && PAID_AND_ALIVE.includes(status)) return this.presenter.toDetail(current, false, now);
    if (status !== "pending") throw wrongState("thanh toán", status);

    const result = await this.prisma.booking.updateMany({
      where: { ...scope, ...livePending(now), paidAt: null },
      data: {
        paidAt: now,
        paidAmount: current.totalAmount + current.depositAmount,
        expiresAt: ownerResponseDeadline(now, current.startAt),
      },
    });
    if (result.count === 0) {
      const latest = await this.findOrThrow(scope);
      if (latest.paidAt && PAID_AND_ALIVE.includes(effectiveBookingStatus(latest.status, latest.expiresAt, now))) {
        return this.presenter.toDetail(latest, false, now);
      }
      throw changedMeanwhile();
    }
    return this.presenter.toDetail(await this.findOrThrow(scope), false, now);
  }

  // ---- Chủ xe duyệt hoặc từ chối đơn đã thanh toán ----

  async approve(ownerId: string, bookingId: string): Promise<BookingDetailView> {
    const scope = this.ownerScope(ownerId, bookingId);
    const now = new Date();
    const current = await this.findOrThrow(scope);

    if (current.status === "confirmed") return this.presenter.toDetail(current, true, now);
    const status = effectiveBookingStatus(current.status, current.expiresAt, now);
    if (status !== "pending") throw wrongState("duyệt", status);

    const result = await this.prisma.booking.updateMany({
      where: { ...scope, ...livePending(now) },
      // Đã xác nhận thì không còn hạn giữ chỗ nào nữa.
      data: { status: "confirmed", ownerApprovedAt: now, expiresAt: null },
    });
    if (result.count === 0) {
      const latest = await this.findOrThrow(scope);
      if (latest.status === "confirmed") return this.presenter.toDetail(latest, true, now);
      throw changedMeanwhile();
    }
    return this.presenter.toDetail(await this.findOrThrow(scope), true, now);
  }

  // Từ chối: khách được hoàn toàn bộ số đã trả.
  async reject(ownerId: string, bookingId: string, reason: string): Promise<BookingDetailView> {
    const scope = this.ownerScope(ownerId, bookingId);
    const now = new Date();
    const current = await this.findOrThrow(scope);

    if (current.status === "rejected") return this.presenter.toDetail(current, true, now);
    const status = effectiveBookingStatus(current.status, current.expiresAt, now);
    if (status !== "pending") throw wrongState("từ chối", status);

    const result = await this.prisma.booking.updateMany({
      where: { ...scope, ...livePending(now) },
      data: { status: "rejected", rejectReason: reason, refundAmount: current.paidAmount },
    });
    if (result.count === 0) {
      const latest = await this.findOrThrow(scope);
      if (latest.status === "rejected") return this.presenter.toDetail(latest, true, now);
      throw changedMeanwhile();
    }
    return this.presenter.toDetail(await this.findOrThrow(scope), true, now);
  }

  // ---- Khách hủy ----

  // Hủy đơn pending (chưa hoặc đã thanh toán) hoặc confirmed. Tiền được chia theo chính sách tại thời điểm hủy.
  async cancel(renterId: string, bookingId: string): Promise<BookingDetailView> {
    const scope = this.renterScope(renterId, bookingId);
    const now = new Date();

    // Thử tối đa hai lần: nếu đơn đổi giữa lúc đọc và lúc ghi (ví dụ khoản thanh toán vừa được ghi nhận) thì tính lại tiền theo
    // trạng thái mới thay vì báo lỗi cho khách. Nếu lần thứ hai vẫn không được thì mới trả 409.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const current = await this.findOrThrow(scope);
      // Đã hủy rồi: trả lại nguyên trạng, không tính lại tiền (tính lại muộn hơn sẽ ra số khác).
      if (current.status === "cancelled") return this.presenter.toDetail(current, false, now);
      const status = effectiveBookingStatus(current.status, current.expiresAt, now);
      if (status !== "pending" && status !== "confirmed") throw wrongState("hủy", status);

      const paid = current.paidAt !== null;
      const settlement = cancelSettlement(
        { status, paid, totalAmount: current.totalAmount, depositAmount: current.depositAmount, startAt: current.startAt },
        now,
      );
      const result = await this.prisma.booking.updateMany({
        // Điều kiện đúng trạng thái VÀ đúng tình trạng thanh toán đã dùng để tính tiền. Nếu khách vừa thanh toán ở một tab khác,
        // câu lệnh này không khớp, và ta không hủy đơn với số tiền hoàn 0 trong khi khách đã trả tiền.
        where: {
          ...scope,
          ...(status === "pending" ? livePending(now) : { status: "confirmed" }),
          paidAt: paid ? { not: null } : null,
        },
        data: { status: "cancelled", cancelledAt: now, cancelledById: renterId, ...settlement },
      });
      if (result.count > 0) return this.presenter.toDetail(await this.findOrThrow(scope), false, now);
    }

    const latest = await this.findOrThrow(scope);
    if (latest.status === "cancelled") return this.presenter.toDetail(latest, false, now);
    throw changedMeanwhile();
  }

  // ---- Giao xe: cần cả chủ xe và khách xác nhận ----

  // Một bên xác nhận giao/nhận xe. Bên nào bấm trước cũng được. Khi đủ cả hai, đơn thành in_use và chủ xe được ghi nhận 50%
  // tiền thuê. Mỗi bên chỉ ghi được xác nhận của chính mình.
  private async confirmPickup(side: Side, scope: Prisma.BookingWhereInput): Promise<BookingDetailView> {
    const forOwner = side === "owner";
    const now = new Date();
    const current = await this.findOrThrow(scope);

    // Đã giao xong (hoặc đã đi xa hơn): gọi lại vẫn thành công.
    if (current.status === "in_use" || current.status === "completed") return this.presenter.toDetail(current, forOwner, now);
    if (current.status !== "confirmed") throw wrongState("xác nhận giao xe", effectiveBookingStatus(current.status, current.expiresAt, now));
    const problem = handoverProblem(current.startAt, current.endAt, now);
    if (problem) throw invalidState(problem);

    // Bước 1: ghi xác nhận của bên này (nếu chưa có).
    await this.prisma.booking.updateMany({
      where: { ...scope, status: "confirmed", ...(forOwner ? { ownerHandedOverAt: null } : { renterReceivedAt: null }) },
      data: forOwner ? { ownerHandedOverAt: now } : { renterReceivedAt: now },
    });
    // Bước 2: nếu đã đủ cả hai xác nhận thì chuyển trạng thái và ghi tiền, trong MỘT câu lệnh. Hai bên bấm cùng lúc thì cả hai
    // cùng chạy bước này, nhưng điều kiện status = confirmed chỉ khớp một lần, nên tiền chỉ được cộng đúng một lần.
    await this.prisma.booking.updateMany({
      where: { ...scope, status: "confirmed", ownerHandedOverAt: { not: null }, renterReceivedAt: { not: null } },
      data: { status: "in_use", startedAt: now, ownerPayoutAmount: pickupPayout(current.totalAmount) },
    });
    const latest = await this.findOrThrow(scope);
    // Đơn vừa bị hủy giữa lúc đọc và lúc ghi: không báo "đã xác nhận giao xe" cho một đơn không còn hiệu lực.
    if (latest.status !== "confirmed" && latest.status !== "in_use" && latest.status !== "completed") throw changedMeanwhile();
    return this.presenter.toDetail(latest, forOwner, now);
  }

  handover(ownerId: string, bookingId: string): Promise<BookingDetailView> {
    return this.confirmPickup("owner", this.ownerScope(ownerId, bookingId));
  }

  pickup(renterId: string, bookingId: string): Promise<BookingDetailView> {
    return this.confirmPickup("renter", this.renterScope(renterId, bookingId));
  }

  // ---- Trả xe: cũng cần cả hai bên xác nhận ----

  // Khi đủ cả hai, đơn hoàn tất: chủ xe được ghi nhận toàn bộ tiền thuê, khách được hoàn toàn bộ tiền cọc.
  private async confirmReturn(side: Side, scope: Prisma.BookingWhereInput): Promise<BookingDetailView> {
    const forOwner = side === "owner";
    const now = new Date();
    const current = await this.findOrThrow(scope);

    if (current.status === "completed") return this.presenter.toDetail(current, forOwner, now);
    if (current.status !== "in_use") throw wrongState("xác nhận trả xe", effectiveBookingStatus(current.status, current.expiresAt, now));

    await this.prisma.booking.updateMany({
      where: { ...scope, status: "in_use", ...(forOwner ? { ownerReceivedBackAt: null } : { renterReturnedAt: null }) },
      data: forOwner ? { ownerReceivedBackAt: now } : { renterReturnedAt: now },
    });
    await this.prisma.booking.updateMany({
      where: { ...scope, status: "in_use", renterReturnedAt: { not: null }, ownerReceivedBackAt: { not: null } },
      // Ghi số tuyệt đối (không cộng dồn): chạy lại cũng ra cùng kết quả.
      data: { status: "completed", completedAt: now, ownerPayoutAmount: current.totalAmount, refundAmount: current.depositAmount },
    });
    return this.presenter.toDetail(await this.findOrThrow(scope), forOwner, now);
  }

  returnVehicle(renterId: string, bookingId: string): Promise<BookingDetailView> {
    return this.confirmReturn("renter", this.renterScope(renterId, bookingId));
  }

  receiveBack(ownerId: string, bookingId: string): Promise<BookingDetailView> {
    return this.confirmReturn("owner", this.ownerScope(ownerId, bookingId));
  }

  // ---- Hệ thống (job mỗi phút) ----

  // Đổi mọi đơn pending quá hạn thành expired; đơn đã thanh toán thì hoàn 100% (refund_amount = paid_amount, với đơn chưa
  // thanh toán paid_amount là 0). Chỉ là việc dọn dẹp: lịch, trạng thái và số tiền hoàn hiển thị đã đúng mà không cần nó
  // (xem common/booking-holds.ts và booking-presenter.ts). Trả về số đơn đã đổi.
  async expireOverdue(now: Date = new Date()): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE bookings
      SET status = 'expired', refund_amount = paid_amount, updated_at = now()
      WHERE status = 'pending' AND expires_at < ${now}`;
  }

  // Tự hoàn tất đơn đang thuê đã quá giờ trả xe 24 giờ mà chưa đủ hai xác nhận, ghi tiền như khi trả xe bình thường. Không có
  // việc này thì chỉ cần một bên không bấm xác nhận là tiền cọc của khách và tiền thuê của chủ xe bị treo mãi.
  async autoComplete(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - AUTO_COMPLETE_HOURS * 60 * 60 * 1000);
    return this.prisma.$executeRaw`
      UPDATE bookings
      SET status = 'completed', completed_at = ${now}, owner_payout_amount = total_amount, refund_amount = deposit_amount,
          updated_at = now()
      WHERE status = 'in_use' AND end_at < ${cutoff}`;
  }
}
