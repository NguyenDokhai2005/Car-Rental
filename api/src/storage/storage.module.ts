import { Global, Module } from "@nestjs/common";
import { LocalDiskStorage } from "./local-disk.storage";
import { PrivateDiskStorage } from "./private-disk.storage";
import { PrivateStorageService } from "./private-storage.service";
import { StorageService } from "./storage.service";

// Đổi nơi lưu file: thay useClass bằng lớp mới (ví dụ S3Storage).
@Global()
@Module({
  providers: [
    { provide: StorageService, useClass: LocalDiskStorage },
    { provide: PrivateStorageService, useClass: PrivateDiskStorage },
  ],
  exports: [StorageService, PrivateStorageService],
})
export class StorageModule {}
