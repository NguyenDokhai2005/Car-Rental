import { ConsoleLogger, LogLevel } from "@nestjs/common";
import type { ObservabilityService } from "./observability.service";

const MAX_MESSAGE = 4000;

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.stack ?? value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// Logger của Nest: vẫn in ra console như cũ (để `docker logs` còn đầy đủ), đồng thời chép mỗi dòng vào nhật ký trong bộ
// nhớ cho trang dev. Tham số cuối của các hàm log của Nest là "context" (tên lớp ghi log) nếu nó là chuỗi.
export class BufferLogger extends ConsoleLogger {
  constructor(private readonly observability: ObservabilityService) {
    super();
  }

  private capture(level: LogLevel, message: unknown, rest: unknown[]): void {
    const last = rest[rest.length - 1];
    const context = rest.length > 0 && typeof last === "string" ? last : undefined;
    const extra = (context ? rest.slice(0, -1) : rest).filter((part) => part !== undefined).map(toText);
    this.observability.recordLog("server", {
      at: new Date().toISOString(),
      level,
      message: [toText(message), ...extra].join("\n").slice(0, MAX_MESSAGE),
      context,
    });
  }

  override log(message: unknown, ...rest: unknown[]): void {
    this.capture("log", message, rest);
    super.log(message, ...(rest as string[]));
  }

  override warn(message: unknown, ...rest: unknown[]): void {
    this.capture("warn", message, rest);
    super.warn(message, ...(rest as string[]));
  }

  override error(message: unknown, ...rest: unknown[]): void {
    this.capture("error", message, rest);
    super.error(message, ...(rest as string[]));
  }
}
