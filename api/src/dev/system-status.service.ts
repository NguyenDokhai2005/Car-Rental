import { readFile, statfs } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import v8 from "node:v8";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../common/prisma/prisma.service";
import { uploadRoot } from "../storage/local-disk.storage";
import { ObservabilityService } from "./observability.service";

const MB = 1024 * 1024;
const WEB_TIMEOUT_MS = 3000;
const SUMMARY_WINDOW_MS = 5 * 60 * 1000;
const LOOP_RESOLUTION_MS = 20;

type Failed = { ok: false; error: string };

// Mỗi phần tự bắt lỗi của mình: CSDL sập không được làm cả trang trạng thái trả 500, vì đó chính là lúc cần xem nhất.
async function section<T extends object>(read: () => Promise<T>): Promise<({ ok: true } & T) | Failed> {
  try {
    return { ok: true, ...(await read()) };
  } catch (error) {
    // Chỉ trả tên và mã lỗi, không trả message: message của driver có thể chứa chuỗi kết nối hoặc đường dẫn nội bộ.
    const e = error as { name?: string; code?: string };
    return { ok: false, error: [e.name, e.code].filter(Boolean).join(" ") || "Lỗi không xác định" };
  }
}

// Giới hạn RAM của container (cgroup v2). Trong container, os.totalmem() trả RAM của máy chủ chứ không phải giới hạn này.
async function containerMemoryLimitMb(): Promise<number | null> {
  try {
    const raw = (await readFile("/sys/fs/cgroup/memory.max", "utf8")).trim();
    return raw === "max" ? null : Math.round(Number(raw) / MB);
  } catch {
    return null;
  }
}

// RAM còn dùng được. Trên Linux, os.freemem() chỉ tính phần hoàn toàn trống và bỏ qua bộ đệm file mà hệ điều hành sẵn sàng
// nhả ra, nên máy chủ khỏe mạnh vẫn trông như sắp hết RAM. MemAvailable trong /proc/meminfo mới là con số đúng.
// Kèm vùng swap: máy ít RAM dùng swap nhiều là dấu hiệu sắp chậm hẳn. Ngoài Linux không đọc được swap nên trả null.
export async function readMemory(): Promise<{ totalMb: number; availableMb: number; swapMb: { total: number; used: number } | null }> {
  const totalMb = Math.round(os.totalmem() / MB);
  try {
    const text = await readFile("/proc/meminfo", "utf8");
    const field = (name: string) => {
      const match = new RegExp(`^${name}:\\s+(\\d+) kB`, "m").exec(text);
      return match ? Math.round(Number(match[1]) / 1024) : null;
    };
    const available = field("MemAvailable");
    const swapTotal = field("SwapTotal");
    const swapFree = field("SwapFree");
    if (available !== null) {
      return { totalMb, availableMb: available, swapMb: swapTotal !== null && swapFree !== null ? { total: swapTotal, used: swapTotal - swapFree } : null };
    }
  } catch {
    // Không phải Linux: dùng số của Node bên dưới.
  }
  return { totalMb, availableMb: Math.round(os.freemem() / MB), swapMb: null };
}

// Thư mục ảnh chỉ được tạo khi có ảnh đầu tiên. Chưa có thì đo ổ đĩa qua thư mục cha gần nhất đang tồn tại: cùng một ổ.
async function diskOf(directory: string) {
  let current = path.resolve(directory);
  for (;;) {
    try {
      return await statfs(current);
    } catch (error) {
      const parent = path.dirname(current);
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" || parent === current) throw error;
      current = parent;
    }
  }
}

