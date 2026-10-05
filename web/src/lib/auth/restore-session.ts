import { ApiError } from "@/lib/api/client";
import type { SessionPayload } from "./types";

// Khôi phục phiên lúc mở trang có BA kết quả, không phải hai:
//   session: đang đăng nhập.
//   guest:   máy chủ trả lời rõ ràng là không có phiên (401, hoặc tài khoản bị khóa).
//   unknown: KHÔNG BIẾT, vì máy chủ không trả lời được (mất mạng, API đang khởi động lại lúc deploy, quá tải).
// Trước đây "unknown" bị gộp vào "guest": mỗi lần deploy, ai tải trang đúng lúc API khởi động lại sẽ bị coi là chưa đăng
// nhập và bị đưa về trang đăng nhập dù phiên vẫn hợp lệ.
export type RestoreResult =
  | { kind: "session"; session: SessionPayload }
  | { kind: "guest" }
  | { kind: "unknown" };

// Thời gian chờ trước mỗi lần thử lại, giãn dần để không dồn thêm yêu cầu vào một máy chủ đang quá tải. Tổng 15 giây.
export const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];

// Lỗi tạm thời: thử lại có thể thành công. status 0 là lỗi mạng (xem lib/api/client.ts).
export function isTransientError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status === 429 || error.status >= 500);
}

export async function restoreSession(deps: {
  refresh: () => Promise<SessionPayload | null>;
  sleep: (ms: number) => Promise<void>;
  delays?: readonly number[];
  isCancelled?: () => boolean;
}): Promise<RestoreResult> {
  const delays = deps.delays ?? RETRY_DELAYS_MS;
  for (let attempt = 0; ; attempt += 1) {
    try {
      const session = await deps.refresh();
      return session ? { kind: "session", session } : { kind: "guest" };
    } catch (error) {
      // Lỗi dứt khoát (ví dụ 403 tài khoản bị khóa): thử lại cũng vô ích, coi như không có phiên.
      if (!isTransientError(error)) return { kind: "guest" };
      if (attempt >= delays.length || deps.isCancelled?.()) return { kind: "unknown" };
      await deps.sleep(delays[attempt]);
      if (deps.isCancelled?.()) return { kind: "unknown" };
    }
  }
}
