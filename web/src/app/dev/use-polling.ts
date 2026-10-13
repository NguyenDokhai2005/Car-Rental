"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiErrorMessage } from "@/lib/api/error-message";

export type Polled<T> = { data: T | null; error: string | null; loading: boolean; reload: () => void };

// Tải dữ liệu rồi tự tải lại theo chu kỳ. Khi tab bị ẩn thì ngừng, để một tab bỏ quên không gọi API suốt đêm.
// `key` đổi (bộ lọc đổi) thì tải lại ngay.
export function usePolling<T>(load: () => Promise<T>, key: string, intervalMs: number | null): Polled<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let cancelled = false;
    loadRef
      .current()
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      // Giữ dữ liệu cũ khi một lần tải lỗi: mất kết nối thoáng qua không nên xóa trắng màn hình đang xem.
      .catch((e) => !cancelled && setState((previous) => ({ data: previous.data, error: apiErrorMessage(e), loading: false })));
    return () => {
      cancelled = true;
    };
  }, [key, tick]);

  useEffect(() => {
    if (intervalMs === null) return;
    const timer = setInterval(() => {
      if (!document.hidden) setTick((value) => value + 1);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { ...state, reload };
}
