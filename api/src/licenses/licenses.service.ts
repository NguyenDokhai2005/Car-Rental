import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ApiError } from "../common/api-error";
import { PrismaService } from "../common/prisma/prisma.service";
import { PrivateStorageService } from "../storage/private-storage.service";
import { processVehicleImage } from "../vehicles/image-processor";
import type { SubmitLicenseDto } from "./dto/submit-license.dto";
import { isValidFutureDate, LicenseSide, licenseVersion } from "./license-rules";
import { AdminLicenseView, LICENSE_SELECT, LicenseRow, LicenseView, toAdminLicenseView, toLicenseView } from "./license.view";

type StoredKeys = { license_status: string; license_front_key: string | null; license_back_key: string | null };

function notFound(message = "Không tìm thấy người dùng."): ApiError {
  return new ApiError(404, "NOT_FOUND", message);
}

function changedMeanwhile(): ApiError {
  return new ApiError(409, "INVALID_STATE", "Hồ sơ vừa được cập nhật. Vui lòng tải lại và xem lại trước khi quyết định.");
}

@Injectable()
export class LicensesService {
  private readonly logger = new Logger(LicensesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PrivateStorageService,
  ) {}

  private async findOrThrow(userId: string): Promise<LicenseRow> {
    const row = await this.prisma.user.findUnique({ where: { id: userId }, select: LICENSE_SELECT });
    if (!row) throw notFound();
    return row;
  }

  private async removeFiles(keys: (string | null | undefined)[]): Promise<void> {
    for (const key of keys) {
      if (!key) continue;
      await this.storage.remove(key).catch((e: unknown) => this.logger.error(`Không xóa được file ${key}: ${String(e)}`));
    }
  }

  async getMine(userId: string): Promise<LicenseView> {
    return toLicenseView(await this.findOrThrow(userId));
  }

  async getForAdmin(userId: string): Promise<AdminLicenseView> {
    return toAdminLicenseView(await this.findOrThrow(userId));
  }

  async submit(userId: string, dto: SubmitLicenseDto, front: Buffer, back: Buffer | undefined): Promise<LicenseView> {
    if (!isValidFutureDate(dto.licenseExpiresOn)) {
      throw new ApiError(400, "VALIDATION_ERROR", "Ngày hết hạn phải có dạng yyyy-mm-dd và chưa qua.");
    }
    // Kiểm tra nhanh trước khi tốn CPU xử lý ảnh. Kiểm tra thật nằm trong transaction bên dưới.
    if ((await this.findOrThrow(userId)).licenseStatus === "verified") throw this.alreadyVerified();

    const frontKey = `licenses/${userId}/${randomUUID()}.webp`;
    const backKey = back ? `licenses/${userId}/${randomUUID()}.webp` : null;
    try {
      await this.storage.save(frontKey, await processVehicleImage(front));
      if (back && backKey) await this.storage.save(backKey, await processVehicleImage(back));

      const previous = await this.prisma.$transaction(async (tx) => {
        // Khóa dòng người dùng: hai lần gửi đồng thời xếp hàng, lần sau thấy đúng file của lần trước để xóa, và một
        // lần duyệt của admin chen vào giữa cũng không bị ghi đè.
        const [current] = await tx.$queryRaw<StoredKeys[]>`
          SELECT license_status::text, license_front_key, license_back_key FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
        if (!current) throw notFound();
        if (current.license_status === "verified") throw this.alreadyVerified();

        await tx.user.update({
          where: { id: userId },
          data: {
            licenseStatus: "pending",
            licenseNumber: dto.licenseNumber,
            licenseClass: dto.licenseClass,
            licenseExpiresOn: new Date(`${dto.licenseExpiresOn}T00:00:00Z`),
            licenseFrontKey: frontKey,
            licenseBackKey: backKey,
            licenseRejectReason: null,
            licenseReviewedById: null,
            licenseReviewedAt: null,
          },
        });
        return current;
      });

      // Xóa file cũ sau khi CSDL đã trỏ sang file mới: nếu xóa lỗi thì chỉ còn file thừa, không có bản ghi trỏ vào file mất.
      await this.removeFiles([previous.license_front_key, previous.license_back_key]);
    } catch (error) {
      await this.removeFiles([frontKey, backKey]);
      throw error;
    }
    return this.getMine(userId);
  }

  private alreadyVerified(): ApiError {
    return new ApiError(409, "INVALID_STATE", "Giấy phép lái xe của bạn đã được xác minh, không cần gửi lại.");
  }

  // Trả nội dung ảnh và ghi log truy cập. Ghi log trước khi trả file: nếu không ghi được log thì không ai xem được ảnh.
  async readFile(actorId: string, targetUserId: string, side: LicenseSide, ip: string | undefined): Promise<Buffer> {
    const row = await this.findOrThrow(targetUserId);
    const key = side === "front" ? row.licenseFrontKey : row.licenseBackKey;
    if (!key) throw notFound("Không có ảnh giấy phép lái xe.");

    const data = await this.storage.read(key);
    if (!data) throw notFound("Không có ảnh giấy phép lái xe.");

    await this.prisma.licenseAccessLog.create({ data: { actorId, targetUserId, fileKey: key, ipAddress: ip ?? null } });
    return data;
  }

  // Điều kiện "đang pending" và "đúng bộ file admin đã xem" nằm trong WHERE của câu UPDATE: nếu khách vừa gửi lại hồ sơ
  // hoặc admin khác vừa quyết định, câu lệnh không khớp dòng nào và admin nhận 409 thay vì duyệt nhầm ảnh chưa xem.
  async verify(adminId: string, userId: string, version: string): Promise<AdminLicenseView> {
    const current = await this.findOrThrow(userId);
    if (licenseVersion(current.licenseFrontKey, current.licenseBackKey) !== version) throw changedMeanwhile();
    if (current.licenseStatus === "verified") return toAdminLicenseView(current);
    if (current.licenseStatus !== "pending") {
      throw new ApiError(409, "INVALID_STATE", "Chỉ hồ sơ đang chờ duyệt mới duyệt được.");
    }

    const result = await this.prisma.user.updateMany({
      where: { id: userId, licenseStatus: "pending", licenseFrontKey: current.licenseFrontKey, licenseBackKey: current.licenseBackKey },
      data: { licenseStatus: "verified", licenseRejectReason: null, licenseReviewedById: adminId, licenseReviewedAt: new Date() },
    });
    if (result.count === 0) throw changedMeanwhile();
    return this.getForAdmin(userId);
  }

  async reject(adminId: string, userId: string, reason: string): Promise<AdminLicenseView> {
    const current = await this.findOrThrow(userId);
    if (current.licenseStatus === "rejected") return toAdminLicenseView(current);
    if (current.licenseStatus !== "pending") {
      throw new ApiError(409, "INVALID_STATE", "Chỉ hồ sơ đang chờ duyệt mới từ chối được.");
    }

    const result = await this.prisma.user.updateMany({
      where: { id: userId, licenseStatus: "pending" },
      data: { licenseStatus: "rejected", licenseRejectReason: reason, licenseReviewedById: adminId, licenseReviewedAt: new Date() },
    });
    if (result.count === 0) throw changedMeanwhile();
    return this.getForAdmin(userId);
  }
}
