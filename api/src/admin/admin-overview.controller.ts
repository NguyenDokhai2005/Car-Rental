import { Controller, Get, Query } from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator";
import { AdminOverviewService, Overview } from "./admin-overview.service";
import { OverviewQuery } from "./dto/admin-actions.dto";

@Controller("admin/overview")
@Roles("admin")
export class AdminOverviewController {
  constructor(private readonly overview: AdminOverviewService) {}

  @Get()
  get(@Query() query: OverviewQuery): Promise<Overview> {
    return this.overview.get(query.days);
  }
}
