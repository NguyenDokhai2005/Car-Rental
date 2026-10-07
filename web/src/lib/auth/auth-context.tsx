"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, onSessionLost, refreshSession, setAccessToken } from "@/lib/api/client";
import { clearGuest, isKnownGuest, markGuest } from "./guest-hint";
import { restoreSession, RestoreResult } from "./restore-session";
import type { AuthUser, Role, SessionPayload } from "./types";

export type RegisterInput = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: Exclude<Role, "admin">;
};

type AuthState =
  | { status: "loading"; user: null }
  | { status: "anonymous"; user: null }
  | { status: "authenticated"; user: AuthUser };

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  updateProfile: (input: { fullName: string; phone: string }) => Promise<AuthUser>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  // Hủy việc "thử khôi phục lại khi có mạng hoặc khi quay lại tab" (chỉ tồn tại sau một lần khôi phục không có kết quả).
  const stopRetryRef = useRef<(() => void) | null>(null);

  // Mở trang hoặc tải lại: khôi phục phiên từ cookie làm mới (access token không sống qua lần tải lại).
  useEffect(() => {
    let cancelled = false;
    const anonymous = () => setState({ status: "anonymous", user: null });

    const restore = async () => {
      stopRetryRef.current?.();
      stopRetryRef.current = null;

      // Trình duyệt đã biết mình là khách (xem guest-hint.ts): không gọi máy chủ. Ngược lại hỏi máy chủ, có thử lại khi
      // lỗi tạm thời (xem restore-session.ts).
      const result: RestoreResult = isKnownGuest()
        ? await Promise.resolve({ kind: "guest" as const })
        : await restoreSession({ refresh: refreshSession, sleep, isCancelled: () => cancelled });
      if (cancelled) return;

      if (result.kind === "session") {
        setState({ status: "authenticated", user: result.session.user });
        return;
      }
      // Chỉ ghi nhớ "là khách" khi máy chủ trả lời rõ ràng. Không biết (unknown) thì không được ghi, nếu không một lần
      // API khởi động lại sẽ khiến người đang đăng nhập bị coi là khách suốt 24 giờ.
      if (result.kind === "guest") markGuest();
      anonymous();

      if (result.kind === "unknown") {
        // Chưa biết có phiên hay không: thử lại khi có mạng trở lại hoặc khi người dùng quay lại tab này.
        const retry = () => void restore();
        window.addEventListener("online", retry, { once: true });
        window.addEventListener("focus", retry, { once: true });
        stopRetryRef.current = () => {
          window.removeEventListener("online", retry);
          window.removeEventListener("focus", retry);
        };
      }
    };

    void restore();
    const stopListening = onSessionLost(() => {
      markGuest();
      anonymous();
    });
    return () => {
      cancelled = true;
      stopListening();
      stopRetryRef.current?.();
      stopRetryRef.current = null;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const session = await apiFetch<SessionPayload>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    setAccessToken(session.accessToken);
    clearGuest();
    stopRetryRef.current?.();
    stopRetryRef.current = null;
    setState({ status: "authenticated", user: session.user });
    return session.user;
  }, []);

  const register = useCallback(
    async (input: RegisterInput) => {
      await apiFetch("/auth/register", { method: "POST", body: input, auth: false });
      // Đăng ký không tự đăng nhập (SPEC §7), nên đăng nhập ngay bằng thông tin vừa nhập.
      return login(input.email, input.password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST", auth: false });
    } catch {
      // Dù API không trả lời, vẫn đăng xuất ở phía này.
    }
    setAccessToken(null);
    markGuest();
    setState({ status: "anonymous", user: null });
  }, []);

  // Sửa hồ sơ rồi cập nhật ngay người dùng đang giữ trong bộ nhớ, để thanh đầu trang hiện tên mới mà không cần tải lại.
  const updateProfile = useCallback(async (input: { fullName: string; phone: string }) => {
    const user = await apiFetch<AuthUser>("/me", { method: "PATCH", body: input });
    setState((prev) => (prev.status === "authenticated" ? { status: "authenticated", user } : prev));
    return user;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, register, logout, updateProfile }),
    [state, login, register, logout, updateProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth phải được dùng bên trong <AuthProvider>.");
  return value;
}
