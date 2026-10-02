import type { Prisma } from "@prisma/client";

// EXCLUDE chỉ chặn chồng lịch trong một bảng, còn lịch chặn (vehicle_blocks) và đơn (bookings) là hai bảng.
// Mọi thao tác ghi vào một trong hai bảng phải lấy khóa này trước rồi mới kiểm tra bảng kia, nếu không hai request
// đồng thời (một đặt xe, một chặn lịch) có thể cùng thấy "chưa có gì" và cùng ghi thành công.
// Khóa tự nhả khi transaction kết thúc. SELECT bọc ngoài vì Prisma không đọc được cột kiểu void.
export async function lockVehicle(tx: Prisma.TransactionClient, vehicleId: string): Promise<void> {
  await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${vehicleId}, 0))) AS l`;
}
