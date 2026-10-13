import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ClientLogsController } from "./client-logs.controller";
import { DatabaseBrowserService } from "./database-browser.service";
import { DevDatabaseController } from "./dev-database.controller";
import { DevController } from "./dev.controller";
import { MetricsHistoryService } from "./metrics-history.service";
import { ObservabilityService } from "./observability.service";
import { RequestLogMiddleware } from "./request-log.middleware";
import { SystemStatusService } from "./system-status.service";

// Toàn cục để main.ts lấy được ObservabilityService cho logger, và middleware ghi nhật ký áp dụng cho mọi route.
@Global()
@Module({
  controllers: [DevController, DevDatabaseController, ClientLogsController],
  providers: [ObservabilityService, SystemStatusService, MetricsHistoryService, DatabaseBrowserService],
  exports: [ObservabilityService],
})
export class DevModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLogMiddleware).forRoutes("*");
  }
}
