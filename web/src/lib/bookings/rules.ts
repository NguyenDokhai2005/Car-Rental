import { formatVnd } from "@/lib/cars";

// Phần "nghĩ" của giao diện đơn thuê, viết thành hàm thuần (không gọi API, không đụng React) để test được: với một đơn và
// thời điểm hiện tại, người dùng thấy nhãn gì, lời nhắc gì và được bấm nút nào.
//
// Đây chỉ là lớp hiển thị. Quy tắc thật nằm ở API (api/src/bookings/booking-rules.ts): nút bị ẩn ở đây không ngăn được ai gọi
// thẳng API, và nút hiện ở đây vẫn có thể bị API từ chối (409) nếu đơn vừa đổi. Các hằng số dưới đây phải khớp với API.

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
const VN_OFFSET_MS = 7 * HOUR_MS;

export const MAX_RENTAL_DAYS = 30;
export const MAX_ADVANCE_DAYS = 365;
export const EARLY_HANDOVER_MINUTES = 60;
export const FULL_REFUND_HOURS = 48;
export const HALF_REFUND_HOURS = 24;

export type BookingStatus = "pending" | "confirmed" | "in_use" | "completed" | "rejected" | "cancelled" | "expired";

// Khớp BookingView của API (api/src/bookings/booking.view.ts).
export type Booking = {
  id: string;
  vehicleId: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  rentalDays: number;
  pricePerDay: number;
  totalAmount: number;
  depositAmount: number;
  payableAmount: number;
  expiresAt: string | null;
  paidAt: string | null;
  paidAmount: number;
  ownerApprovedAt: string | null;
  rejectReason: string | null;
  ownerHandedOverAt: string | null;
  renterReceivedAt: string | null;
  startedAt: string | null;
  renterReturnedAt: string | null;
  ownerReceivedBackAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  refundAmount: number;
  createdAt: string;
  vehicle: { id: string; title: string; city: string; district: string; coverUrl: string | null };
};

// Chủ xe còn thấy thông tin liên hệ khách và số tiền đã ghi nhận cho mình.
export type OwnerBooking = Booking & { renter: { fullName: string; phone: string }; ownerPayoutAmount: number };

// ---- Thời gian: người dùng nhập và đọc theo giờ Việt Nam, API nhận và trả UTC ----

// Giá trị cho <input type="datetime-local"> (yyyy-mm-ddThh:mm) theo giờ Việt Nam.
export function toVnInput(date: Date): string {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 16);
}

// Đổi giá trị của <input type="datetime-local"> thành chuỗi ISO có múi giờ để gửi API; null nếu không hợp lệ.
export function fromVnInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const iso = `${value}:00+07:00`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

// "12/10/2026, 09:00" theo giờ Việt Nam.
export function formatVnDateTime(iso: string): string {
  const [date, time] = new Date(Date.parse(iso) + VN_OFFSET_MS).toISOString().slice(0, 16).split("T");
  return `${date.split("-").reverse().join("/")}, ${time}`;
}

// Đồng hồ đếm ngược cho trang thanh toán: "14:32".
export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

// Thời gian còn lại dạng chữ cho danh sách: "14 phút", "5 giờ 12 phút".
export function formatRemaining(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `${minutes} phút`;
  const rest = minutes % 60;
  return rest === 0 ? `${Math.floor(minutes / 60)} giờ` : `${Math.floor(minutes / 60)} giờ ${rest} phút`;
}

// ---- Giá tạm tính trước khi đặt (API tính lại, số của API mới là số thật) ----

// Làm tròn LÊN theo 24 giờ, như API.
export function rentalDays(startIso: string, endIso: string): number {
  return Math.ceil((Date.parse(endIso) - Date.parse(startIso)) / DAY_MS);
}

export function quote(pricePerDay: number, depositRate: number, days: number) {
  const totalAmount = pricePerDay * days;
  const depositAmount = Math.round((totalAmount * depositRate) / 100);
  return { totalAmount, depositAmount, payableAmount: totalAmount + depositAmount };
}

// Thông báo nếu khoảng thời gian không đặt được; null nếu hợp lệ. Báo sớm cho người dùng khỏi phải chờ API trả lỗi.
export function rangeProblem(startIso: string | null, endIso: string | null, now: Date): string | null {
  if (!startIso || !endIso) return "Hãy chọn thời gian nhận xe và trả xe.";
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (end <= start) return "Thời gian trả xe phải sau thời gian nhận xe.";
  if (start <= now.getTime()) return "Thời gian nhận xe phải ở tương lai.";
  if (start - now.getTime() > MAX_ADVANCE_DAYS * DAY_MS) return `Chỉ nhận đơn bắt đầu trong vòng ${MAX_ADVANCE_DAYS} ngày tới.`;
  if (rentalDays(startIso, endIso) > MAX_RENTAL_DAYS) return `Mỗi đơn thuê tối đa ${MAX_RENTAL_DAYS} ngày.`;
  return null;
}

