import { tmpdir } from "node:os";
import { join } from "node:path";
import { TEST_DATABASE_URL } from "./test-db";

// Chạy trước mỗi file test, trước khi Nest đọc cấu hình.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_ACCESS_SECRET = "test-secret-test-secret-test-secret-0123456789";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.THROTTLE_DISABLED = "1";
// Bộ hẹn giờ của job nền (nhả đơn hết hạn) không được bật khi test: test gọi thẳng run() để kết quả không phụ thuộc đồng hồ.
process.env.JOBS_DISABLED = "1";
// Ảnh tải lên khi test nằm trong thư mục tạm của hệ điều hành, không lẫn vào thư mục uploads thật.
process.env.UPLOAD_DIR = join(tmpdir(), "carrental-test-uploads");
