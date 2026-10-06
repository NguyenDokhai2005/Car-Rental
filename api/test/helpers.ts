import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import type { Prisma, User, UserRole, Vehicle } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { PrismaService } from "../src/common/prisma/prisma.service";

export const DAY_MS = 24 * 60 * 60 * 1000;

export type TestContext = { app: INestApplication; prisma: PrismaService; jwt: JwtService };

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const nest = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(nest);
  await nest.init();
  return { app: nest, prisma: nest.get(PrismaService), jwt: nest.get(JwtService) };
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    "TRUNCATE TABLE license_access_logs, payments, bookings, vehicle_blocks, vehicle_images, vehicles, refresh_tokens, users CASCADE",
  );
}

let userCounter = 0;

// Tạo người dùng thẳng trong DB rồi ký access token, bỏ qua đăng nhập (băm argon2 chậm) để test nhanh.
// Guard vẫn đọc lại người dùng từ DB nên token này được kiểm tra như thật.
export async function makeUser(
  ctx: TestContext,
  role: UserRole,
): Promise<{ user: User; token: string; auth: { Authorization: string } }> {
  userCounter += 1;
  const user = await ctx.prisma.user.create({
    data: {
      email: `${role}${userCounter}@test.vn`,
      passwordHash: "khong-dung-de-dang-nhap",
      fullName: `Người dùng ${role} ${userCounter}`,
      phone: "0901234567",
      role,
    },
  });
  const token = await ctx.jwt.signAsync({ sub: user.id, role });
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
}

let plateCounter = 0;

export function vehiclePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  plateCounter += 1;
  return {
    brand: "Toyota",
    model: "Vios",
    year: 2022,
    plateNumber: `51K${String(10000 + plateCounter)}`,
    seats: 5,
    transmission: "automatic",
    fuel: "petrol",
    description: "Xe sạch, bảo dưỡng định kỳ",
    city: "TP. Hồ Chí Minh",
    district: "Quận 7",
    pricePerDay: 650000,
    ...overrides,
  };
}

// Tạo xe trực tiếp trong DB với trạng thái tùy ý (ví dụ approved, vì admin duyệt xe chưa có API).
export function makeVehicle(
  ctx: TestContext,
  ownerId: string,
  overrides: Partial<Prisma.VehicleUncheckedCreateInput> = {},
): Promise<Vehicle> {
  plateCounter += 1;
  return ctx.prisma.vehicle.create({
    data: {
      ownerId,
      title: "Toyota Vios 2022",
      brand: "Toyota",
      model: "Vios",
      year: 2022,
      plateNumber: `30A${String(50000 + plateCounter)}`,
      seats: 5,
      transmission: "automatic",
      fuel: "petrol",
      city: "TP. Hồ Chí Minh",
      district: "Quận 7",
      pricePerDay: 650000,
      status: "approved",
      ...overrides,
    },
  });
}

export function makeBooking(
  ctx: TestContext,
  vehicleId: string,
  renterId: string,
  startAt: Date,
  endAt: Date,
  status: "pending" | "confirmed" | "in_use" | "completed" | "cancelled" | "expired" | "rejected" = "confirmed",
) {
  // CSDL buộc đơn confirmed, in_use, completed phải đã thanh toán, và đơn in_use phải có xác nhận giao xe của cả hai bên.
  const paid = status === "confirmed" || status === "in_use" || status === "completed";
  const handedOver = status === "in_use" || status === "completed";
  return ctx.prisma.booking.create({
    data: {
      vehicleId,
      renterId,
      startAt,
      endAt,
      status,
      rentalDays: 1,
      pricePerDay: 650000,
      totalAmount: 650000,
      depositAmount: 195000,
      paidAt: paid ? new Date() : null,
      paidAmount: paid ? 650000 + 195000 : 0,
      ownerHandedOverAt: handedOver ? startAt : null,
      renterReceivedAt: handedOver ? startAt : null,
      cancelledAt: status === "cancelled" ? new Date() : null,
      rejectReason: status === "rejected" ? "Không phù hợp" : null,
    },
  });
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
