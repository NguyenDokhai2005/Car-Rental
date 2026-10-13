import type { SystemStatus } from "./api";
import { Health, percent, usageHealth } from "./format";

// Quy tắc đánh giá "Hoạt động / Cần chú ý / Có sự cố" của từng phần, dùng chung cho thẻ tóm tắt và bảng chi tiết.

const worst = (...levels: Health[]): Health => (levels.includes("bad") ? "bad" : levels.includes("warn") ? "warn" : "good");

export function serverHealth(server: SystemStatus["server"]): Health {
  if (!server.ok) return "bad";
  const ram = usageHealth(percent(server.memoryMb.total - server.memoryMb.available, server.memoryMb.total));
  const disk = usageHealth(percent(server.uploadDisk.totalGb - server.uploadDisk.freeGb, server.uploadDisk.totalGb));
  // Tải trung bình 1 phút vượt số CPU nghĩa là có việc đang phải xếp hàng chờ CPU.
  const load: Health = server.loadAverage[0] > server.cpuCount ? "warn" : "good";
  return worst(ram, disk, load);
}

export function apiHealth(api: SystemStatus["api"]): Health {
  if (api.last5Minutes.serverErrors > 0) return "bad";
  const heap = usageHealth(percent(api.memoryMb.heapUsed, api.memoryMb.heapLimit));
  return worst(heap, api.eventLoopDelayMs.p99 > 200 ? "warn" : "good");
}

export function webHealth(web: SystemStatus["web"]): Health {
  if (!web.ok || !web.healthy) return "bad";
  return web.responseMs > 1500 ? "warn" : "good";
}

export function databaseHealth(database: SystemStatus["database"]): Health {
  if (!database.ok) return "bad";
  const connections = usageHealth(percent(database.connections.total, database.connections.max));
  const slow: Health = database.pingMs > 200 || database.longestQuerySeconds > 30 ? "warn" : "good";
  return worst(connections, slow);
}
