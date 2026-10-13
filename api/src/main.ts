import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";
import { BufferLogger } from "./dev/buffer-logger";
import { ObservabilityService } from "./dev/observability.service";

async function bootstrap(): Promise<void> {
  // bufferLogs: giữ các dòng log lúc khởi động cho tới khi logger thật được gắn, để chúng cũng vào nhật ký của trang dev.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(new BufferLogger(app.get(ObservabilityService)));
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 4000));
}

void bootstrap();
