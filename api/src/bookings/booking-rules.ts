// Quy tắc nghiệp vụ của đơn thuê (SPEC §4), viết thành hàm thuần để test kỹ mà không cần CSDL.

export const DAY_MS = 24 * 60 * 60 * 1000;

export const MIN_RENTAL_DAYS = 1;
export const MAX_RENTAL_DAYS = 30;
// Chỉ nhận đơn bắt đầu trong vòng này kể từ lúc đặt, để không ai giữ một xe cho một ngày quá xa.
export const MAX_ADVANCE_DAYS = 365;
// Hai thời hạn giữ lịch khác nhau của một đơn pending (SPEC §2):
//   1. Chờ chủ xe duyệt: 6 giờ kể từ lúc tạo đơn. Chủ xe là người thật, không thể đòi họ trả lời trong vài phút.
//   2. Chờ khách thanh toán cọc: 15 phút kể từ lúc chủ xe duyệt. Khách đang chủ động đặt xe nên hạn ngắn là hợp lý, và
//      không để một đơn đã duyệt giữ xe lâu mà không trả tiền.
export const OWNER_RESPONSE_HOURS = 6;
export const PAYMENT_HOLD_MINUTES = 15;
// Số đơn pending tối đa mỗi khách được có cùng lúc.
export const MAX_PENDING_PER_RENTER = 3;

// Cột total_amount là INTEGER 32 bit trong CSDL.
export const INT4_MAX = 2_147_483_647;

// Số ngày thuê, làm tròn LÊN theo 24 giờ: đúng 24 giờ là 1 ngày, hơn 24 giờ dù chỉ 1 mili giây là 2 ngày.
export function rentalDays(startAt: Date, endAt: Date): number {
  return Math.ceil((endAt.getTime() - startAt.getTime()) / DAY_MS);
}

// Hạn chủ xe phải duyệt hoặc từ chối đơn: 6 giờ kể từ lúc tạo, nhưng không muộn hơn giờ nhận xe. Đặt xe nhận sau 2 giờ nữa
// thì hạn là 2 giờ: một đơn chưa được duyệt không thể vẫn "chờ duyệt" và giữ lịch khi chuyến đi đã bắt đầu.
export function ownerResponseDeadline(now: Date, startAt: Date): Date {
  const byWindow = now.getTime() + OWNER_RESPONSE_HOURS * 60 * 60 * 1000;
  return new Date(Math.min(byWindow, startAt.getTime()));
}

// Tiền theo VND, số nguyên. deposit = tỷ lệ cọc của xe (phần trăm) x tổng tiền, làm tròn VND.
export function quote(pricePerDay: number, depositRate: number, days: number): { totalAmount: number; depositAmount: number } {
  const totalAmount = pricePerDay * days;
  const depositAmount = Math.round((totalAmount * depositRate) / 100);
  return { totalAmount, depositAmount };
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
