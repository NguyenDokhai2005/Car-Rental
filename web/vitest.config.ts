import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Cùng bí danh với tsconfig.json ("@/*" là "./src/*"), để test nhập module theo đúng cách mã nguồn đang nhập.
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
