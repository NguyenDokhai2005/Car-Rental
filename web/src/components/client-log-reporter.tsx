"use client";

import { useEffect } from "react";

const MAX_PER_PAGE_LOAD = 10;
const LIMITS = { message: 2000, stack: 4000, url: 500 };

function describe(value: unknown): { message: string; stack?: string } {
  if (value instanceof Error) return { message: `${value.name}: ${value.message}`, stack: value.stack };
  if (typeof value === "string") return { message: value };
  try {
    return { message: JSON.stringify(value) ?? String(value) };
  } catch {
    return { message: String(value) };
  }
}

// Gửi lỗi JavaScript xảy ra trên trình duyệt của người dùng về API (POST /client-logs) để kỹ thuật viên xem ở /dev/logs.
// Lỗi trên máy người dùng vốn không ai thấy được nếu họ không tự báo.
export function ClientLogReporter() {
  useEffect(() => {
    const seen = new Set<string>();

    function report(level: "error" | "warn", value: unknown) {
      const { message, stack } = describe(value);
      // Mỗi lỗi chỉ gửi một lần và có trần cho mỗi lần tải trang: một lỗi lặp trong vòng render không được biến thành
      // hàng trăm yêu cầu tới API.
      if (!message || seen.has(message) || seen.size >= MAX_PER_PAGE_LOAD) return;
      seen.add(message);
      const body = JSON.stringify({
        level,
        message: message.slice(0, LIMITS.message),
        stack: stack?.slice(0, LIMITS.stack),
        // Chỉ gửi đường dẫn, bỏ query string: tham số trên URL có thể chứa dữ liệu của người dùng.
        url: `${window.location.origin}${window.location.pathname}`.slice(0, LIMITS.url),
      });
      // keepalive: yêu cầu vẫn được gửi nếu người dùng rời trang ngay sau lỗi. Gửi hỏng thì bỏ qua, không báo lỗi của việc báo lỗi.
      void fetch("/api/client-logs", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
    }

    const onError = (event: ErrorEvent) => report("error", event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => report("error", event.reason);

    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      originalConsoleError(...args);
      report("error", args.find((arg) => arg instanceof Error) ?? args.map((arg) => describe(arg).message).join(" "));
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      console.error = originalConsoleError;
    };
  }, []);

  return null;
}
