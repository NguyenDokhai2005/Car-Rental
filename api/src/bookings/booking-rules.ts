// Quy tắc nghiệp vụ của đơn thuê (SPEC §4), viết thành hàm thuần để test kỹ mà không cần CSDL.

export const DAY_MS = 24 * 60 * 60 * 1000;

export const MIN_RENTAL_DAYS = 1;
export const MAX_RENTAL_DAYS = 30;
// Chỉ nhận đơn bắt đầu trong vòng này kể từ lúc đặt, để không ai giữ một xe cho một ngày quá xa.
export const MAX_ADVANCE_DAYS = 365;
// Hai thời hạn giữ lịch nối tiếp nhau của một đơn pending (SPEC §2):
//   1. Chờ khách thanh toán: 15 phút kể từ lúc tạo đơn. Khách đang ở ngay trên ứng dụng nên hạn ngắn là hợp lý, và không để
//      một đơn chưa trả tiền giữ xe lâu.
//   2. Chờ chủ xe duyệt: 6 giờ kể từ lúc khách thanh toán. Chủ xe là người thật, không thể đòi họ trả lời trong vài phút.
export const PAYMENT_HOLD_MINUTES = 15;
export const OWNER_RESPONSE_HOURS = 6;
// Số đơn pending tối đa mỗi khách được có cùng lúc.
export const MAX_PENDING_PER_RENTER = 3;

// Cột total_amount là INTEGER 32 bit trong CSDL.
export const INT4_MAX = 2_147_483_647;

// Số ngày thuê, làm tròn LÊN theo 24 giờ: đúng 24 giờ là 1 ngày, hơn 24 giờ dù chỉ 1 mili giây là 2 ngày.
export function rentalDays(startAt: Date, endAt: Date): number {
  return Math.ceil((endAt.getTime() - startAt.getTime()) / DAY_MS);
}

// Hạn khách phải thanh toán sau khi tạo đơn: 15 phút, nhưng không muộn hơn giờ nhận xe.
export function paymentDeadline(now: Date, startAt: Date): Date {
  return new Date(Math.min(now.getTime() + PAYMENT_HOLD_MINUTES * 60_000, startAt.getTime()));
}

// Hạn chủ xe phải duyệt hoặc từ chối đơn đã thanh toán: 6 giờ kể từ lúc thanh toán, nhưng không muộn hơn giờ nhận xe. Một đơn
// chưa được duyệt không thể vẫn "chờ duyệt" và giữ lịch khi chuyến đi đã bắt đầu.
export function ownerResponseDeadline(now: Date, startAt: Date): Date {
  const byWindow = now.getTime() + OWNER_RESPONSE_HOURS * 60 * 60 * 1000;
  return new Date(Math.min(byWindow, startAt.getTime()));
}

// Tiền theo VND, số nguyên (SPEC §4).
//   totalAmount:   tiền thuê.
//   depositAmount: tiền cọc bảo đảm = tỷ lệ cọc của xe (phần trăm) x tiền thuê, làm tròn VND. Thu THÊM ngoài tiền thuê, ứng dụng
//                  giữ và hoàn cho khách khi trả xe.
//   payableAmount: số khách phải trả một lần khi đặt = tiền thuê + tiền cọc.
export function quote(
  pricePerDay: number,
  depositRate: number,
  days: number,
): { totalAmount: number; depositAmount: number; payableAmount: number } {
  const totalAmount = pricePerDay * days;
  const depositAmount = Math.round((totalAmount * depositRate) / 100);
  return { totalAmount, depositAmount, payableAmount: totalAmount + depositAmount };
}

// Trả thông báo lỗi (tiếng Việt, cho người dùng) nếu khoảng thời gian thuê không hợp lệ; null nếu hợp lệ.
export function rangeProblem(startAt: Date, endAt: Date, now: Date): string | null {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return "Thời gian không hợp lệ.";
  if (endAt <= startAt) return "Thời gian trả xe phải sau thời gian nhận xe.";
  if (startAt <= now) return "Thời gian nhận xe phải ở tương lai.";
  if (startAt.getTime() - now.getTime() > MAX_ADVANCE_DAYS * DAY_MS) {
    return `Chỉ nhận đơn bắt đầu trong vòng ${MAX_ADVANCE_DAYS} ngày tới.`;
  }
  const days = rentalDays(startAt, endAt);
  if (days < MIN_RENTAL_DAYS || days > MAX_RENTAL_DAYS) {
    return `Thời gian thuê phải từ ${MIN_RENTAL_DAYS} đến ${MAX_RENTAL_DAYS} ngày.`;
  }
  return null;
}

