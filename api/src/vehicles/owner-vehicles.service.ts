import { Injectable } from "@nestjs/common";
import type { Prisma, VehicleBlock } from "@prisma/client";
import { ApiError } from "../common/api-error";
import { releaseExpiredHolds } from "../common/booking-holds";
import { ACTIVE_BOOKING_STATUSES } from "../common/constants";
import { isExclusionViolation, isUniqueViolation } from "../common/db-errors";
import { PrismaService } from "../common/prisma/prisma.service";
import { lockVehicle } from "../common/vehicle-lock";
import { AvailabilityService } from "./availability.service";
import type { CreateBlockDto } from "./dto/create-block.dto";
import type { CreateVehicleDto } from "./dto/create-vehicle.dto";
import type { ListVehiclesQuery } from "./dto/list-vehicles.query";
import type { UpdateVehicleDto } from "./dto/update-vehicle.dto";
import { buildTitle, diffEditable, EDITABLE_FIELDS, nextStatusAfterEdit, EditableField } from "./vehicle-rules";
import { OWNER_VEHICLE_SELECT, OwnerVehicle, Page } from "./vehicle.view";

const MAX_BLOCK_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

function notFound(): ApiError {
  return new ApiError(404, "NOT_FOUND", "Không tìm thấy xe.");
}

function plateTaken(): ApiError {
  return new ApiError(409, "PLATE_TAKEN", "Biển số này đã được đăng ký cho một xe khác.");
}

