import type { Prisma } from "@prisma/client";

export type AdminActionName = "user.block" | "user.unblock" | "user.reset_password" | "vehicle.takedown" | "booking.cancel";

type Target = { userId: string } | { vehicleId: string } | { bookingId: string };

// Ghi một dòng nhật ký thao tác của admin (SPEC §4). Luôn gọi với transaction client của chính thao tác đó: thao tác và
// nhật ký cùng thành công hoặc cùng thất bại, không bao giờ có can thiệp mà không để lại dấu vết.
export async function recordAdminAction(
  tx: Prisma.TransactionClient,
  entry: { adminId: string; action: AdminActionName; target: Target; reason?: string; details?: Prisma.InputJsonObject },
): Promise<void> {
  await tx.adminAction.create({
    data: {
      adminId: entry.adminId,
      action: entry.action,
      targetUserId: "userId" in entry.target ? entry.target.userId : null,
      targetVehicleId: "vehicleId" in entry.target ? entry.target.vehicleId : null,
      targetBookingId: "bookingId" in entry.target ? entry.target.bookingId : null,
      reason: entry.reason ?? null,
      details: entry.details,
    },
  });
}