// Chính sách hoàn tiền thuê khi khách hủy đơn đã được xác nhận (SPEC §4), theo số giờ còn lại tới giờ nhận xe lúc hủy.
export const FULL_REFUND_HOURS = 48;
export const HALF_REFUND_HOURS = 24;

export type Settlement = { refundAmount: number; ownerPayoutAmount: number };

// Chia tiền khi khách hủy đơn. Tiền cọc luôn về khách (xe chưa được giao). Tiền thuê:
//   pending chưa thanh toán: không có tiền nào để chia.
//   pending đã thanh toán (chủ xe chưa duyệt): hoàn 100%.
//   confirmed: còn từ 48 giờ hoàn 100%; từ 24 đến dưới 48 giờ hoàn 50%; dưới 24 giờ không hoàn. Phần tiền thuê không hoàn
//              thuộc về chủ xe (họ đã giữ xe cho khách và có thể đã từ chối khách khác).
// Luôn bảo đảm refundAmount + ownerPayoutAmount = số khách đã trả: không đồng nào bị bỏ lơ lửng.
export function cancelSettlement(
  booking: { status: "pending" | "confirmed"; paid: boolean; totalAmount: number; depositAmount: number; startAt: Date },
  now: Date,
): Settlement {
  if (!booking.paid) return { refundAmount: 0, ownerPayoutAmount: 0 };
  const everything = booking.totalAmount + booking.depositAmount;
  if (booking.status === "pending") return { refundAmount: everything, ownerPayoutAmount: 0 };

  const hoursLeft = (booking.startAt.getTime() - now.getTime()) / (60 * 60 * 1000);
  const rentalRefund =
    hoursLeft >= FULL_REFUND_HOURS ? booking.totalAmount : hoursLeft >= HALF_REFUND_HOURS ? Math.round(booking.totalAmount / 2) : 0;
  return { refundAmount: booking.depositAmount + rentalRefund, ownerPayoutAmount: booking.totalAmount - rentalRefund };
}

// Phần tiền thuê ghi nhận cho chủ xe ngay khi hai bên xác nhận giao xe: 50%, làm tròn xuống. Phần còn lại ghi nhận khi trả xe,
// nên tổng hai lần luôn đúng bằng tiền thuê dù tiền thuê là số lẻ.
export function pickupPayout(totalAmount: number): number {
  return Math.floor(totalAmount / 2);
}

// Đơn đang thuê mà sau giờ trả xe chừng này vẫn chưa đủ hai xác nhận trả xe thì hệ thống tự hoàn tất, để tiền cọc của khách và
// tiền thuê của chủ xe không bị treo vì một bên quên (hoặc cố tình không) bấm xác nhận.
export const AUTO_COMPLETE_HOURS = 24;

// Chủ xe được bấm "giao xe" sớm nhất bao lâu trước giờ nhận xe. Khách có thể đến sớm một chút; nhưng bấm nhầm trước cả tuần
// thì không hợp lý và sẽ làm sai trạng thái đơn.
export const EARLY_HANDOVER_MINUTES = 60;

// Thông báo lỗi nếu chưa tới (hoặc đã qua) khung giờ được giao xe; null nếu được phép.
export function handoverProblem(startAt: Date, endAt: Date, now: Date): string | null {
  if (now.getTime() < startAt.getTime() - EARLY_HANDOVER_MINUTES * 60_000) {
    return `Chỉ xác nhận giao xe được từ ${EARLY_HANDOVER_MINUTES} phút trước giờ nhận xe.`;
  }
  if (now >= endAt) return "Đã qua thời gian thuê của đơn này.";
  return null;
}
