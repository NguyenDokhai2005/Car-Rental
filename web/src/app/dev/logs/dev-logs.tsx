"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { apiErrorMessage } from "@/lib/api/error-message";
import { clearLogs, listLogs, LogLevel, LogSource } from "@/lib/dev/api";
import { formatLogTime } from "@/lib/dev/format";
import { usePolling } from "../use-polling";

const REFRESH_MS = 5_000;

const SOURCES: { id: LogSource; label: string; hint: string }[] = [
  { id: "server", label: "Máy chủ (API)", hint: "1.000 dòng log gần nhất của API. Log đầy đủ lâu dài vẫn nằm ở docker logs." },
  {
    id: "browser",
    label: "Trình duyệt người dùng",
    hint: "500 lỗi JavaScript gần nhất do trình duyệt của người dùng gửi về. Ai cũng gửi được nên coi nội dung là không tin cậy.",
  },
];

const LEVELS: Record<LogSource, { id: LogLevel | ""; label: string }[]> = {
  server: [
    { id: "", label: "Mọi mức" },
    { id: "log", label: "log" },
    { id: "warn", label: "warn" },
    { id: "error", label: "error" },
  ],
  browser: [
    { id: "", label: "Mọi mức" },
    { id: "warn", label: "warn" },
    { id: "error", label: "error" },
  ],
};

const LEVEL_TONE: Record<string, string> = {
  error: "bg-error-container text-on-error-container",
  warn: "bg-warning-container text-warning",
  log: "bg-surface-container text-on-surface-variant",
};

export function DevLogs() {
  const [source, setSource] = useState<LogSource>("server");
  const [level, setLevel] = useState<LogLevel | "">("");
  const [auto, setAuto] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, reload } = usePolling(() => listLogs(source, level), `${source}|${level}`, auto ? REFRESH_MS : null);
  const current = SOURCES.find((s) => s.id === source) ?? SOURCES[0];

  async function onClear() {
    if (!window.confirm(`Xóa toàn bộ log "${current.label}" đang giữ trong bộ nhớ?`)) return;
    setActionError(null);
    try {
      await clearLogs(source);
      reload();
    } catch (e) {
      setActionError(apiErrorMessage(e));
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">Console log</h1>
        <p className="text-body-md text-on-surface-variant">{current.hint}</p>
      </div>

      <section className="flex flex-col gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
        <div className="flex flex-wrap items-center gap-space-md">
          <div role="tablist" aria-label="Nguồn log" className="flex gap-space-sm">
            {SOURCES.map((s) => {
              const selected = s.id === source;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => {
                    setSource(s.id);
                    setLevel("");
                  }}
                  className={`h-9 rounded-full px-space-md text-label-lg transition-colors ${
                    selected ? "bg-on-surface text-surface-container-lowest" : "bg-surface-container-low text-on-surface hover:bg-surface-container"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <select
            aria-label="Mức log"
            value={level}
            onChange={(e) => setLevel(e.target.value as LogLevel | "")}
            className="h-10 rounded-xl bg-surface-container-low px-space-md text-label-lg text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
          >
            {LEVELS[source].map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-space-sm text-label-lg text-on-surface">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="size-4 accent-primary" />
            Tự làm mới mỗi 5 giây
          </label>
          <button type="button" onClick={() => void onClear()} className="ml-auto flex h-10 items-center gap-space-sm rounded-xl bg-error-container px-space-md text-label-lg text-on-error-container">
            <Icon name="delete" className="!text-[20px]" />
            Xóa log
          </button>
        </div>

        {(error ?? actionError) && (
          <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
            {error ?? actionError}
          </p>
        )}
        {loading && <p className="text-body-md text-on-surface-variant">Đang tải log...</p>}
        {data && data.items.length === 0 && (
          <p className="rounded-xl bg-surface-container-low px-space-md py-space-lg text-center text-body-md text-on-surface-variant">Chưa có dòng log nào.</p>
        )}

        {data && data.items.length > 0 && (
          <ol className="flex flex-col gap-1.5">
            {data.items.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="flex flex-col gap-1 rounded-xl bg-surface-container-low px-space-md py-space-sm">
                <div className="flex flex-wrap items-center gap-space-sm text-label-md text-on-surface-variant">
                  <span className={`rounded-full px-2.5 py-0.5 ${LEVEL_TONE[entry.level] ?? LEVEL_TONE.log}`}>{entry.level}</span>
                  <time dateTime={entry.at}>{formatLogTime(entry.at)}</time>
                  {entry.context && <span className="font-mono text-primary">[{entry.context}]</span>}
                  {entry.url && <span className="font-mono break-all">{entry.url}</span>}
                  {entry.ip && <span className="font-mono">{entry.ip}</span>}
                </div>
                {/* Nội dung do máy khác gửi tới: React chỉ in ra dạng chữ, không bao giờ diễn giải thành HTML. */}
                <pre className="font-mono text-label-lg break-words whitespace-pre-wrap text-on-surface">{entry.message}</pre>
                {entry.stack && <pre className="font-mono text-label-md break-words whitespace-pre-wrap text-on-surface-variant">{entry.stack}</pre>}
                {entry.userAgent && <span className="text-label-sm break-all text-outline">{entry.userAgent}</span>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
