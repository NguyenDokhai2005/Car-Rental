const REQUIRED = ["DATABASE_URL", "JWT_ACCESS_SECRET"] as const;

// Kiểm tra biến môi trường lúc khởi động để lỗi cấu hình hiện ra ngay thay vì lúc có request.
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  for (const key of REQUIRED) {
    const value = config[key];
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Thiếu biến môi trường ${key}. Xem .env.example.`);
    }
  }

  if (config.NODE_ENV === "production") {
    const secret = String(config.JWT_ACCESS_SECRET);
    if (secret.length < 32 || secret.includes("change-me")) {
      throw new Error("JWT_ACCESS_SECRET phải là chuỗi ngẫu nhiên dài ít nhất 32 ký tự ở production.");
    }
  }

  return config;
}
