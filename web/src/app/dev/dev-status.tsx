"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { ChartSeries, LineChart } from "@/components/line-chart";
import { getMetricsHistory, getSystemStatus, MetricSample, SystemStatus } from "@/lib/dev/api";
import { formatLogTime, formatUptime, Health, percent } from "@/lib/dev/format";
import { apiHealth, databaseHealth, serverHealth, webHealth } from "@/lib/dev/health";
import { HEALTH, StatusDetails } from "./status-details";
import { usePolling } from "./use-polling";

const REFRESH_MS = 10_000;

const RANGES = [
  { minutes: 5, label: "5 phút" },
  { minutes: 15, label: "15 phút" },
  { minutes: 60, label: "1 giờ" },
];

const COLOR = { blue: "var(--color-primary)", green: "var(--color-tertiary)", red: "var(--color-error)", amber: "#d97706" };

type Summary = { icon: string; title: string; health: Health; value: string; note: string };

function summaries(status: SystemStatus, latest: MetricSample | undefined, perMinute: number): Summary[] {
  const { server, api, web, database } = status;
  return [
    {
      icon: "memory",
      title: "Máy chủ",
      health: serverHealth(server),
      value: server.ok ? `RAM ${percent(server.memoryMb.total - server.memoryMb.available, server.memoryMb.total)}%` : "Không đo được",
      note: server.ok ? `CPU ${latest?.cpuPercent ?? "–"}% · đĩa còn ${server.uploadDisk.freeGb} GB` : server.error,
    },
    {
      icon: "dns",
      title: "Backend (API)",
      health: apiHealth(api),
      value: `${latest ? (latest.requests * perMinute).toLocaleString("vi-VN") : "–"} yêu cầu/phút`,
      note: `p95 ${latest?.p95Ms ?? "–"} ms · chạy ${formatUptime(api.uptimeSeconds)}`,
    },
    {
      icon: "web",
      title: "Frontend (Web)",
      health: webHealth(web),
      value: web.ok ? `${web.responseMs} ms` : "Không phản hồi",
      note: web.ok ? `Mã trạng thái ${web.status}` : web.error,
    },
    {
      icon: "database",
      title: "Cơ sở dữ liệu",
      health: databaseHealth(database),
      value: database.ok ? `${database.pingMs} ms` : "Không kết nối được",
      note: database.ok ? `${database.connections.total}/${database.connections.max} kết nối · ${database.sizeMb.toLocaleString("vi-VN")} MB` : database.error,
    },
  ];
}

function charts(samples: MetricSample[], perMinute: number): { title: string; hint: string; unit: string; max?: number; series: ChartSeries[] }[] {
  const pick = (read: (sample: MetricSample) => number | null) => samples.map(read);
  return [
    {
      title: "Lưu lượng yêu cầu",
      hint: "Số yêu cầu tới API, quy ra mỗi phút. Không tính /health và trang kỹ thuật.",
      unit: "/phút",
      series: [
        { label: "Tất cả", color: COLOR.blue, values: pick((s) => s.requests * perMinute) },
        { label: "Lỗi 4xx", color: COLOR.amber, values: pick((s) => s.clientErrors * perMinute) },
        { label: "Lỗi 5xx", color: COLOR.red, values: pick((s) => s.serverErrors * perMinute) },
      ],
    },
    {
      title: "Thời gian xử lý yêu cầu",
      hint: "p95: 95% số yêu cầu nhanh hơn mức này. Đường đứt đoạn là lúc không có yêu cầu nào.",
      unit: "ms",
      series: [
        { label: "Trung bình", color: COLOR.blue, values: pick((s) => s.avgMs) },
        { label: "p95", color: COLOR.amber, values: pick((s) => s.p95Ms) },
      ],
    },
    {
      title: "CPU và RAM của máy chủ",
      hint: "Phần trăm đang dùng trên toàn máy, gồm cả web, CSDL và các tiến trình khác.",
      unit: "%",
      max: 100,
      series: [
        { label: "CPU", color: COLOR.blue, values: pick((s) => s.cpuPercent) },
        { label: "RAM", color: COLOR.green, values: pick((s) => s.memoryUsedPercent) },
      ],
    },
    {
      title: "Bộ nhớ của tiến trình API",
      hint: "RSS là tổng bộ nhớ tiến trình chiếm. Heap tăng mãi không giảm là dấu hiệu rò rỉ bộ nhớ.",
      unit: "MB",
      series: [
        { label: "RSS", color: COLOR.blue, values: pick((s) => s.rssMb) },
        { label: "Heap", color: COLOR.green, values: pick((s) => s.heapUsedMb) },
      ],
    },
    {
      title: "Độ trễ phản hồi của CSDL và web",
      hint: "Thời gian một truy vấn thử vào CSDL và một lần API gọi thử máy chủ web. Đứt đoạn là lúc không phản hồi.",
      unit: "ms",
      series: [
        { label: "CSDL", color: COLOR.green, values: pick((s) => s.dbPingMs) },
        { label: "Web", color: COLOR.blue, values: pick((s) => s.webResponseMs) },
      ],
    },
    {
      title: "Độ trễ vòng lặp sự kiện",
      hint: "API bị một việc nặng chiếm CPU thì mọi yêu cầu khác phải chờ chừng này.",
      unit: "ms",
      series: [
        { label: "Trung bình", color: COLOR.blue, values: pick((s) => s.loopDelayMeanMs) },
        { label: "Lớn nhất", color: COLOR.red, values: pick((s) => s.loopDelayMaxMs) },
      ],
    },
    {
      title: "Kết nối CSDL đang mở",
      hint: "Tiến gần giới hạn kết nối của PostgreSQL thì yêu cầu mới sẽ phải chờ hoặc lỗi.",
      unit: "kết nối",
      series: [{ label: "Đang mở", color: COLOR.green, values: pick((s) => s.dbConnections) }],
    },
  ];
}

