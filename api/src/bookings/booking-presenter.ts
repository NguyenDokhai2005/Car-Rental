import { Injectable } from "@nestjs/common";
import { effectiveBookingStatus } from "../common/booking-holds";
import { StorageService } from "../storage/storage.service";
import type { BookingDetailRow, BookingDetailView, BookingRow, BookingView } from "./booking.view";

// Đổi dòng dữ liệu của đơn thành dữ liệu trả cho client. Gom về một chỗ để mọi endpoint (tạo, xem, thanh toán, duyệt, hủy...)
// trả cùng một dạng và cùng tuân theo các quy tắc:
//   - `status` là trạng thái người dùng phải thấy: đơn pending quá hạn là expired dù job chưa đổi trong CSDL.
//   - `refundAmount` cũng vậy: đơn đã thanh toán mà quá hạn thì khách được hoàn toàn bộ, dù job chưa ghi con số đó.
//   - renterId và ownerId chỉ dùng nội bộ để kiểm tra quyền, không bao giờ trả ra.
@Injectable()
export class BookingPresenter {
  constructor(private readonly storage: StorageService) {}

  toView({ vehicle, ...fields }: BookingRow, now: Date = new Date()): BookingView {
    const { images, ...summary } = vehicle;
    const status = effectiveBookingStatus(fields.status, fields.expiresAt, now);
    const expiredButNotYetProcessed = status === "expired" && fields.status === "pending";
    return {
      ...fields,
      status,
      refundAmount: expiredButNotYetProcessed ? fields.paidAmount : fields.refundAmount,
      payableAmount: fields.totalAmount + fields.depositAmount,
      vehicle: { ...summary, coverUrl: images[0] ? this.storage.publicUrl(images[0].storageKey) : null },
    };
  }

  // `forOwnerSide`: chủ xe và admin được thấy tên, số điện thoại của khách và số tiền đã ghi nhận cho chủ xe.
  toDetail(row: BookingDetailRow, forOwnerSide: boolean, now: Date = new Date()): BookingDetailView {
    const { renterId: _renterId, renter, ownerPayoutAmount, vehicle: { ownerId: _ownerId, ...vehicle }, ...fields } = row;
    const view = this.toView({ ...fields, vehicle }, now);
    return forOwnerSide ? { ...view, renter, ownerPayoutAmount } : view;
  }
}
