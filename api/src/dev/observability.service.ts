import { Injectable } from "@nestjs/common";

export type RequestEntry = {
  at: string;
  method: string;
  path: string; // không kèm query string
  route: string | null; // mẫu route, ví dụ /api/vehicles/:id; null nếu không khớp route nào (404)
  status: number;
  durationMs: number;
  ip: string | null;
  userId: string | null;
  role: string | null;
};

export type LogSource = "server" | "browser";

export type LogEntry = {
  at: string;
  level: string;
  message: string;
  context?: string; // log máy chủ: tên lớp ghi log
  stack?: string; // log trình duyệt
  url?: string;
  userAgent?: string;
  ip?: string | null;
};

export type RouteStats = {
  route: string;
  count: number;
  clientErrors: number;
  serverErrors: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
};

// Hàng đợi vòng: giữ N phần tử mới nhất, thêm phần tử mới thì phần tử cũ nhất bị bỏ. Bộ nhớ dùng có trần cố định dù
// lượng truy cập bao nhiêu, nên việc theo dõi không bao giờ tự làm tràn RAM của máy chủ nhỏ.
class Ring<T> {
  private items: T[] = [];
  constructor(private readonly capacity: number) {}

  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.capacity) this.items.shift();
  }

  // Mới nhất trước.
  latest(): T[] {
    return [...this.items].reverse();
  }

  clear(): void {
    this.items = [];
  }
}

export type IntervalStats = { requests: number; clientErrors: number; serverErrors: number; avgMs: number | null; p95Ms: number | null };

// Trần số thời gian xử lý giữ lại trong một chu kỳ lấy mẫu, để một đợt truy cập dồn dập không làm phình bộ nhớ.
const INTERVAL_DURATION_CAP = 5000;

export const REQUEST_CAPACITY = 2000;
export const SERVER_LOG_CAPACITY = 1000;
export const BROWSER_LOG_CAPACITY = 500;

// Nơi giữ nhật ký cho vai trò dev (SPEC §7, mục Dev). Mọi thứ nằm trong bộ nhớ của tiến trình: khởi động lại là mất.
@Injectable()
export class ObservabilityService {
  private readonly requests = new Ring<RequestEntry>(REQUEST_CAPACITY);
  private readonly logs: Record<LogSource, Ring<LogEntry>> = {
    server: new Ring<LogEntry>(SERVER_LOG_CAPACITY),
    browser: new Ring<LogEntry>(BROWSER_LOG_CAPACITY),
  };

  // Bộ đếm của chu kỳ lấy mẫu hiện tại, tách khỏi nhật ký: dev xóa nhật ký thì biểu đồ không bị đứt.
  private interval = { requests: 0, clientErrors: 0, serverErrors: 0, durations: [] as number[] };

  recordRequest(entry: RequestEntry): void {
    this.requests.push(entry);
    this.interval.requests += 1;
    if (entry.status >= 500) this.interval.serverErrors += 1;
    else if (entry.status >= 400) this.interval.clientErrors += 1;
    if (this.interval.durations.length < INTERVAL_DURATION_CAP) this.interval.durations.push(entry.durationMs);
  }

  // Trả số liệu của chu kỳ vừa qua rồi bắt đầu chu kỳ mới.
  drainInterval(): IntervalStats {
    const { requests, clientErrors, serverErrors, durations } = this.interval;
    this.interval = { requests: 0, clientErrors: 0, serverErrors: 0, durations: [] };
    if (durations.length === 0) return { requests, clientErrors, serverErrors, avgMs: null, p95Ms: null };
    durations.sort((a, b) => a - b);
    return {
      requests,
      clientErrors,
      serverErrors,
      avgMs: Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length),
      p95Ms: durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))],
    };
  }

  recordLog(source: LogSource, entry: LogEntry): void {
    this.logs[source].push(entry);
  }

  listRequests(options: { limit: number; onlyErrors?: boolean; q?: string }): RequestEntry[] {
    const needle = options.q?.toLowerCase();
    return this.requests
      .latest()
      .filter((r) => (!options.onlyErrors || r.status >= 400) && (!needle || r.path.toLowerCase().includes(needle)))
      .slice(0, options.limit);
  }

  listLogs(source: LogSource, options: { limit: number; level?: string }): LogEntry[] {
    return this.logs[source]
      .latest()
      .filter((entry) => !options.level || entry.level === options.level)
      .slice(0, options.limit);
  }

  clearRequests(): void {
    this.requests.clear();
  }

  clearLogs(source: LogSource): void {
    this.logs[source].clear();
  }

  // Thống kê theo route trên toàn bộ nhật ký đang giữ, route nhiều lượt nhất đứng trước.
  routeStats(): RouteStats[] {
    const groups = new Map<string, RequestEntry[]>();
    for (const entry of this.requests.latest()) {
      const key = `${entry.method} ${entry.route ?? "(không khớp route)"}`;
      const list = groups.get(key);
      if (list) list.push(entry);
      else groups.set(key, [entry]);
    }
    return [...groups.entries()]
      .map(([route, entries]) => {
        const times = entries.map((e) => e.durationMs).sort((a, b) => a - b);
        return {
          route,
          count: entries.length,
          clientErrors: entries.filter((e) => e.status >= 400 && e.status < 500).length,
          serverErrors: entries.filter((e) => e.status >= 500).length,
          avgMs: Math.round(times.reduce((sum, t) => sum + t, 0) / times.length),
          p95Ms: times[Math.min(times.length - 1, Math.floor(times.length * 0.95))],
          maxMs: times[times.length - 1],
        };
      })
      .sort((a, b) => b.count - a.count);
  }

  // Tóm tắt các yêu cầu trong khoảng thời gian gần nhất, cho trang trạng thái.
  recentSummary(windowMs: number, now: number = Date.now()): { count: number; clientErrors: number; serverErrors: number; avgMs: number } {
    const recent = this.requests.latest().filter((r) => now - Date.parse(r.at) <= windowMs);
    const total = recent.reduce((sum, r) => sum + r.durationMs, 0);
    return {
      count: recent.length,
      clientErrors: recent.filter((r) => r.status >= 400 && r.status < 500).length,
      serverErrors: recent.filter((r) => r.status >= 500).length,
      avgMs: recent.length ? Math.round(total / recent.length) : 0,
    };
  }
}
