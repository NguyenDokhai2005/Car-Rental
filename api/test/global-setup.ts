import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { adminDatabaseUrl, TEST_DATABASE_URL, testDatabaseName } from "./test-db";

// Tạo database test nếu chưa có, rồi áp dụng toàn bộ migration (gồm cả ràng buộc SQL thô).
export default async function globalSetup(): Promise<void> {
  const name = testDatabaseName();

  const admin = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl() } } });
  try {
    const rows = await admin.$queryRaw<{ present: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = ${name}) AS present`;
    if (!rows[0]?.present) await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.$disconnect();
  }

  execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });
}
