import type { Role } from "./types";

// Trang không dùng làm đích quay lại sau đăng nhập, để khỏi lặp vòng giữa các trang xác thực.
const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

function pathOf(url: string): string {
  return url.split(/[?#]/)[0];
}

function isUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

// Chỉ nhận đường dẫn nội bộ của chính trang web. Chặn kiểu "//evil.com", "/\evil.com" hay "https://evil.com"
// (open redirect: kẻ xấu gắn đích độc hại vào liên kết đăng nhập để đưa người dùng sang trang giả).
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 300) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  if (AUTH_PAGES.some((page) => isUnder(pathOf(raw), page))) return null;
  return raw;
}

// Đích sau khi đăng nhập thành công:
//   chủ xe -> /owner, admin -> /admin, khách -> trang họ đang đứng trước khi đăng nhập (mặc định trang chủ).
export function postLoginPath(role: Role, next: string | null | undefined): string {
  if (role === "owner") return "/owner";
  if (role === "admin") return "/admin";

  const safe = safeNextPath(next);
  if (!safe) return "/";
  // Khách không vào được khu chủ xe và khu quản trị: quay về trang chủ thay vì bị chặn ngay.
  const path = pathOf(safe);
  if (isUnder(path, "/owner") || isUnder(path, "/admin")) return "/";
  return safe;
}

// Liên kết tới trang đăng nhập, nhớ trang hiện tại để quay lại sau khi đăng nhập.
export function loginHref(next: string | null | undefined): string {
  const safe = safeNextPath(next);
  return safe ? `/login?next=${encodeURIComponent(safe)}` : "/login";
}
