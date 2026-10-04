"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, onSessionLost, refreshSession, setAccessToken } from "@/lib/api/client";
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
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  // Mở trang hoặc tải lại: khôi phục phiên từ cookie làm mới (access token không sống qua lần tải lại).
  useEffect(() => {
    let cancelled = false;
    refreshSession()
      .then((session) => {
        if (cancelled) return;
        setState(session ? { status: "authenticated", user: session.user } : { status: "anonymous", user: null });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "anonymous", user: null });
      });
    const stopListening = onSessionLost(() => setState({ status: "anonymous", user: null }));
    return () => {
      cancelled = true;
      stopListening();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const session = await apiFetch<SessionPayload>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    setAccessToken(session.accessToken);
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
    setState({ status: "anonymous", user: null });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ ...state, login, register, logout }), [state, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth phải được dùng bên trong <AuthProvider>.");
  return value;
}
