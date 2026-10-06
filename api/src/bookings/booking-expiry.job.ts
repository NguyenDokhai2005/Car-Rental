import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { BookingTransitionsService } from "./booking-transitions.service";

const INTERVAL_MS = 60_000;

// Mỗi phút: đổi các đơn pending quá hạn thành expired (hoàn tiền nếu khách đã trả), và tự hoàn tất các đơn đang thuê đã quá
// giờ trả xe 24 giờ (SPEC §8).
//
// Dùng thẳng setInterval của Node, không thêm thư viện lập lịch và không cần Redis hay dịch vụ ngoài (ràng buộc hạ tầng $0):
// việc cần làm chỉ là "mỗi phút gọi một hàm". Job chạy ngay trong tiến trình API, nên API tắt thì job không chạy, và nếu sau
// này chạy nhiều bản API thì mỗi bản đều chạy job. Cả hai đều không gây sai:
//   - Lịch và trạng thái hiển thị không phụ thuộc job (xem common/booking-holds.ts), job chỉ dọn dữ liệu cho gọn.
//   - Việc job làm là một câu UPDATE có điều kiện, chạy trùng hai lần cũng cho cùng kết quả.
@Injectable()
export class BookingExpiryJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingExpiryJob.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly transitions: BookingTransitionsService) {}

  onModuleInit(): void {
    // Tắt khi chạy test: bộ hẹn giờ nổ giữa một phép thử sẽ đổi dữ liệu ngoài ý muốn và làm test lúc đạt lúc không.
    // Test gọi thẳng run() để kiểm tra việc job làm.
    if (process.env.JOBS_DISABLED === "1") return;
    this.timer = setInterval(() => void this.run(), INTERVAL_MS);
    // Không để bộ hẹn giờ giữ tiến trình sống khi ứng dụng đang tắt.
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // Một lần chạy của job. Trả về số đơn đã xử lý (0 nếu bỏ qua hoặc lỗi).
  async run(): Promise<number> {
    // Lần chạy trước chưa xong (CSDL chậm) thì bỏ qua lần này thay vì chạy chồng lên nhau.
    if (this.running) return 0;
    this.running = true;
    try {
      const expired = await this.transitions.expireOverdue();
      const completed = await this.transitions.autoComplete();
      if (expired > 0) this.logger.log(`Đã nhả ${expired} đơn hết hạn.`);
      if (completed > 0) this.logger.log(`Đã tự hoàn tất ${completed} đơn quá giờ trả xe.`);
      return expired + completed;
    } catch (error) {
      // Không để một lần lỗi (ví dụ CSDL tạm mất kết nối) làm sập tiến trình; phút sau job chạy lại.
      this.logger.error(`Job dọn đơn lỗi: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