// ---- Trạng thái hiển thị ----

// Đơn pending đã quá hạn được coi là hết hạn ngay trên màn hình, không chờ tải lại trang (API cũng tính như vậy).
export function effectiveStatus(booking: Booking, now: Date): BookingStatus {
  if (booking.status === "pending" && booking.expiresAt && Date.parse(booking.expiresAt) < now.getTime()) return "expired";
  return booking.status;
}

// Đang trong khung giờ được xác nhận giao xe: từ 60 phút trước giờ nhận tới trước giờ trả.
export function inHandoverWindow(booking: Booking, now: Date): boolean {
  const t = now.getTime();
  return t >= Date.parse(booking.startAt) - EARLY_HANDOVER_MINUTES * 60_000 && t < Date.parse(booking.endAt);
}

// Số tiền khách được hoàn nếu hủy ngay bây giờ (SPEC §4). Chỉ để hiện trước khi khách xác nhận hủy.
export function cancelRefund(booking: Booking, now: Date): number {
  if (!booking.paidAt) return 0;
  if (booking.status === "pending") return booking.totalAmount + booking.depositAmount;
  const hoursLeft = (Date.parse(booking.startAt) - now.getTime()) / HOUR_MS;
  const rentalRefund =
    hoursLeft >= FULL_REFUND_HOURS ? booking.totalAmount : hoursLeft >= HALF_REFUND_HOURS ? Math.round(booking.totalAmount / 2) : 0;
  return booking.depositAmount + rentalRefund;
}

export type Tone = "warning" | "success" | "info";
export type RenterTab = "upcoming" | "active" | "done" | "cancelled";
export type RenterAction = "pay" | "cancel" | "pickup" | "return";
export type OwnerAction = "approve" | "reject" | "handover" | "receive";

export type RenterState = { tab: RenterTab; tone: Tone; label: string; hint: string; actions: RenterAction[] };
export type OwnerState = { tone: Tone; label: string; hint: string; actions: OwnerAction[]; needsAction: boolean };

function refundNote(amount: number): string {
  return amount > 0 ? `Bạn được hoàn ${formatVnd(amount)}.` : "";
}

export function renterState(booking: Booking, now: Date): RenterState {
  const left = booking.expiresAt ? Date.parse(booking.expiresAt) - now.getTime() : 0;

  switch (effectiveStatus(booking, now)) {
    case "pending":
      if (!booking.paidAt) {
        return {
          tab: "upcoming",
          tone: "info",
          label: "Chờ thanh toán",
          hint: `Thanh toán trong ${formatRemaining(left)} nữa để giữ xe.`,
          actions: ["pay", "cancel"],
        };
      }
      return {
        tab: "upcoming",
        tone: "warning",
        label: "Chờ chủ xe duyệt",
        hint: `Chủ xe còn ${formatRemaining(left)} để trả lời. Nếu họ từ chối hoặc không trả lời, bạn được hoàn toàn bộ.`,
        actions: ["cancel"],
      };

    case "confirmed": {
      const base = { tab: "upcoming" as const, tone: "success" as const, label: "Đã xác nhận" };
      if (now.getTime() >= Date.parse(booking.endAt)) {
        return { ...base, hint: "Đã qua thời gian thuê mà xe chưa được giao.", actions: ["cancel"] };
      }
      if (!inHandoverWindow(booking, now)) {
        return {
          ...base,
          hint: `Nhận xe lúc ${formatVnDateTime(booking.startAt)}. Nút xác nhận nhận xe mở từ ${EARLY_HANDOVER_MINUTES} phút trước giờ nhận.`,
          actions: ["cancel"],
        };
      }
      if (booking.renterReceivedAt) {
        return { ...base, hint: "Bạn đã xác nhận nhận xe. Đang chờ chủ xe xác nhận giao xe.", actions: ["cancel"] };
      }
      return {
        ...base,
        hint: booking.ownerHandedOverAt
          ? "Chủ xe đã xác nhận giao xe. Bấm \"Đã nhận xe\" khi bạn nhận được xe."
          : "Bấm \"Đã nhận xe\" khi bạn nhận được xe. Chuyến đi bắt đầu khi cả bạn và chủ xe cùng xác nhận.",
        actions: ["pickup", "cancel"],
      };
    }

    case "in_use":
      if (booking.renterReturnedAt) {
        return {
          tab: "active",
          tone: "info",
          label: "Đang thuê",
          hint: "Bạn đã xác nhận trả xe. Đang chờ chủ xe xác nhận đã nhận lại xe, sau đó bạn được hoàn tiền cọc.",
          actions: [],
        };
      }
      return {
        tab: "active",
        tone: "info",
        label: "Đang thuê",
        hint: booking.ownerReceivedBackAt
          ? "Chủ xe đã xác nhận nhận lại xe. Bấm \"Đã trả xe\" để hoàn tất và nhận lại tiền cọc."
          : `Trả xe trước ${formatVnDateTime(booking.endAt)}. Bấm "Đã trả xe" khi bạn đã giao lại xe cho chủ xe.`,
        actions: ["return"],
      };

    case "completed":
      return {
        tab: "done",
        tone: "success",
        label: "Hoàn tất",
        hint: booking.refundAmount > 0 ? `Tiền cọc ${formatVnd(booking.refundAmount)} đã được hoàn cho bạn.` : "",
        actions: [],
      };

    case "cancelled":
      return { tab: "cancelled", tone: "warning", label: "Đã hủy", hint: refundNote(booking.refundAmount), actions: [] };

    case "rejected":
      return {
        tab: "cancelled",
        tone: "warning",
        label: "Chủ xe từ chối",
        hint: [booking.rejectReason ? `Lý do: ${booking.rejectReason}.` : "", refundNote(booking.refundAmount)].filter(Boolean).join(" "),
        actions: [],
      };

    case "expired":
      return {
        tab: "cancelled",
        tone: "warning",
        label: "Hết hạn",
        hint: booking.paidAt
          ? `Chủ xe không trả lời kịp. Bạn được hoàn ${formatVnd(booking.paidAmount)}.`
          : "Đơn không được thanh toán trong thời gian giữ chỗ.",
        actions: [],
      };
  }
}

