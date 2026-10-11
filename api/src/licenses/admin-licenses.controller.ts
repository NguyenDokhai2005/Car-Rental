import { Body, Controller, Get, HttpCode, Param, Post, Req, Res, StreamableFile } from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { uuidParam } from "../common/pipes/uuid-param.pipe";
import { RejectLicenseDto, VerifyLicenseDto } from "./dto/review-license.dto";
import { parseSide, sendLicenseImage } from "./license-file";
import type { AdminLicenseView } from "./license.view";
import { LicensesService } from "./licenses.service";

@Controller("admin/users/:id/license")
@Roles("admin")
export class AdminLicensesController {
  constructor(private readonly licenses: LicensesService) {}

  @Get()
  get(@Param("id", uuidParam) id: string): Promise<AdminLicenseView> {
    return this.licenses.getForAdmin(id);
  }

  @HttpCode(200)
  @Post("verify")
  verify(@CurrentUser() admin: AuthUser, @Param("id", uuidParam) id: string, @Body() dto: VerifyLicenseDto): Promise<AdminLicenseView> {
    return this.licenses.verify(admin.id, id, dto.version);
  }

  @HttpCode(200)
  @Post("reject")
  reject(@CurrentUser() admin: AuthUser, @Param("id", uuidParam) id: string, @Body() dto: RejectLicenseDto): Promise<AdminLicenseView> {
    return this.licenses.reject(admin.id, id, dto.reason);
  }

  @Get(":side")
  async file(
    @CurrentUser() admin: AuthUser,
    @Param("id", uuidParam) id: string,
    @Param("side") side: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return sendLicenseImage(res, await this.licenses.readFile(admin.id, id, parseSide(side), req.ip));
  }
}
