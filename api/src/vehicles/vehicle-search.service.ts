import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { ApiError } from "../common/api-error";
import { holdingBookingWhere } from "../common/booking-holds";
import { PrismaService } from "../common/prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import type { SearchVehiclesQuery, VehicleSort } from "./dto/search-vehicles.query";
import {
  PUBLIC_DETAIL_SELECT,
  PUBLIC_LIST_SELECT,
  PublicDetailRow,
  PublicListRow,
  PublicVehicleDetail,
  PublicVehicleListItem,
} from "./public-vehicle.view";
import type { Page } from "./vehicle.view";

const MAX_SEARCH_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

function invalid(message: string): ApiError {
  return new ApiError(400, "VALIDATION_ERROR", message);
}

// Prisma `contains` không thoát ký tự đại diện của LIKE: "%" hoặc "_" do người dùng gõ sẽ khớp mọi xe. Thêm dấu gạch chéo
// ngược trước "%", "_" và chính dấu gạch chéo ngược để chuỗi tìm được hiểu đúng nghĩa đen.
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}

const ORDER: Record<VehicleSort, Prisma.VehicleOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }, { id: "asc" }],
  price_asc: [{ pricePerDay: "asc" }, { id: "asc" }],
  price_desc: [{ pricePerDay: "desc" }, { id: "asc" }],
};

@Injectable()
export class VehicleSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private url(storageKey: string): string {
    return this.storage.publicUrl(storageKey);
  }

  private toListItem({ images, ...fields }: PublicListRow): PublicVehicleListItem {
    return { ...fields, coverUrl: images[0] ? this.url(images[0].storageKey) : null };
  }

  private toDetail({ images, owner, description, ...fields }: PublicDetailRow): PublicVehicleDetail {
    return {
      ...fields,
      description,
      coverUrl: images[0] ? this.url(images[0].storageKey) : null,
      images: images.map((image) => ({ id: image.id, url: this.url(image.storageKey), position: image.position })),
      owner: { fullName: owner.fullName },
    };
  }

  // Kiểm tra các điều kiện liên quan giữa nhiều tham số mà từng trường riêng lẻ không bắt được.
  private parseRange(query: SearchVehiclesQuery): { start: Date; end: Date } | null {
    if (query.minPrice !== undefined && query.maxPrice !== undefined && query.minPrice > query.maxPrice) {
      throw invalid("minPrice không được lớn hơn maxPrice.");
    }
    if ((query.startAt === undefined) !== (query.endAt === undefined)) {
      throw invalid("startAt và endAt phải đi cùng nhau.");
    }
    if (query.startAt === undefined || query.endAt === undefined) return null;

    const start = new Date(query.startAt);
    const end = new Date(query.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw invalid("Thời gian không hợp lệ.");
    if (end <= start) throw invalid("Thời gian kết thúc phải sau thời gian bắt đầu.");
    if (end <= new Date()) throw invalid("Không thể tìm xe cho khoảng thời gian đã qua.");
    if (end.getTime() - start.getTime() > MAX_SEARCH_DAYS * DAY_MS) {
      throw invalid(`Khoảng tìm kiếm tối đa ${MAX_SEARCH_DAYS} ngày.`);
    }
    return { start, end };
  }

  async search(query: SearchVehiclesQuery): Promise<Page<PublicVehicleListItem>> {
    const range = this.parseRange(query);

    const where: Prisma.VehicleWhereInput = { status: "approved" };
    if (query.city) where.city = { contains: escapeLike(query.city), mode: "insensitive" };
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.pricePerDay = { gte: query.minPrice, lte: query.maxPrice };
    }
    if (query.seats?.length) where.seats = { in: query.seats };
    if (query.fuel?.length) where.fuel = { in: query.fuel };
    if (query.transmission?.length) where.transmission = { in: query.transmission };
    if (range) {
      // Xe còn trống = không có đơn đang giữ lịch và không có lịch chặn giao với khoảng [start, end).
      // Cùng điều kiện giao nhau với availability.service và ràng buộc EXCLUDE của CSDL.
      const overlap = { startAt: { lt: range.end }, endAt: { gt: range.start } };
      where.bookings = { none: { ...holdingBookingWhere(new Date()), ...overlap } };
      where.blocks = { none: overlap };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        select: PUBLIC_LIST_SELECT,
        orderBy: ORDER[query.sort],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.vehicle.count({ where }),
    ]);
    return { items: rows.map((row) => this.toListItem(row)), total, page: query.page, limit: query.limit };
  }

  // Xe chưa duyệt, bị ẩn hoặc bị từ chối đều trả 404 như xe không tồn tại: không lộ sự tồn tại của xe chưa công khai.
  async getOne(vehicleId: string): Promise<PublicVehicleDetail> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, status: "approved" },
      select: PUBLIC_DETAIL_SELECT,
    });
    if (!vehicle) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy xe.");
    return this.toDetail(vehicle);
  }
}
