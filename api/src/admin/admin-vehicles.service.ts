import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { ApiError } from "../common/api-error";
import { PrismaService } from "../common/prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import type { ListVehiclesQuery } from "../vehicles/dto/list-vehicles.query";
import type { Page } from "../vehicles/vehicle.view";
import { ADMIN_VEHICLE_SELECT, AdminVehicle, AdminVehicleRow } from "./admin-vehicle.view";

function notFound(): ApiError {
  return new ApiError(404, "NOT_FOUND", "Không tìm thấy xe.");
}

function changedMeanwhile(): ApiError {
  return new ApiError(
    409,
    "INVALID_STATE",
    "Xe vừa được cập nhật (đổi trạng thái hoặc đổi ảnh). Vui lòng tải lại và thử lại.",
  );
}

@Injectable()
export class AdminVehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private toView(row: AdminVehicleRow): AdminVehicle {
    return {
      ...row,
      images: row.images.map((image) => ({
        id: image.id,
        url: this.storage.publicUrl(image.storageKey),
        position: image.position,
      })),
    };
  }

  private async findOrThrow(vehicleId: string): Promise<AdminVehicleRow> {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId }, select: ADMIN_VEHICLE_SELECT });
    if (!vehicle) throw notFound();
    return vehicle;
  }

  async list(query: ListVehiclesQuery): Promise<Page<AdminVehicle>> {
    const where: Prisma.VehicleWhereInput = query.status ? { status: query.status } : {};
    // Hàng đợi duyệt: xe chờ lâu nhất lên đầu. Các danh sách khác: mới nhất lên đầu.
    const direction = query.status === "pending" ? "asc" : "desc";
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        select: ADMIN_VEHICLE_SELECT,
        orderBy: [{ updatedAt: direction }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.vehicle.count({ where }),
    ]);
    return { items: rows.map((row) => this.toView(row)), total, page: query.page, limit: query.limit };
  }

  // Duyệt: pending -> approved. Điều kiện status và "có ít nhất một ảnh" nằm ngay trong WHERE của câu UPDATE, nên nếu
  // chủ xe vừa sửa xe, hoặc hai admin bấm cùng lúc, thì chỉ một bên thắng và bên kia nhận 409 thay vì ghi đè.
  async approve(adminId: string, vehicleId: string): Promise<AdminVehicle> {
    const current = await this.findOrThrow(vehicleId);
    if (current.status === "approved") return this.toView(current);
    if (current.status !== "pending") {
      throw new ApiError(409, "INVALID_STATE", "Chỉ xe đang chờ duyệt mới duyệt được.");
    }
    if (current.images.length === 0) {
      throw new ApiError(
        409,
        "INVALID_STATE",
        "Xe chưa có ảnh nào nên chưa thể duyệt. Hãy từ chối kèm lý do để chủ xe bổ sung ảnh.",
      );
    }

    const result = await this.prisma.vehicle.updateMany({
      where: { id: vehicleId, status: "pending", images: { some: {} } },
      data: { status: "approved", rejectReason: null, reviewedById: adminId, reviewedAt: new Date() },
    });
    if (result.count === 0) throw changedMeanwhile();
    return this.toView(await this.findOrThrow(vehicleId));
  }

  // Từ chối: pending -> rejected kèm lý do. Gọi lặp lại trên xe đã bị từ chối thì giữ nguyên lý do đầu tiên.
  async reject(adminId: string, vehicleId: string, reason: string): Promise<AdminVehicle> {
    const current = await this.findOrThrow(vehicleId);
    if (current.status === "rejected") return this.toView(current);
    if (current.status !== "pending") {
      throw new ApiError(409, "INVALID_STATE", "Chỉ xe đang chờ duyệt mới từ chối được.");
    }

    const result = await this.prisma.vehicle.updateMany({
      where: { id: vehicleId, status: "pending" },
      data: { status: "rejected", rejectReason: reason, reviewedById: adminId, reviewedAt: new Date() },
    });
    if (result.count === 0) throw changedMeanwhile();
    return this.toView(await this.findOrThrow(vehicleId));
  }
}
