import { Controller, Delete, Get, HttpCode, Query } from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator";
import { ClearLogsQuery, ListLogsQuery, ListRequestsQuery } from "./dto/dev-queries.dto";
import { LogEntry, ObservabilityService, RequestEntry, RouteStats } from "./observability.service";
import { MetricsHistoryService, MetricSample, SAMPLE_INTERVAL_MS } from "./metrics-history.service";
import { SystemStatusService } from "./system-status.service";

// Chỉ vai trò dev. Admin không vào được: hai vai trò tách hẳn nhau (SPEC §1).
@Controller("dev")
@Roles("dev")
export class DevController {
  constructor(
    private readonly observability: ObservabilityService,
    private readonly status: SystemStatusService,
    private readonly metrics: MetricsHistoryService,
  ) {}

  @Get("status")
  getStatus() {
    return this.status.snapshot();
  }

  @Get("metrics")
  getMetrics(): { intervalSeconds: number; samples: MetricSample[] } {
    return { intervalSeconds: SAMPLE_INTERVAL_MS / 1000, samples: this.metrics.list() };
  }

  @Get("requests")
  listRequests(@Query() query: ListRequestsQuery): { items: RequestEntry[]; stats: RouteStats[] } {
    return { items: this.observability.listRequests(query), stats: this.observability.routeStats() };
  }

  @HttpCode(204)
  @Delete("requests")
  clearRequests(): void {
    this.observability.clearRequests();
  }

  @Get("logs")
  listLogs(@Query() query: ListLogsQuery): { items: LogEntry[] } {
    return { items: this.observability.listLogs(query.source, query) };
  }

  @HttpCode(204)
  @Delete("logs")
  clearLogs(@Query() query: ClearLogsQuery): void {
    this.observability.clearLogs(query.source);
  }
}
