// Database test tách riêng khỏi database dev để test có thể TRUNCATE mà không mất dữ liệu mẫu.
export const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? "postgresql://postgres:postgres@localhost:5432/carrental_test";

export function testDatabaseName(): string {
  const name = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");
  // Chốt an toàn: chỉ làm việc với database có đuôi _test.
  if (!name.endsWith("_test")) {
    throw new Error(`Tên database test phải kết thúc bằng _test (đang là "${name}").`);
  }
  return name;
}

export function adminDatabaseUrl(): string {
  const url = new URL(TEST_DATABASE_URL);
  url.pathname = "/postgres";
  return url.toString();
}
