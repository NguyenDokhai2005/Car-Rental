import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ApiError } from "../common/api-error";
import { PrismaService } from "../common/prisma/prisma.service";
import { lockVehicle } from "../common/vehicle-lock";
import { StorageService } from "../storage/storage.service";
import { MAX_IMAGES_PER_VEHICLE, processVehicleImage } from "./image-processor";

export type VehicleImageView = { id: string; url: string; position: number };

function notFound(message: string): ApiError {
  return new ApiError(404, "NOT_FOUND", message);
}

function imageLimit(): ApiError {
  return new ApiError(409, "IMAGE_LIMIT", `Mỗi xe tối đa ${MAX_IMAGES_PER_VEHICLE} ảnh.`);
}

@Injectable()
export class VehicleImagesService {
  private readonly logger = new Logger(VehicleImagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // Điều kiện ownerId nằm trong WHERE: xe của người khác trả 404 y như xe không tồn tại (SPEC §1).
  private async assertOwned(ownerId: string, vehicleId: string): Promise<void> {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, ownerId }, select: { id: true } });
    if (!vehicle) throw notFound("Không tìm thấy xe.");
  }

  private toView(image: { id: string; storageKey: string; position: number }): VehicleImageView {
    return { id: image.id, url: this.storage.publicUrl(image.storageKey), position: image.position };
  }

  async list(ownerId: string, vehicleId: string): Promise<VehicleImageView[]> {
    await this.assertOwned(ownerId, vehicleId);
    const images = await this.prisma.vehicleImage.findMany({ where: { vehicleId }, orderBy: { position: "asc" } });
    return images.map((image) => this.toView(image));
  }

  async add(ownerId: string, vehicleId: string, file: Buffer): Promise<VehicleImageView> {
    await this.assertOwned(ownerId, vehicleId);

    // Kiểm tra nhanh trước khi tốn CPU xử lý ảnh. Kiểm tra thật nằm trong transaction bên dưới.
    if ((await this.prisma.vehicleImage.count({ where: { vehicleId } })) >= MAX_IMAGES_PER_VEHICLE) throw imageLimit();

    const processed = await processVehicleImage(file);
    const key = `vehicles/${vehicleId}/${randomUUID()}.webp`;
    await this.storage.save(key, processed);

    try {
      const image = await this.prisma.$transaction(async (tx) => {
        // Khóa theo xe: hai lần tải đồng thời không cùng đếm "còn chỗ" và không cùng lấy một position.
        await lockVehicle(tx, vehicleId);
        const taken = new Set(
          (await tx.vehicleImage.findMany({ where: { vehicleId }, select: { position: true } })).map((i) => i.position),
        );
        // CSDL chỉ cho position từ 0 đến 9 (vehicle_images_position_range): lấy ô trống nhỏ nhất, nên xóa một ảnh
        // rồi tải ảnh khác thì ô cũ được dùng lại. "Lớn nhất + 1" sẽ vượt 9 dù chưa đủ 10 ảnh.
        const position = Array.from({ length: MAX_IMAGES_PER_VEHICLE }, (_, i) => i).find((i) => !taken.has(i));
        if (position === undefined) throw imageLimit();
        return tx.vehicleImage.create({ data: { vehicleId, storageKey: key, position } });
      });
      return this.toView(image);
    } catch (error) {
      // Không để lại file mồ côi nếu ghi CSDL thất bại.
      await this.storage.remove(key).catch((e: unknown) => this.logger.error(`Không dọn được file ${key}: ${String(e)}`));
      throw error;
    }
  }

  async remove(ownerId: string, vehicleId: string, imageId: string): Promise<void> {
    await this.assertOwned(ownerId, vehicleId);
    const image = await this.prisma.vehicleImage.findFirst({ where: { id: imageId, vehicleId } });
    if (!image) throw notFound("Không tìm thấy ảnh.");

    const result = await this.prisma.vehicleImage.deleteMany({ where: { id: imageId, vehicleId } });
    if (result.count === 0) throw notFound("Không tìm thấy ảnh.");

    // Xóa bản ghi trước, file sau: nếu xóa file lỗi thì chỉ còn một file thừa, không còn bản ghi trỏ vào file đã mất.
    await this.storage
      .remove(image.storageKey)
      .catch((e: unknown) => this.logger.error(`Không xóa được file ${image.storageKey}: ${String(e)}`));
  }
}
