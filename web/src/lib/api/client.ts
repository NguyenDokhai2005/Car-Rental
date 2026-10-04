import type { SessionPayload } from "@/lib/auth/types";

// Mọi lỗi từ API có dạng { code, message } (CLAUDE.md, SPEC §7). Lỗi mạng dùng mã NETWORK_ERROR.
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export type ApiInit = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  // false cho các endpoint không dùng access token (đăng nhập, đăng ký, làm mới, đăng xuất).
  // Quan trọng: 401 của /auth/login nghĩa là sai mật khẩu, không phải hết phiên, nên không được thử làm mới.
  auth?: boolean;
};

const API_BASE = "/api";

// Access token chỉ nằm trong bộ nhớ của trang này, không lưu localStorage: đoạn mã độc chèn vào trang không đọc trộm
// được từ ổ lưu trữ. Refresh token nằm trong cookie httpOnly do API đặt, JavaScript không đọc được.
let accessToken: string | null = null;
let refreshInFlight: Promise<SessionPayload | null> | null = null;
const sessionLostListeners = new Set<() => void>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// Gọi khi đang có phiên mà làm mới thất bại (phiên hết hạn, bị thu hồi, tài khoản bị khóa).
export function onSessionLost(listener: () => void): () => void {
  sessionLostListeners.add(listener);
  return () => sessionLostListeners.delete(listener);
}

export function resetApiClientForTests(): void {
  accessToken = null;
  refreshInFlight = null;
  sessionLostListeners.clear();
}

function toApiError(status: number, body: unknown): ApiError {
  const data = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  return new ApiError(
    status,
    typeof data.code === "string" ? data.code : "ERROR",
    typeof data.message === "string" ? data.message : "Đã có lỗi xảy ra. Vui lòng thử lại.",
  );
}

async function send(path: string, init: ApiInit): Promise<Response> {
  const headers = new Headers({ Accept: "application/json" });
  // FormData (tải file): để trình duyệt tự đặt Content-Type kèm "boundary". Tự đặt thì máy chủ không tách được các phần.
  const isForm = init.body instanceof FormData;
  if (init.body !== undefined && !isForm) headers.set("Content-Type", "application/json");
  if (init.auth !== false && accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  try {
    return await fetch(`${API_BASE}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : isForm ? (init.body as FormData) : JSON.stringify(init.body),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) throw toApiError(res.status, body);
  return body as T;
}

async function runRefresh(): Promise<SessionPayload | null> {
  const attempt = async (): Promise<SessionPayload | null> => {
    const res = await send("/auth/refresh", { method: "POST", auth: false });
    if (res.status === 401) return null;
    return parse<SessionPayload>(res);
  };

  const hadSession = accessToken !== null;
  // Web Locks: nhiều tab cùng làm mới một lúc sẽ xếp hàng. API xoay vòng refresh token (mỗi token chỉ dùng một lần,
  // dùng lại bị coi là token bị lộ và thu hồi mọi phiên), nên hai tab gửi cùng một cookie cũ sẽ làm đăng xuất cả hai.
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  const session = locks ? await locks.request("carrental-refresh", attempt) : await attempt();

  accessToken = session ? session.accessToken : null;
  if (!session && hadSession) sessionLostListeners.forEach((listener) => listener());
  return session;
}

// Dùng chung một lần làm mới cho mọi lời gọi đồng thời trong tab này. Nếu mỗi lời gọi tự làm mới thì cùng một cookie
// bị dùng hai lần và API sẽ thu hồi mọi phiên (xem trên).
export function refreshSession(): Promise<SessionPayload | null> {
  refreshInFlight ??= runRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function apiFetch<T>(path: string, init: ApiInit = {}): Promise<T> {
  const first = await send(path, init);
  if (first.status !== 401 || init.auth === false) return parse<T>(first);

  // Access token hết hạn (15 phút): làm mới phiên bằng cookie rồi thử lại đúng một lần.
  const session = await refreshSession();
  if (!session) return parse<T>(first);
  return parse<T>(await send(path, init));
}
