import { Global, Module } from "@nestjs/common";
import { LocalDiskStorage } from "./local-disk.storage";
import { StorageService } from "./storage.service";

// Đổi nơi lưu file: thay useClass bằng lớp mới (ví dụ S3Storage).
@Global()
@Module({
  providers: [{ provide: StorageService, useClass: LocalDiskStorage }],
  exports: [StorageService],
})
export class StorageModule {}
