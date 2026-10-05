import type { BookingStatus, Prisma } from "@prisma/client";

// Một đơn pending giữ lịch xe trong thời hạn expires_at (15 phút khi tạo, đặt lại khi chủ xe duyệt). Hết hạn mà chưa thanh
// toán thì đơn phải nhả lịch. Có một job đổi các đơn đó thành expired, nhưng job có thể chạy chậm hoặc đang ngừng, nên mọi
// chỗ đọc và ghi lịch đều tự coi đơn quá hạn là KHÔNG còn giữ lịch. Job chỉ còn là việc dọn dẹp, không phải thứ quyết định
// lịch đúng hay sai.

// Điều kiện "đơn đang giữ lịch xe" tại thời điểm `now`, dùng cho mọi chỗ ĐỌC lịch (tìm xe theo ngày, lịch trống).
// Đơn pending không có expires_at (dữ liệu cũ, dữ liệu mẫu) vẫn được coi là đang giữ lịch.
export function holdingBookingWhere(now: Date): Prisma.BookingWhereInput {
  return {
    OR: [
      { status: { in: ["confirmed", "in_use"] } },
      { status: "pending", OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
    ],
  };
}

// Trạng thái của đơn như người dùng phải thấy tại thời điểm `now`: đơn pending đã quá hạn là "expired", dù CSDL còn ghi
// pending vì job chưa kịp đổi. Không có hàm này thì khách thấy đơn đã hết hạn của mình vẫn "chờ duyệt".
export function effectiveBookingStatus(status: BookingStatus, expiresAt: Date | null, now: Date): BookingStatus {
  return status === "pending" && expiresAt !== null && expiresAt < now ? "expired" : status;
}

// Điều kiện lọc đơn theo trạng thái NHƯ NGƯỜI DÙNG THẤY, khớp với effectiveBookingStatus: lọc "pending" không gồm đơn quá hạn,
// lọc "expired" gồm cả đơn quá hạn chưa được đổi trong CSDL. Nếu lọc thẳng theo cột status thì danh sách và bộ lọc lệch nhau.
export function bookingStatusWhere(status: BookingStatus, now: Date): Prisma.BookingWhereInput {
  if (status === "pending") return { status: "pending", OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] };
  if (status === "expired") return { OR: [{ status: "expired" }, { status: "pending", expiresAt: { lt: now } }] };
  return { status };
}

// Dùng ở chỗ GHI lịch (tạo đơn, chủ xe chặn ngày), sau khi đã lấy khóa theo xe: đổi hẳn các đơn pending quá hạn của xe này
// thành expired. Phải đổi thật chứ không chỉ bỏ qua khi đọc, vì ràng buộc chống trùng của CSDL (bookings_no_overlap) vẫn
// tính mọi đơn pending, và để không tồn tại một đơn pending nằm chồng lên lịch chặn hay đơn mới.
export async function releaseExpiredHolds(tx: Prisma.TransactionClient, vehicleId: string, now: Date): Promise<void> {
  await tx.booking.updateMany({
    where: { vehicleId, status: "pending", expiresAt: { lt: now } },
    data: { status: "expired" },
  });
}
