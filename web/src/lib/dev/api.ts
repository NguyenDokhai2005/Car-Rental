import { apiFetch } from "@/lib/api/client";

// Khớp các kiểu trả về của api/src/dev (SPEC §7, mục Dev).

type Failed = { ok: false; error: string };
type Section<T> = ({ ok: true } & T) | Failed;

export type SystemStatus = {
  at: string;
  api: {
    ok: true;
    environment: string;
    nodeVersion: string;
    pid: number;
    uptimeSeconds: number;
    memoryMb: { rss: number; heapUsed: number; heapLimit: number };
    eventLoopDelayMs: { mean: number; p99: number; max: number };
    last5Minutes: { count: number; clientErrors: number; serverErrors: number; avgMs: number };
  };
  server: Section<{
    hostname: string;
    platform: string;
    uptimeSeconds: number;
    cpuCount: number;
    loadAverage: number[];
    memoryMb: { total: number; available: number };
    swapMb: { total: number; used: number } | null;
    containerMemoryLimitMb: number | null;
    uploadDisk: { totalGb: number; freeGb: number };
  }>;
  database: Section<{
    pingMs: number;
    uptimeSeconds: number;
    cacheHitPercent: number | null;
    longestQuerySeconds: number;
    deadlocks: number;
    rollbacks: number;
    version: string;
    sizeMb: number;
    connections: { max: number; total: number; active: number };
    tables: { name: string; rows: number; sizeMb: number }[];
    migrations: { applied: number; latest: string | null };
  }>;
  web: Section<{ status: number; responseMs: number; healthy: boolean }>;
};

// Một điểm trên biểu đồ. null: chỉ số đó không đo được ở mẫu này.
export type MetricSample = {
  at: string;
  cpuPercent: number | null;
  memoryUsedPercent: number;
  rssMb: number;
  heapUsedMb: number;
  loopDelayMeanMs: number;
  loopDelayMaxMs: number;
  requests: number;
  clientErrors: number;
  serverErrors: number;
  avgMs: number | null;
  p95Ms: number | null;
  dbPingMs: number | null;
  dbConnections: number | null;
  webResponseMs: number | null;
};

export type MetricsHistory = { intervalSeconds: number; samples: MetricSample[] };

export type RequestEntry = {
  at: string;
  method: string;
  path: string;
  route: string | null;
  status: number;
  durationMs: number;
  ip: string | null;
  userId: string | null;
  role: string | null;
};

export type RouteStats = { route: string; count: number; clientErrors: number; serverErrors: number; avgMs: number; p95Ms: number; maxMs: number };

export type LogSource = "server" | "browser";
export type LogLevel = "log" | "warn" | "error";

export type LogEntry = {
  at: string;
  level: string;
  message: string;
  context?: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  ip?: string | null;
};

export type TableColumn = { name: string; type: string; nullable: boolean; masked: boolean };
export type TableInfo = { name: string; rows: number; sizeMb: number; columns: TableColumn[] };
// Mọi giá trị ở dạng chữ, đã cắt còn 300 ký tự; cột bí mật đã bị che ngay tại máy chủ.
export type TableRows = { columns: TableColumn[]; items: Record<string, string | null>[]; total: number; page: number; limit: number };

export type RowsQuery = { page: number; sort: string | null; order: "asc" | "desc"; filterColumn: string; filterValue: string };

export const TABLE_PAGE_SIZE = 25;

export function listTables(): Promise<{ items: TableInfo[] }> {
  return apiFetch("/dev/database/tables");
}

export function listTableRows(table: string, query: RowsQuery): Promise<TableRows> {
  const params = new URLSearchParams({ page: String(query.page), limit: String(TABLE_PAGE_SIZE), order: query.order });
  if (query.sort) params.set("sort", query.sort);
  if (query.filterColumn) {
    params.set("filterColumn", query.filterColumn);
    params.set("filterValue", query.filterValue);
  }
  return apiFetch(`/dev/database/tables/${encodeURIComponent(table)}/rows?${params.toString()}`);
}

export function getSystemStatus(): Promise<SystemStatus> {
  return apiFetch("/dev/status");
}

export function getMetricsHistory(): Promise<MetricsHistory> {
  return apiFetch("/dev/metrics");
}

export function listRequests(filters: { onlyErrors: boolean; q: string }): Promise<{ items: RequestEntry[]; stats: RouteStats[] }> {
  const query = new URLSearchParams({ limit: "200" });
  if (filters.onlyErrors) query.set("onlyErrors", "true");
  if (filters.q.trim()) query.set("q", filters.q.trim());
  return apiFetch(`/dev/requests?${query.toString()}`);
}

export function clearRequests(): Promise<void> {
  return apiFetch("/dev/requests", { method: "DELETE" });
}

export function listLogs(source: LogSource, level: LogLevel | ""): Promise<{ items: LogEntry[] }> {
  const query = new URLSearchParams({ source, limit: "200" });
  if (level) query.set("level", level);
  return apiFetch(`/dev/logs?${query.toString()}`);
}

export function clearLogs(source: LogSource): Promise<void> {
  return apiFetch(`/dev/logs?source=${source}`, { method: "DELETE" });
}
