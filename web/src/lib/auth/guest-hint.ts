// Ghi nhớ "trình duyệt này không có phiên đăng nhập" để các lần tải trang sau KHÔNG gọi /api/auth/refresh nữa.
// Phần lớn lượt truy cập là khách vãng lai; không có ghi nhớ này thì mỗi trang họ mở đều tốn một yêu cầu xác thực vô ích.
//
// Đây chỉ là gợi ý để đỡ gọi máy chủ, không phải bảo mật: người dùng tự sửa giá trị này cũng chỉ làm trình duyệt của chính họ
// gọi thêm hoặc bớt một yêu cầu. Quyền thật vẫn do cookie httpOnly và API quyết định.
//
// Cố ý ghi nhớ điều PHỦ ĐỊNH ("là khách") chứ không ghi "đang đăng nhập": chưa có ghi nhớ gì thì vẫn hỏi máy chủ như cũ,
// nên phiên đang có không bao giờ bị bỏ sót chỉ vì thiếu dấu. Dấu tự hết hạn sau 24 giờ để nếu có sai lệch thì tự lành.

const KEY = "carrental.guest";
export const GUEST_HINT_TTL_MS = 24 * 60 * 60 * 1000;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// localStorage có thể không tồn tại (máy chủ render) hoặc ném lỗi (chế độ riêng tư, bị chặn). Khi đó coi như không có ghi
// nhớ, tức là quay về hành vi an toàn: hỏi máy chủ.
function storage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function isKnownGuest(now: number = Date.now()): boolean {
  try {
    const markedAt = Number(storage()?.getItem(KEY));
    return Number.isFinite(markedAt) && markedAt > 0 && now - markedAt >= 0 && now - markedAt < GUEST_HINT_TTL_MS;
  } catch {
    return false;
  }
}

export function markGuest(now: number = Date.now()): void {
  try {
    storage()?.setItem(KEY, String(now));
  } catch {
    // không ghi được thì thôi: lần sau hỏi máy chủ như bình thường
  }
}

export function clearGuest(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // như trên
  }
}