@Injectable()
export class SystemStatusService implements OnModuleDestroy {
  // Độ trễ vòng lặp sự kiện: nếu Node bị một việc nặng chiếm CPU (xử lý ảnh, băm mật khẩu), mọi yêu cầu khác phải chờ,
  // và con số này tăng lên. Đây là chỉ báo sớm nhất cho việc API "đơ" trên máy một lõi.
  private readonly loopDelay = monitorEventLoopDelay({ resolution: LOOP_RESOLUTION_MS });

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly observability: ObservabilityService,
  ) {
    this.loopDelay.enable();
  }

  onModuleDestroy(): void {
    this.loopDelay.disable();
  }

  async snapshot() {
    const [server, database, web] = await Promise.all([
      section(() => this.server()),
      section(() => this.database()),
      section(() => this.probeWeb()),
    ]);
    return { at: new Date().toISOString(), api: this.api(), server, database, web };
  }

  private api() {
    const memory = process.memoryUsage();
    // Bộ đo ghi khoảng cách giữa hai lần hẹn giờ (bằng chu kỳ lấy mẫu khi không trễ), nên phải trừ chu kỳ đi mới ra độ trễ.
    const late = (nanoseconds: number) => Number(Math.max(0, nanoseconds / 1e6 - LOOP_RESOLUTION_MS).toFixed(1));
    // Chưa có mẫu nào thì mean là NaN.
    const sampled = this.loopDelay.count > 0;
    const eventLoopDelayMs = {
      mean: sampled ? late(this.loopDelay.mean) : 0,
      p99: sampled ? late(this.loopDelay.percentile(99)) : 0,
      max: sampled ? late(this.loopDelay.max) : 0,
    };
    this.loopDelay.reset();
    return {
      ok: true as const,
      environment: this.config.get<string>("NODE_ENV") ?? "development",
      nodeVersion: process.version,
      pid: process.pid,
      uptimeSeconds: Math.round(process.uptime()),
      memoryMb: {
        rss: Math.round(memory.rss / MB),
        heapUsed: Math.round(memory.heapUsed / MB),
        heapLimit: Math.round(v8.getHeapStatistics().heap_size_limit / MB),
      },
      eventLoopDelayMs,
      last5Minutes: this.observability.recentSummary(SUMMARY_WINDOW_MS),
    };
  }

  private async server() {
    const disk = await diskOf(uploadRoot(this.config));
    const [load1, load5, load15] = os.loadavg();
    const memory = await readMemory();
    return {
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()}`,
      uptimeSeconds: Math.round(os.uptime()),
      cpuCount: os.cpus().length,
      loadAverage: [load1, load5, load15].map((value) => Number(value.toFixed(2))),
      memoryMb: { total: memory.totalMb, available: memory.availableMb },
      swapMb: memory.swapMb,
      containerMemoryLimitMb: await containerMemoryLimitMb(),
      uploadDisk: {
        totalGb: Number(((disk.blocks * disk.bsize) / 1024 ** 3).toFixed(1)),
        freeGb: Number(((disk.bavail * disk.bsize) / 1024 ** 3).toFixed(1)),
      },
    };
  }

  private async database() {
    const started = Date.now();
    const [{ version }] = await this.prisma.$queryRaw<{ version: string }[]>`SELECT version()`;
    const pingMs = Date.now() - started;

    const [size] = await this.prisma.$queryRaw<{ bytes: bigint; max_connections: string }[]>`
      SELECT pg_database_size(current_database()) AS bytes, current_setting('max_connections') AS max_connections`;
    const connections = await this.prisma.$queryRaw<{ state: string | null; count: bigint }[]>`
      SELECT state, count(*) AS count FROM pg_stat_activity WHERE datname = current_database() GROUP BY state`;
    const tables = await this.prisma.$queryRaw<{ name: string; rows: bigint; bytes: bigint }[]>`
      SELECT relname AS name, n_live_tup AS rows, pg_total_relation_size(relid) AS bytes
      FROM pg_stat_user_tables WHERE relname <> '_prisma_migrations' ORDER BY pg_total_relation_size(relid) DESC`;
    const [migrations] = await this.prisma.$queryRaw<{ applied: bigint; latest: string | null }[]>`
      SELECT count(*) AS applied, max(migration_name) AS latest FROM _prisma_migrations WHERE finished_at IS NOT NULL`;

    const [activity] = await this.prisma.$queryRaw<{ uptime_seconds: number; longest_query_seconds: number; cache_hit_percent: number | null; deadlocks: bigint; rollbacks: bigint }[]>`
      SELECT extract(epoch FROM now() - pg_postmaster_start_time())::float8 AS uptime_seconds,
        coalesce((SELECT max(extract(epoch FROM now() - query_start)) FROM pg_stat_activity
          WHERE state = 'active' AND datname = current_database() AND pid <> pg_backend_pid()), 0)::float8 AS longest_query_seconds,
        (100.0 * d.blks_hit / nullif(d.blks_hit + d.blks_read, 0))::float8 AS cache_hit_percent,
        d.deadlocks, d.xact_rollback AS rollbacks
      FROM pg_stat_database d WHERE d.datname = current_database()`;

    return {
      pingMs,
      uptimeSeconds: Math.round(activity.uptime_seconds),
      // Tỷ lệ đọc dữ liệu từ bộ nhớ đệm thay vì từ đĩa. Dưới khoảng 95% trên CSDL đã chạy lâu là dấu hiệu thiếu RAM cho CSDL.
      cacheHitPercent: activity.cache_hit_percent === null ? null : Number(activity.cache_hit_percent.toFixed(1)),
      longestQuerySeconds: Number(activity.longest_query_seconds.toFixed(1)),
      deadlocks: Number(activity.deadlocks),
      rollbacks: Number(activity.rollbacks),
      // "PostgreSQL 16.4 on x86_64-..." -> "PostgreSQL 16.4"
      version: version.split(" ").slice(0, 2).join(" "),
      sizeMb: Number((Number(size.bytes) / MB).toFixed(1)),
      connections: {
        max: Number(size.max_connections),
        total: connections.reduce((sum, row) => sum + Number(row.count), 0),
        active: Number(connections.find((row) => row.state === "active")?.count ?? 0),
      },
      // n_live_tup là số dòng ƯỚC LƯỢNG của PostgreSQL (cập nhật khi autovacuum chạy), đủ để theo dõi, không phải số đếm chính xác.
      tables: tables.map((table) => ({ name: table.name, rows: Number(table.rows), sizeMb: Number((Number(table.bytes) / MB).toFixed(2)) })),
      migrations: { applied: Number(migrations.applied), latest: migrations.latest },
    };
  }

  // API gọi thử máy chủ web qua mạng nội bộ. Biết được web còn sống và phản hồi nhanh hay chậm, không cần quyền Docker.
  async probeWeb() {
    const base = this.config.get<string>("WEB_INTERNAL_URL") ?? "http://localhost:3000";
    const started = Date.now();
    const response = await fetch(`${base}/login`, { signal: AbortSignal.timeout(WEB_TIMEOUT_MS), redirect: "manual" });
    await response.arrayBuffer();
    return { status: response.status, responseMs: Date.now() - started, healthy: response.status === 200 };
  }
}
