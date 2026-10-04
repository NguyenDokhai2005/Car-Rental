import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./common/prisma/prisma.module";
import { validateEnv } from "./config/env";
import { StorageModule } from "./storage/storage.module";
import { UsersModule } from "./users/users.module";
import { VehiclesModule } from "./vehicles/vehicles.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Giới hạn mặc định theo IP; các endpoint nhạy cảm (đăng nhập, đăng ký) đặt giới hạn chặt hơn bằng @Throttle.
    ThrottlerModule.forRoot({
      throttlers: [{ name: "default", ttl: 60_000, limit: 120 }],
      skipIf: () => process.env.THROTTLE_DISABLED === "1",
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
    UsersModule,
    VehiclesModule,
    AdminModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
