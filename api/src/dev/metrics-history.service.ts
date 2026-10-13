import os from "node:os";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { ObservabilityService } from "./observability.service";
import { readMemory, SystemStatusService } from "./system-status.service";

export const SAMPLE_INTERVAL_MS = 10_000;
export const SAMPLE_CAPACITY = 360; // 1 giờ
const LOOP_RESOLUTION_MS = 20;
const MB = 1024 * 1024;

// Một điểm trên biểu đồ của trang dev (SPEC §7, mục Dev). null: chỉ số đó không đo được ở mẫu này.
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

type CpuTimes = { idle: number; total: number };

function cpuTimes(): CpuTimes {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
  }
  return { idle, total };
}

// Lấy mẫu chỉ số định kỳ và giữ lại để vẽ biểu đồ đường. Mở trang dev lúc nào cũng thấy ngay một giờ vừa qua, kể cả
// khoảng thời gian không ai mở trang.
@Injectable()
export class MetricsHistoryService implements OnModuleInit, OnModuleDestroy {
  private samples: MetricSample[] = [];
  private timer: NodeJS.Timeout | null = null;
  private sampling = false;
  private previousCpu = cpuTimes();
  private readonly loopDelay = monitorEventLoopDelay({ resolution: LOOP_RESOLUTION_MS });

  constructor(
    private readonly prisma: PrismaService,
    private readonly observability: ObservabilityService,
    private readonly status: SystemStatusService,
  ) {}

  onModuleInit(): void {
    if (process.env.JOBS_DISABLED === "1") return;
    this.loopDelay.enable();
    // unref: bộ hẹn giờ này không được giữ tiến trình sống khi API đang tắt.
    this.timer = setInterval(() => void this.sample(), SAMPLE_INTERVAL_MS).unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.loopDelay.disable();
  }

  list(): MetricSample[] {
    return this.samples;
  }

  async sample(): Promise<void> {
    // CSDL treo thì lần lấy mẫu trước chưa xong: bỏ lượt này thay vì chồng thêm truy vấn lên một CSDL đang quá tải.
    if (this.sampling) return;
    this.sampling = true;
    try {
      const [memory, database, webResponseMs] = await Promise.all([readMemory(), this.probeDatabase(), this.probeWeb()]);
      const usage = process.memoryUsage();
      const interval = this.observability.drainInterval();
      this.samples.push({
        at: new Date().toISOString(),
        cpuPercent: this.cpuPercent(),
        memoryUsedPercent: Math.round(((memory.totalMb - memory.availableMb) / memory.totalMb) * 100),
        rssMb: Math.round(usage.rss / MB),
        heapUsedMb: Math.round(usage.heapUsed / MB),
        ...this.loopDelayMs(),
        ...interval,
        ...database,
        webResponseMs,
      });
      if (this.samples.length > SAMPLE_CAPACITY) this.samples.shift();
    } finally {
      this.sampling = false;
    }
  }

  // % CPU bận trên mọi lõi kể từ mẫu trước: phần thời gian không rảnh trong tổng thời gian đã trôi qua.
  private cpuPercent(): number | null {
    const current = cpuTimes();
    const idle = current.idle - this.previousCpu.idle;
    const total = current.total - this.previousCpu.total;
    this.previousCpu = current;
    return total > 0 ? Math.round((1 - idle / total) * 100) : null;
  }

  private loopDelayMs(): { loopDelayMeanMs: number; loopDelayMaxMs: number } {
    // Bộ đo ghi khoảng cách giữa hai lần hẹn giờ, nên phải trừ chu kỳ lấy mẫu của nó đi mới ra độ trễ.
    const late = (nanoseconds: number) => Number(Math.max(0, nanoseconds / 1e6 - LOOP_RESOLUTION_MS).toFixed(1));
    const sampled = this.loopDelay.count > 0;
    const result = { loopDelayMeanMs: sampled ? late(this.loopDelay.mean) : 0, loopDelayMaxMs: sampled ? late(this.loopDelay.max) : 0 };
    this.loopDelay.reset();
    return result;
  }

  private async probeDatabase(): Promise<{ dbPingMs: number | null; dbConnections: number | null }> {
    try {
      const started = Date.now();
      const [row] = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(*) AS count FROM pg_stat_activity WHERE datname = current_database()`;
      return { dbPingMs: Date.now() - started, dbConnections: Number(row.count) };
    } catch {
      return { dbPingMs: null, dbConnections: null };
    }
  }

  private async probeWeb(): Promise<number | null> {
    try {
      const probe = await this.status.probeWeb();
      return probe.healthy ? probe.responseMs : null;
    } catch {
      return null;
    }
  }
}
