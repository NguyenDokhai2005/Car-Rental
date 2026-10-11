import { Body, Controller, Get, HttpCode, Param, Post, Req, Res, StreamableFile, UploadedFiles, UseInterceptors } from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { ApiError } from "../common/api-error";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { MAX_IMAGE_BYTES } from "../vehicles/image-processor";
import { SubmitLicenseDto } from "./dto/submit-license.dto";
import { parseSide, sendLicenseImage } from "./license-file";
import type { LicenseView } from "./license.view";
import { LicensesService } from "./licenses.service";

type LicenseFiles = { front?: Express.Multer.File[]; back?: Express.Multer.File[] };

// Người dùng luôn được xác định bằng access token: không có tham số id nào, nên không thể đọc hay ghi hồ sơ của người khác.
@Controller("me/license")
@Roles("renter")
export class MeLicenseController {
  constructor(private readonly licenses: LicensesService) {}

  @Get()
  get(@CurrentUser() user: AuthUser): Promise<LicenseView> {
    return this.licenses.getMine(user.id);
  }

  // Multer giữ file trong RAM và dừng ngay khi một file vượt MAX_IMAGE_BYTES (lỗi 413), không ghi tạm ra đĩa.
  // Xử lý ảnh tốn CPU: giới hạn chặt hơn mức mặc định để một tài khoản không làm nghẽn máy chủ nhỏ.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "front", maxCount: 1 },
        { name: "back", maxCount: 1 },
      ],
      { limits: { fileSize: MAX_IMAGE_BYTES, files: 2 } },
    ),
  )
  submit(@CurrentUser() user: AuthUser, @Body() dto: SubmitLicenseDto, @UploadedFiles() files: LicenseFiles | undefined): Promise<LicenseView> {
    const front = files?.front?.[0];
    if (!front) throw new ApiError(400, "VALIDATION_ERROR", "Thiếu ảnh mặt trước giấy phép lái xe (trường multipart tên front).");
    return this.licenses.submit(user.id, dto, front.buffer, files?.back?.[0]?.buffer);
  }

  @Get(":side")
  async file(
    @CurrentUser() user: AuthUser,
    @Param("side") side: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return sendLicenseImage(res, await this.licenses.readFile(user.id, user.id, parseSide(side), req.ip));
  }
}
