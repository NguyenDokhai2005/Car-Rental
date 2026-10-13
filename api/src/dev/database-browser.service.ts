import { Injectable, Logger } from "@nestjs/common";
import { ApiError } from "../common/api-error";
import { PrismaService } from "../common/prisma/prisma.service";

export type TableColumn = { name: string; type: string; nullable: boolean; masked: boolean };
export type TableInfo = { name: string; rows: number; sizeMb: number; columns: TableColumn[] };
export type TableRows = { columns: TableColumn[]; items: Record<string, string | null>[]; total: number; page: number; limit: number };

export type RowsQuery = { page: number; limit: number; sort?: string; order: "asc" | "desc"; filterColumn?: string; filterValue?: string };

export const MASK = "••••••";
const VALUE_MAX_LENGTH = 300;
const TIMEOUT_MS = 5000;

// Cột bí mật: giá trị không bao giờ rời CSDL (SPEC §7, mục Dev). Danh sách nêu đích danh, cộng thêm quy tắc theo tên để
// một cột bí mật thêm sau này mặc định cũng bị che dù người viết quên cập nhật danh sách.
const MASKED_COLUMNS = new Set([
  "users.password_hash",
  "users.license_number",
  "users.license_front_key",
  "users.license_back_key",
  "refresh_tokens.token_hash",
  "license_access_logs.file_key",
  "payments.raw_payload",
]);
const MASKED_NAME = /password|secret|token|hash/i;

export function isMasked(table: string, column: string): boolean {
  return MASKED_COLUMNS.has(`${table}.${column}`) || MASKED_NAME.test(column);
}

// Tên bảng và cột được ghép thẳng vào câu SQL (tham số $1 không dùng được cho tên), nên chỉ ghép những tên đã đối chiếu
// với danh mục của CSDL, và vẫn bọc nháy kép để một cái tên lạ không thể thoát ra thành lệnh.
const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

@Injectable()
export class DatabaseBrowserService {
  private readonly logger = new Logger(DatabaseBrowserService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listTables(): Promise<TableInfo[]> {
    const tables = await this.prisma.$queryRaw<{ name: string; rows: bigint; bytes: bigint }[]>`
      SELECT relname AS name, n_live_tup AS rows, pg_total_relation_size(relid) AS bytes
      FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY relname`;
    const columns = await this.prisma.$queryRaw<{ table_name: string; column_name: string; data_type: string; udt_name: string; is_nullable: string }[]>`
      SELECT table_name, column_name, data_type, udt_name, is_nullable
      FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`;

    return tables.map((table) => ({
      name: table.name,
      rows: Number(table.rows),
      sizeMb: Number((Number(table.bytes) / (1024 * 1024)).toFixed(2)),
      columns: columns
        .filter((column) => column.table_name === table.name)
        .map((column) => ({
          name: column.column_name,
          // Kiểu enum và kiểu tự định nghĩa hiện tên thật (user_role) thay vì "USER-DEFINED".
          type: column.data_type === "USER-DEFINED" ? column.udt_name : column.data_type,
          nullable: column.is_nullable === "YES",
          masked: isMasked(table.name, column.column_name),
        })),
    }));
  }

  async listRows(actorId: string, tableName: string, query: RowsQuery): Promise<TableRows> {
    const table = (await this.listTables()).find((candidate) => candidate.name === tableName);
    if (!table) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy bảng này.");

    const column = (name: string, purpose: string): TableColumn => {
      const found = table.columns.find((candidate) => candidate.name === name);
      if (!found) throw new ApiError(404, "NOT_FOUND", `Bảng ${table.name} không có cột ${name}.`);
      // Lọc hay sắp xếp theo cột bị che sẽ để lộ giá trị qua kết quả (đoán từng giá trị, hoặc đọc thứ tự).
      if (found.masked) throw new ApiError(400, "VALIDATION_ERROR", `Không ${purpose} được theo cột đã bị che.`);
      return found;
    };
    const sort = query.sort ? column(query.sort, "sắp xếp") : null;
    const filter = query.filterColumn ? column(query.filterColumn, "lọc") : null;
    if (filter && query.filterValue === undefined) throw new ApiError(400, "VALIDATION_ERROR", "Thiếu filterValue.");

    // Mọi giá trị đổi sang chữ và cắt ngắn ngay trong CSDL: không phải xử lý riêng từng kiểu (bigint, json, ngày giờ),
    // và một ô chứa văn bản rất dài không kéo cả nội dung về API.
    const selected = table.columns
      .map((c) => {
        const name = quote(c.name);
        return c.masked ? `CASE WHEN ${name} IS NULL THEN NULL ELSE '${MASK}' END AS ${name}` : `left(${name}::text, ${VALUE_MAX_LENGTH}) AS ${name}`;
      })
      .join(", ");
    const where = filter ? `WHERE ${quote(filter.name)}::text = $1` : "";
    const params = filter ? [query.filterValue] : [];
    // Không chọn cột sắp xếp thì theo ctid (vị trí vật lý của dòng), để chuyển trang không bị lặp hay sót dòng.
    const orderBy = sort ? `${quote(sort.name)} ${query.order === "desc" ? "DESC" : "ASC"} NULLS LAST, ctid` : "ctid";
    const from = `FROM public.${quote(table.name)} ${where}`;

    const [, , items, counted] = await this.prisma.$transaction([
      // READ ONLY: dù có sai sót ở đâu, câu truy vấn của trang này cũng không thể ghi vào CSDL.
      this.prisma.$executeRawUnsafe("SET TRANSACTION READ ONLY"),
      this.prisma.$executeRawUnsafe(`SET LOCAL statement_timeout = ${TIMEOUT_MS}`),
      this.prisma.$queryRawUnsafe<Record<string, string | null>[]>(
        `SELECT ${selected} ${from} ORDER BY ${orderBy} LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
        ...params,
      ),
      this.prisma.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) AS count ${from}`, ...params),
    ]);

    // Dev đang xem dữ liệu khách hàng: ghi lại ai xem gì. Không ghi giá trị lọc vì nó có thể là email hay số điện thoại.
    this.logger.log(`Xem dữ liệu bảng: dev=${actorId} table=${table.name} page=${query.page}${filter ? ` filter=${filter.name}` : ""}`);

    return { columns: table.columns, items, total: Number(counted[0].count), page: query.page, limit: query.limit };
  }
}