export function DevStatus() {
  const [auto, setAuto] = useState(true);
  const [minutes, setMinutes] = useState(15);
  const interval = auto ? REFRESH_MS : null;
  const status = usePolling(getSystemStatus, "status", interval);
  const metrics = usePolling(getMetricsHistory, "metrics", interval);

  const intervalSeconds = metrics.data?.intervalSeconds ?? 10;
  const perMinute = 60 / intervalSeconds;
  const samples = (metrics.data?.samples ?? []).slice(-(minutes * perMinute));
  const times = samples.map((sample) => sample.at);
  const error = status.error ?? metrics.error;

  function reload() {
    status.reload();
    metrics.reload();
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-lg text-on-surface">Hiện trạng hệ thống</h1>
          <p className="text-body-md text-on-surface-variant">
            Máy chủ, backend, frontend và cơ sở dữ liệu. Cập nhật lúc {status.data ? formatLogTime(status.data.at) : "..."}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-md">
          <label className="flex items-center gap-space-sm text-label-lg text-on-surface">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="size-4 accent-primary" />
            Tự làm mới mỗi 10 giây
          </label>
          <button type="button" onClick={reload} className="flex h-10 items-center gap-space-sm rounded-xl bg-primary px-space-md text-label-lg text-on-primary">
            <Icon name="refresh" className="!text-[20px]" />
            Làm mới
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
          {error}
        </p>
      )}
      {status.loading && <p className="text-body-md text-on-surface-variant">Đang tải hiện trạng...</p>}

      {status.data && (
        <ul className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-4">
          {summaries(status.data, samples[samples.length - 1], perMinute).map((item) => (
            <li key={item.title} className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
              <div className="flex items-center justify-between gap-space-sm">
                <span className="flex items-center gap-space-sm text-label-lg text-on-surface-variant">
                  <Icon name={item.icon} className="!text-[20px] text-primary" />
                  {item.title}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-label-md ${HEALTH[item.health].pill}`}>{HEALTH[item.health].label}</span>
              </div>
              <span className="text-headline-md text-on-surface">{item.value}</span>
              <span className="text-label-md text-on-surface-variant">{item.note}</span>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-space-md">
        <div className="flex flex-wrap items-center justify-between gap-space-md">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-headline-sm text-on-surface">Diễn biến theo thời gian</h2>
            <p className="text-label-md text-on-surface-variant">
              Mỗi {intervalSeconds} giây một điểm, giữ tối đa 1 giờ và bắt đầu lại khi API khởi động lại. Rê chuột lên biểu đồ để xem số liệu từng thời điểm.
            </p>
          </div>
          <div role="group" aria-label="Khoảng thời gian" className="flex gap-space-sm">
            {RANGES.map((range) => (
              <button
                key={range.minutes}
                type="button"
                aria-pressed={range.minutes === minutes}
                onClick={() => setMinutes(range.minutes)}
                className={`h-9 rounded-full px-space-md text-label-lg transition-colors ${
                  range.minutes === minutes ? "bg-on-surface text-surface-container-lowest" : "bg-surface-container-lowest text-on-surface hover:bg-surface-container"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-gutter xl:grid-cols-2">
          {charts(samples, perMinute).map((chart) => (
            <LineChart key={chart.title} times={times} {...chart} />
          ))}
        </div>
      </section>

      {status.data && (
        <section className="flex flex-col gap-space-md">
          <h2 className="text-headline-sm text-on-surface">Chi tiết từng phần</h2>
          <StatusDetails status={status.data} />
        </section>
      )}
    </>
  );
}