export function ownerState(booking: OwnerBooking, now: Date): OwnerState {
  const left = booking.expiresAt ? Date.parse(booking.expiresAt) - now.getTime() : 0;
  const received = formatVnd(booking.ownerPayoutAmount);

  switch (effectiveStatus(booking, now)) {
    case "pending":
      return {
        tone: "warning",
        label: "Chờ bạn duyệt",
        hint: `Khách đã thanh toán. Bạn còn ${formatRemaining(left)} để trả lời, quá hạn đơn tự hủy và khách được hoàn tiền.`,
        actions: ["approve", "reject"],
        needsAction: true,
      };

    case "confirmed": {
      const base = { tone: "success" as const, label: "Đã xác nhận" };
      if (now.getTime() >= Date.parse(booking.endAt)) {
        return { ...base, hint: "Đã qua thời gian thuê mà xe chưa được giao.", actions: [], needsAction: false };
      }
      if (!inHandoverWindow(booking, now)) {
        return {
          ...base,
          hint: `Giao xe lúc ${formatVnDateTime(booking.startAt)}. Nút giao xe mở từ ${EARLY_HANDOVER_MINUTES} phút trước giờ nhận.`,
          actions: [],
          needsAction: false,
        };
      }
      if (booking.ownerHandedOverAt) {
        return { ...base, hint: "Bạn đã xác nhận giao xe. Đang chờ khách xác nhận đã nhận xe.", actions: [], needsAction: false };
      }
      return {
        ...base,
        hint: booking.renterReceivedAt
          ? "Khách đã xác nhận nhận xe. Bấm \"Giao xe\" để bắt đầu chuyến đi và nhận 50% tiền thuê."
          : "Bấm \"Giao xe\" khi bạn giao xe cho khách. Bạn nhận 50% tiền thuê khi cả hai bên cùng xác nhận.",
        actions: ["handover"],
        needsAction: true,
      };
    }

    case "in_use":
      if (booking.ownerReceivedBackAt) {
        return {
          tone: "info",
          label: "Đang cho thuê",
          hint: `Bạn đã xác nhận nhận lại xe. Đang chờ khách xác nhận trả xe. Đã nhận ${received}.`,
          actions: [],
          needsAction: false,
        };
      }
      return {
        tone: "info",
        label: "Đang cho thuê",
        hint: booking.renterReturnedAt
          ? `Khách đã xác nhận trả xe. Bấm "Đã nhận lại xe" để hoàn tất và nhận phần tiền thuê còn lại.`
          : `Khách trả xe trước ${formatVnDateTime(booking.endAt)}. Đã nhận ${received}.`,
        actions: ["receive"],
        needsAction: booking.renterReturnedAt !== null,
      };

    case "completed":
      return { tone: "success", label: "Hoàn tất", hint: `Bạn nhận ${received} tiền thuê.`, actions: [], needsAction: false };

    case "cancelled":
      return {
        tone: "warning",
        label: "Khách đã hủy",
        hint: booking.ownerPayoutAmount > 0 ? `Khách hủy sát giờ nhận xe nên bạn nhận ${received}.` : "",
        actions: [],
        needsAction: false,
      };

    case "rejected":
      return {
        tone: "warning",
        label: "Bạn đã từ chối",
        hint: booking.rejectReason ? `Lý do: ${booking.rejectReason}` : "",
        actions: [],
        needsAction: false,
      };

    case "expired":
      return {
        tone: "warning",
        label: "Hết hạn",
        hint: "Bạn không trả lời trong thời hạn nên đơn đã tự hủy và khách được hoàn tiền.",
        actions: [],
        needsAction: false,
      };
  }
}
