import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiError } from "../common/api-error";
import { AuthUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { DatabaseBrowserService, TableInfo, TableRows } from "./database-browser.service";
import { IDENTIFIER, TableRowsQuery } from "./dto/table-rows.query";

// Xem dữ liệu CSDL, chỉ đọc, chỉ vai trò dev (SPEC §1 và §7).
@Controller("dev/database")
@Roles("dev")
export class DevDatabaseController {
  constructor(private readonly database: DatabaseBrowserService) {}

  @Get("tables")
  async listTables(): Promise<{ items: TableInfo[] }> {
    return { items: await this.database.listTables() };
  }

  @Get("tables/:table/rows")
  listRows(@CurrentUser() user: AuthUser, @Param("table") table: string, @Query() query: TableRowsQuery): Promise<TableRows> {
    if (!IDENTIFIER.test(table)) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy bảng này.");
    return this.database.listRows(user.id, table, query);
  }
}
