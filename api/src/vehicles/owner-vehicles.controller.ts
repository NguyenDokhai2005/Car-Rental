import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { VehicleBlock } from "@prisma/client";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { uuidParam } from "../common/pipes/uuid-param.pipe";
import { CreateBlockDto } from "./dto/create-block.dto";
import { CreateVehicleDto } from "./dto/create-vehicle.dto";
import { HideVehicleDto } from "./dto/hide-vehicle.dto";
import { ListVehiclesQuery } from "./dto/list-vehicles.query";
import { ApiError } from "../common/api-error";
import { MAX_IMAGE_BYTES } from "./image-processor";
import { MonthQuery } from "./dto/month.query";
import { UpdateVehicleDto } from "./dto/update-vehicle.dto";
import { OwnerVehiclesService } from "./owner-vehicles.service";
import { VehicleImagesService, VehicleImageView } from "./vehicle-images.service";
import type { OwnerBusyPeriod, OwnerVehicle, Page } from "./vehicle.view";

// Chủ xe luôn được xác định bằng access token (@CurrentUser), không nhận ownerId từ client.
@Controller("owner/vehicles")
@Roles("owner")
export class OwnerVehiclesController {
  constructor(
    private readonly vehicles: OwnerVehiclesService,
    private readonly images: VehicleImagesService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListVehiclesQuery): Promise<Page<OwnerVehicle>> {
    return this.vehicles.list(user.id, query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVehicleDto): Promise<OwnerVehicle> {
    return this.vehicles.create(user.id, dto);
  }

  @Get(":id")
  getOne(@CurrentUser() user: AuthUser, @Param("id", uuidParam) id: string): Promise<OwnerVehicle> {
    return this.vehicles.getOne(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", uuidParam) id: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<OwnerVehicle> {
    return this.vehicles.update(user.id, id, dto);
  }

  @Get(":id/images")
  listImages(@CurrentUser() user: AuthUser, @Param("id", uuidParam) id: string): Promise<VehicleImageView[]> {
    return this.images.list(user.id, id);
  }

  // Multer giữ file trong RAM và dừng ngay khi vượt MAX_IMAGE_BYTES (lỗi 413), không ghi tạm ra đĩa.
  // Guard đăng nhập và vai trò chạy trước interceptor này nên người lạ không tải được gì lên.
  @Post(":id/images")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  uploadImage(
    @CurrentUser() user: AuthUser,
    @Param("id", uuidParam) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<VehicleImageView> {
    if (!file) throw new ApiError(400, "VALIDATION_ERROR", "Thiếu tệp ảnh (trường multipart tên file).");
    return this.images.add(user.id, id, file.buffer);
  }

  @HttpCode(204)
  @Delete(":id/images/:imageId")
  deleteImage(
    @CurrentUser() user: AuthUser,
    @Param("id", uuidParam) id: string,
    @Param("imageId", uuidParam) imageId: string,
  ): Promise<void> {
    return this.images.remove(user.id, id, imageId);
  }

  @HttpCode(200)
  @Post(":id/hide")
  hide(
    @CurrentUser() user: AuthUser,
    @Param("id", uuidParam) id: string,
    @Body() dto: HideVehicleDto,
  ): Promise<OwnerVehicle> {
    return this.vehicles.setHidden(user.id, id, dto.hidden);
  }

  @Get(":id/blocks")
  listBlocks(@CurrentUser() user: AuthUser, @Param("id", uuidParam) id: string): Promise<VehicleBlock[]> {
    return this.vehicles.listBlocks(user.id, id);
  }

  @Post(":id/blocks")
  createBlock(
    @CurrentUser() user: AuthUser,
    @Param("id", uuidParam) id: string,
    @Body() dto: CreateBlockDto,
  ): Promise<VehicleBlock> {
    return this.vehicles.createBlock(user.id, id, dto);
  }

  @HttpCode(204)
  @Delete(":id/blocks/:blockId")
  deleteBlock(
    @CurrentUser() user: AuthUser,
    @Param("id", uuidParam) id: string,
    @Param("blockId", uuidParam) blockId: string,
  ): Promise<void> {
    return this.vehicles.deleteBlock(user.id, id, blockId);
  }

  @Get(":id/calendar")
  calendar(
    @CurrentUser() user: AuthUser,
    @Param("id", uuidParam) id: string,
    @Query() query: MonthQuery,
  ): Promise<{ vehicleId: string; month: string; busy: OwnerBusyPeriod[] }> {
    return this.vehicles.calendar(user.id, id, query.month);
  }
}
