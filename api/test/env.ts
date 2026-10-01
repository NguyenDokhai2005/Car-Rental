import { TEST_DATABASE_URL } from "./test-db";

// Chạy trước mỗi file test, trước khi Nest đọc cấu hình.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_ACCESS_SECRET = "test-secret-test-secret-test-secret-0123456789";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.THROTTLE_DISABLED = "1";
