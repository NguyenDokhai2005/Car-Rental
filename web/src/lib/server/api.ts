import { headers } from "next/headers";

// Gọi API từ phía máy chủ Next (render trang, sitemap). Khác lib/api/client.ts (chạy trên trình duyệt, đi qua /api cùng
// origin): ở đây máy chủ web gọi thẳng API. Trên server thật API_URL là http://api:4000 (tên dịch vụ trong Docker Compose);
// khi chạy dev thì là localhost:4000. Chỉ dùng cho dữ liệu công khai, không bao giờ gửi kèm token của người dùng.
export class ServerApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ServerApiError";
    this.status = status;
    this.code = code;
  }
}

function apiBase(): string {
  return `${process.env.API_URL ?? "http://localhost:4000"}/api`;
}

export function siteUrl(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// Địa chỉ khách thật mà Nginx đã ghi vào X-Forwarded-For của yêu cầu đang được render.
// Không chuyển tiếp thì mọi khách đều tới API từ cùng một IP (máy chủ web) và dùng chung hạn mức 120 yêu cầu mỗi phút
// của API: chỉ cần vài chục lượt tải trang, hoặc một người bấm F5 liên tục, là cả website báo lỗi cho tất cả mọi người.
// Giữ nguyên giá trị nhận được (không tự tạo): API tin đúng một tầng proxy và lấy địa chỉ ngoài cùng bên phải, là địa
// chỉ Nginx vừa ghi nên khách không giả mạo được bằng cách tự gửi X-Forwarded-For.
async function clientForwardedFor(): Promise<string | undefined> {
  try {
    return (await headers()).get("x-forwarded-for") ?? undefined;
  } catch {
    return undefined; // ngoài phạm vi một yêu cầu (ví dụ lúc build) thì không có header nào để chuyển tiếp
  }
}

export async function serverGet<T>(path: string): Promise<T> {
  let res: Response;
  const forwardedFor = await clientForwardedFor();
  try {
    res = await fetch(`${apiBase()}${path}`, {
      headers: { Accept: "application/json", ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}) },
      // Kết quả phụ thuộc vào ngày và đơn thuê đang có nên không cache; hết 4 giây thì bỏ (ngắn hơn healthcheck 5 giây của Docker) để trang không treo.
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    throw new ServerApiError(0, "NETWORK_ERROR", "Không kết nối được máy chủ dữ liệu.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
    throw new ServerApiError(res.status, body?.code ?? "ERROR", body?.message ?? "Đã có lỗi xảy ra.");
  }
  return (await res.json()) as T;
}