@Injectable()
export class OwnerVehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  // Mọi truy vấn xe của chủ xe đều đi qua đây. Điều kiện ownerId nằm trong WHERE nên xe của người khác
  // không thể bị đọc hay sửa, và trả 404 y như xe không tồn tại.
  private async findOwnedOrThrow(ownerId: string, vehicleId: string): Promise<OwnerVehicle> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, ownerId },
      select: OWNER_VEHICLE_SELECT,
    });
    if (!vehicle) throw notFound();
    return vehicle;
  }

  async create(ownerId: string, dto: CreateVehicleDto): Promise<OwnerVehicle> {
    try {
      return await this.prisma.vehicle.create({
        data: { ...dto, ownerId, title: buildTitle(dto) },
        select: OWNER_VEHICLE_SELECT,
      });
    } catch (error) {
      if (isUniqueViolation(error, "plate_number")) throw plateTaken();
      throw error;
    }
  }

  async list(ownerId: string, query: ListVehiclesQuery): Promise<Page<OwnerVehicle>> {
    const where: Prisma.VehicleWhereInput = { ownerId, ...(query.status ? { status: query.status } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        select: OWNER_VEHICLE_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.vehicle.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  getOne(ownerId: string, vehicleId: string): Promise<OwnerVehicle> {
    return this.findOwnedOrThrow(ownerId, vehicleId);
  }

  async update(ownerId: string, vehicleId: string, dto: UpdateVehicleDto): Promise<OwnerVehicle> {
    if (EDITABLE_FIELDS.every((field) => dto[field] === undefined)) {
      throw new ApiError(400, "VALIDATION_ERROR", "Cần cung cấp ít nhất một trường để cập nhật.");
    }

    const current = await this.findOwnedOrThrow(ownerId, vehicleId);
    const changes = diffEditable(current, dto);
    const changedFields = Object.keys(changes) as EditableField[];
    if (changedFields.length === 0) return current;

    const status = nextStatusAfterEdit(current.status, changedFields);
    const backToReview = status === "pending" && current.status !== "pending";

    try {
      // Điều kiện status trong WHERE: nếu admin vừa duyệt hoặc từ chối giữa lúc đọc và ghi thì không ghi đè lên.
      const result = await this.prisma.vehicle.updateMany({
        where: { id: vehicleId, ownerId, status: current.status },
        data: {
          ...changes,
          status,
          ...(changes.brand || changes.model || changes.year
            ? { title: buildTitle({ ...current, ...changes }) }
            : {}),
          // Nộp lại để duyệt thì xóa kết quả duyệt cũ
          ...(backToReview || current.status === "rejected"
            ? { rejectReason: null, reviewedById: null, reviewedAt: null }
            : {}),
        },
      });
      if (result.count === 0) {
        throw new ApiError(409, "INVALID_STATE", "Trạng thái xe vừa thay đổi. Vui lòng tải lại và thử lại.");
      }
    } catch (error) {
      if (isUniqueViolation(error, "plate_number")) throw plateTaken();
      throw error;
    }

    return this.findOwnedOrThrow(ownerId, vehicleId);
  }

  // Ẩn xe: approved -> hidden. Hiện lại: hidden -> approved (không cần duyệt lại vì mọi thay đổi quan trọng
  // trong lúc ẩn đã đưa xe về pending). Gọi lặp lại với cùng giá trị là thành công và không đổi gì.
  async setHidden(ownerId: string, vehicleId: string, hidden: boolean): Promise<OwnerVehicle> {
    const current = await this.findOwnedOrThrow(ownerId, vehicleId);
    const from = hidden ? "approved" : "hidden";
    const to = hidden ? "hidden" : "approved";

    if (current.status === to) return current;
    if (current.status !== from) {
      throw new ApiError(
        409,
        "INVALID_STATE",
        hidden ? "Chỉ xe đã được duyệt mới ẩn được." : "Chỉ xe đang ẩn mới hiện lại được.",
      );
    }

    const result = await this.prisma.vehicle.updateMany({
      where: { id: vehicleId, ownerId, status: from },
      data: { status: to },
    });
    if (result.count === 0) {
      throw new ApiError(409, "INVALID_STATE", "Trạng thái xe vừa thay đổi. Vui lòng tải lại và thử lại.");
    }
    return this.findOwnedOrThrow(ownerId, vehicleId);
  }

  // ---- Lịch chặn ----

  async listBlocks(ownerId: string, vehicleId: string): Promise<VehicleBlock[]> {
    await this.findOwnedOrThrow(ownerId, vehicleId);
    return this.prisma.vehicleBlock.findMany({ where: { vehicleId }, orderBy: { startAt: "asc" } });
  }

  async createBlock(ownerId: string, vehicleId: string, dto: CreateBlockDto): Promise<VehicleBlock> {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new ApiError(400, "VALIDATION_ERROR", "Thời gian không hợp lệ.");
    }
    if (endAt <= startAt) {
      throw new ApiError(400, "VALIDATION_ERROR", "Thời gian kết thúc phải sau thời gian bắt đầu.");
    }
    if (endAt <= new Date()) {
      throw new ApiError(400, "VALIDATION_ERROR", "Không thể chặn một khoảng thời gian đã qua.");
    }
    if (endAt.getTime() - startAt.getTime() > MAX_BLOCK_DAYS * DAY_MS) {
      throw new ApiError(400, "VALIDATION_ERROR", `Mỗi lịch chặn tối đa ${MAX_BLOCK_DAYS} ngày.`);
    }

    await this.findOwnedOrThrow(ownerId, vehicleId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockVehicle(tx, vehicleId);
        // Đơn pending đã quá hạn giữ chỗ không còn quyền giữ lịch: nhả trước khi kiểm tra, nếu không chủ xe bị chặn oan.
        await releaseExpiredHolds(tx, vehicleId, new Date());

        const conflict = await tx.booking.findFirst({
          where: {
            vehicleId,
            status: { in: ACTIVE_BOOKING_STATUSES },
            startAt: { lt: endAt },
            endAt: { gt: startAt },
          },
          select: { id: true },
        });
        if (conflict) {
          throw new ApiError(409, "BLOCK_CONFLICTS_BOOKING", "Khoảng thời gian này đã có đơn thuê.");
        }

        return tx.vehicleBlock.create({ data: { vehicleId, startAt, endAt, reason: dto.reason } });
      });
    } catch (error) {
      if (isExclusionViolation(error, "vehicle_blocks_no_overlap")) {
        throw new ApiError(409, "BLOCK_OVERLAP", "Khoảng thời gian này trùng với một lịch chặn khác.");
      }
      throw error;
    }
  }

  async deleteBlock(ownerId: string, vehicleId: string, blockId: string): Promise<void> {
    await this.findOwnedOrThrow(ownerId, vehicleId);
    const result = await this.prisma.vehicleBlock.deleteMany({ where: { id: blockId, vehicleId } });
    if (result.count === 0) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy lịch chặn.");
  }

  async calendar(ownerId: string, vehicleId: string, month: string | undefined) {
    await this.findOwnedOrThrow(ownerId, vehicleId);
    return this.availability.ownerCalendar(vehicleId, month);
  }
}
