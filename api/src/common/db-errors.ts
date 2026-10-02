import { Prisma } from "@prisma/client";

// Vi phạm UNIQUE. `column` là tên cột trong DB (snake_case), ví dụ "plate_number".
export function isUniqueViolation(error: unknown, column: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.includes(column);
  return typeof target === "string" && target.includes(column);
}

// Vi phạm ràng buộc EXCLUDE (mã PostgreSQL 23P01). Prisma không có mã riêng cho lỗi này nên chỉ nhận ra qua
// tên ràng buộc trong thông báo (đã kiểm chứng với Prisma 6, xem docs/postgresql-guide.md mục 7).
export function isExclusionViolation(error: unknown, constraint: string): boolean {
  return error instanceof Prisma.PrismaClientUnknownRequestError && error.message.includes(constraint);
}
